import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { DAYS } from '../types'

interface Result {
  id: string
  tipo: 'inversión' | 'categoría' | 'tarea'
  titulo: string
  subtitulo: string
  to: string
}

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: invs }, { data: tasks }] = await Promise.all([
        supabase.from('categories').select('id, nombre'),
        supabase.from('investments').select('id, nombre, category_id, categories(nombre)'),
        supabase.from('tasks').select('id, titulo, dia_semana'),
      ])

      const results: Result[] = [
        ...((cats ?? []) as { id: string; nombre: string }[]).map((c) => ({
          id: c.id,
          tipo: 'categoría' as const,
          titulo: c.nombre,
          subtitulo: 'Categoría',
          to: '/inversiones',
        })),
        ...((invs ?? []) as any[]).map((i) => ({
          id: i.id,
          tipo: 'inversión' as const,
          titulo: i.nombre,
          subtitulo: i.categories?.nombre ?? 'Inversión',
          to: `/inversiones/${i.id}`,
        })),
        ...((tasks ?? []) as { id: string; titulo: string; dia_semana: string }[]).map((t) => ({
          id: t.id,
          tipo: 'tarea' as const,
          titulo: t.titulo,
          subtitulo: DAYS.find((d) => d.key === t.dia_semana)?.label ?? 'Tarea',
          to: '/tablero',
        })),
      ]
      setAll(results)
      setLoading(false)
    }
    load()
  }, [])

  const q = query.trim().toLowerCase()
  const results = q ? all.filter((r) => r.titulo.toLowerCase().includes(q)).slice(0, 20) : []

  function go(to: string) {
    navigate(to)
    onClose()
  }

  return (
    <Modal title="Buscar" onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Inversión, categoría o tarea..."
        className="w-full px-4 py-3 rounded-xl border border-line text-lg mb-4"
      />

      {loading && <p className="text-ink-soft text-sm">Cargando...</p>}

      {!loading && q && results.length === 0 && (
        <p className="text-ink-soft text-sm">Sin resultados para "{query}".</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-line max-h-80 overflow-y-auto">
          {results.map((r) => (
            <li key={`${r.tipo}-${r.id}`}>
              <button
                onClick={() => go(r.to)}
                className="w-full text-left py-3 flex items-center justify-between hover:bg-cream px-2 rounded-lg"
              >
                <span className="font-medium text-ink">{r.titulo}</span>
                <span className="text-xs text-ink-soft shrink-0 ml-3">{r.subtitulo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
