import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logActivity } from '../lib/activity'
import Modal from '../components/Modal'
import { formatDate } from '../lib/format'
import type { AppEvent } from '../types'

export default function Events() {
  const { profile } = useAuth()
  const [events, setEvents] = useState<AppEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<AppEvent | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('fecha')
    setEvents((data as AppEvent[]) ?? [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function deleteEvent(ev: AppEvent) {
    if (!confirm(`¿Eliminar el evento "${ev.titulo}"?`)) return
    await supabase.from('events').delete().eq('id', ev.id)
    logActivity(profile, 'eliminó', 'evento', ev.titulo)
    load()
  }

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  const today = new Date().toISOString().slice(0, 10)
  const proximos = events.filter((e) => e.fecha >= today)
  const pasados = events.filter((e) => e.fecha < today)

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold text-ink">Eventos</h1>
        <button
          onClick={() => setShowNew(true)}
          className="px-5 py-2.5 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark"
        >
          + Nuevo evento
        </button>
      </div>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Próximos</h2>
        {proximos.length === 0 ? (
          <p className="text-ink-soft text-sm">No hay eventos próximos cargados.</p>
        ) : (
          <ul className="divide-y divide-line">
            {proximos.map((ev) => (
              <EventRow key={ev.id} event={ev} onEdit={() => setEditing(ev)} onDelete={() => deleteEvent(ev)} />
            ))}
          </ul>
        )}
      </section>

      {pasados.length > 0 && (
        <section className="bg-paper border border-line rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Pasados</h2>
          <ul className="divide-y divide-line">
            {pasados.map((ev) => (
              <EventRow key={ev.id} event={ev} onEdit={() => setEditing(ev)} onDelete={() => deleteEvent(ev)} muted />
            ))}
          </ul>
        </section>
      )}

      {showNew && <EventModal onClose={() => setShowNew(false)} onSaved={load} />}
      {editing && <EventModal existing={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onDelete,
  muted,
}: {
  event: AppEvent
  onEdit: () => void
  onDelete: () => void
  muted?: boolean
}) {
  return (
    <li className="py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`font-medium ${muted ? 'text-ink-soft' : 'text-ink'}`}>{event.titulo}</p>
        {event.descripcion && <p className="text-sm text-ink-soft truncate">{event.descripcion}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <p className={`text-sm ${muted ? 'text-ink-soft' : 'font-medium text-ink'}`}>{formatDate(event.fecha)}</p>
        <button onClick={onEdit} className="text-sm font-medium text-terracotta hover:text-terracotta-dark">
          Editar
        </button>
        <button onClick={onDelete} className="text-sm font-medium text-rose hover:text-rose/70">
          Borrar
        </button>
      </div>
    </li>
  )
}

function EventModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: AppEvent
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [titulo, setTitulo] = useState(existing?.titulo ?? '')
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  const [descripcion, setDescripcion] = useState(existing?.descripcion ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!titulo.trim()) return
    setSaving(true)
    const payload = { titulo: titulo.trim(), fecha, descripcion: descripcion.trim() || null }
    if (existing) {
      await supabase.from('events').update(payload).eq('id', existing.id)
      logActivity(profile, 'editó', 'evento', titulo.trim())
    } else {
      await supabase.from('events').insert({ ...payload, creado_por: profile?.id })
      logActivity(profile, 'creó', 'evento', titulo.trim())
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal title={existing ? 'Editar evento' : 'Nuevo evento'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Título</label>
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            placeholder="Ej: Vencimiento seguro campo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Notas (opcional)</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-line text-base resize-none"
          />
        </div>
        <button
          disabled={saving}
          onClick={save}
          className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark disabled:opacity-60"
        >
          {saving ? 'Guardando...' : existing ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </Modal>
  )
}
