import { supabase } from './supabase'
import { logActivity } from './activity'
import type { Profile } from '../types'

const MAX_MONTHS_TO_BACKFILL = 24

function addOneMonth(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number)
  const next = new Date(y, m, d) // mes es 0-indexado en Date, así que m ya avanza uno
  return next.toISOString().slice(0, 10)
}

function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

// Evita que dos llamados en simultáneo (ej. React StrictMode montando el
// efecto dos veces, o un doble disparo del efecto) generen las mismas
// ocurrencias por duplicado: el segundo llamado espera al primero en vez
// de volver a leer y volver a insertar.
let inFlight: Promise<void> | null = null

// Revisa los ingresos marcados como recurrentes y, si el último cargado
// de cada serie (misma inversión + concepto + moneda) quedó en un mes
// anterior al actual, genera las ocurrencias que faltan hasta hoy. Se
// llama al entrar a la app; no depende de ningún cron externo.
export function generateDueRecurringIncome(profile: Pick<Profile, 'id' | 'nombre'> | null | undefined) {
  if (inFlight) return inFlight
  inFlight = doGenerate(profile).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function doGenerate(profile: Pick<Profile, 'id' | 'nombre'> | null | undefined) {
  const { data } = await supabase
    .from('investment_income')
    .select('id, investment_id, fecha, monto, moneda, concepto, estado, recurrente, investments(nombre)')
    .eq('recurrente', true)
    .order('fecha', { ascending: false })

  if (!data || data.length === 0) return

  const currentMonth = new Date().toISOString().slice(0, 7) + '-01'

  const latestBySeries = new Map<string, any>()
  for (const row of data as any[]) {
    const key = `${row.investment_id}::${row.concepto}::${row.moneda}`
    if (!latestBySeries.has(key)) latestBySeries.set(key, row)
  }

  for (const row of latestBySeries.values()) {
    let monthsBehind = monthsBetween(row.fecha.slice(0, 7) + '-01', currentMonth)
    if (monthsBehind <= 0) continue
    monthsBehind = Math.min(monthsBehind, MAX_MONTHS_TO_BACKFILL)

    let fecha = row.fecha
    for (let i = 0; i < monthsBehind; i++) {
      fecha = addOneMonth(fecha)
      await supabase.from('investment_income').insert({
        investment_id: row.investment_id,
        fecha,
        monto: row.monto,
        moneda: row.moneda,
        concepto: row.concepto,
        estado: 'programado',
        recurrente: true,
      })
    }
    logActivity(
      profile,
      'generó automáticamente',
      'inversión',
      row.investments?.nombre ?? '',
      `ingreso recurrente "${row.concepto}" hasta ${fecha}`
    )
  }
}
