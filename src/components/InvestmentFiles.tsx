import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logActivity } from '../lib/activity'
import { IconFile, IconTrash, IconUpload } from './icons'

const BUCKET = 'investment-files'

interface FileRow {
  name: string
  path: string
  size: number
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InvestmentFiles({
  investmentId,
  investmentNombre,
}: {
  investmentId: string
  investmentNombre: string
}) {
  const { profile } = useAuth()
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(investmentId, { sortBy: { column: 'created_at', order: 'desc' } })
    setFiles(
      (data ?? [])
        .filter((f) => f.id)
        .map((f) => ({ name: f.name, path: `${investmentId}/${f.name}`, size: f.metadata?.size ?? 0 }))
    )
    setLoading(false)
  }, [investmentId])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `${investmentId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (error) {
      alert('No se pudo subir el archivo.')
      return
    }
    logActivity(profile, 'subió un archivo a', 'inversión', investmentNombre, file.name)
    load()
  }

  async function handleDownload(file: FileRow) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.path, 60)
    if (error || !data) {
      alert('No se pudo abrir el archivo.')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(file: FileRow) {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return
    await supabase.storage.from(BUCKET).remove([file.path])
    logActivity(profile, 'eliminó un archivo de', 'inversión', investmentNombre, file.name)
    load()
  }

  if (loading) return <p className="text-ink-soft text-sm">Cargando...</p>

  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <p className="text-ink-soft text-sm">Sin documentos cargados.</p>
      ) : (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.path} className="py-2.5 flex items-center justify-between gap-3">
              <button
                onClick={() => handleDownload(f)}
                className="flex items-center gap-2 min-w-0 text-left text-ink hover:text-terracotta"
              >
                <IconFile className="shrink-0 text-ink-soft" />
                <span className="truncate font-medium">{f.name}</span>
                <span className="text-xs text-ink-soft shrink-0">{formatSize(f.size)}</span>
              </button>
              <button
                onClick={() => handleDelete(f)}
                className="text-rose hover:text-rose/70 shrink-0"
                aria-label="Borrar archivo"
              >
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" id="file-upload-input" />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sage text-white text-sm font-medium hover:bg-sage-dark disabled:opacity-60"
      >
        <IconUpload />
        {uploading ? 'Subiendo...' : 'Subir documento'}
      </button>
    </div>
  )
}
