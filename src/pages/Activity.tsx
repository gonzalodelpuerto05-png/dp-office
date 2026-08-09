import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ActivityLogEntry } from '../types'

const PAGE_SIZE = 50

// El texto de "accion" guardado en la base nunca incluye el sustantivo de
// la entidad (para no repetirlo, ej. "creó la tarea tarea X"); acá se le
// agrega el artículo/preposición correcto según el tipo de entidad.
const ENTITY_PHRASE: Record<string, string> = {
  categoría: 'la categoría',
  inversión: 'la inversión',
  tarea: 'la tarea',
  usuario: 'al usuario',
  evento: 'el evento',
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const days = Math.floor(hr / 24)
  if (days < 30) return `hace ${days} d`
  return new Date(iso).toLocaleDateString('es-UY')
}

export default function Activity() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (offset: number) => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    const rows = (data as ActivityLogEntry[]) ?? []
    setHasMore(rows.length === PAGE_SIZE)
    return rows
  }, [])

  useEffect(() => {
    load(0).then((rows) => {
      setEntries(rows)
      setLoading(false)
    })
  }, [load])

  async function loadMore() {
    const rows = await load(entries.length)
    setEntries((prev) => [...prev, ...rows])
  }

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-semibold text-ink">Actividad</h1>
      <p className="text-ink-soft">Historial de cambios hechos en la app, más recientes primero.</p>

      <section className="bg-paper border border-line rounded-2xl p-6">
        {entries.length === 0 ? (
          <p className="text-ink-soft text-sm">Todavía no hay actividad registrada.</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-ink">
                  <span className="font-medium">{e.user_nombre}</span> {e.accion}{' '}
                  <span className="font-medium">
                    {ENTITY_PHRASE[e.entidad] ?? e.entidad} "{e.entidad_nombre}"
                  </span>
                  {e.detalle && <span className="text-ink-soft"> — {e.detalle}</span>}
                </p>
                <p className="text-xs text-ink-soft mt-0.5">{timeAgo(e.created_at)}</p>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <button
            onClick={loadMore}
            className="mt-4 text-sm font-medium text-terracotta hover:text-terracotta-dark"
          >
            Cargar más
          </button>
        )}
      </section>
    </div>
  )
}
