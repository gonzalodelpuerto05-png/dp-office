import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MONTHS } from '../types'
import type { InvestmentIncome, InvestmentCost } from '../types'
import { addToBag, formatBag, formatMoney, formatDate, type MoneyBag } from '../lib/format'

type IncomeRow = InvestmentIncome & { investment_nombre: string }
type CostRow = InvestmentCost & { investment_nombre: string }

export default function MonthlyFlow() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [costs, setCosts] = useState<CostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const desde = `${year}-01-01`
      const hasta = `${year}-12-31`
      const [{ data: inc }, { data: cst }] = await Promise.all([
        supabase
          .from('investment_income')
          .select('*, investments(nombre)')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha'),
        supabase
          .from('investment_costs')
          .select('*, investments(nombre)')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha'),
      ])
      setIncome(((inc ?? []) as any[]).map((r) => ({ ...r, investment_nombre: r.investments?.nombre ?? '-' })))
      setCosts(((cst ?? []) as any[]).map((r) => ({ ...r, investment_nombre: r.investments?.nombre ?? '-' })))
      setLoading(false)
    }
    load()
  }, [year])

  const byMonth = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1
      const monthIncome = income.filter((r) => Number(r.fecha.slice(5, 7)) === monthNum)
      const monthCosts = costs.filter((r) => Number(r.fecha.slice(5, 7)) === monthNum)
      const ingresosBag = monthIncome.reduce((bag, r) => addToBag(bag, r.moneda, r.monto), {} as MoneyBag)
      const costosBag = monthCosts.reduce((bag, r) => addToBag(bag, r.moneda, r.monto), {} as MoneyBag)
      return { monthNum, monthIncome, monthCosts, ingresosBag, costosBag }
    })
  }, [income, costs])

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  const expanded = expandedMonth ? byMonth[expandedMonth - 1] : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold text-ink">Flujo mensual</h1>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-4 py-2 rounded-lg border border-line text-base"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {byMonth.map(({ monthNum, monthIncome, monthCosts, ingresosBag, costosBag }) => (
          <div key={monthNum} className="bg-paper border border-line rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink">{MONTHS[monthNum - 1]}</h2>
              {(monthIncome.length > 0 || monthCosts.length > 0) && (
                <button
                  onClick={() => setExpandedMonth(monthNum)}
                  title="Ver detalle"
                  className="text-ink-soft hover:text-terracotta text-lg leading-none px-1"
                >
                  ⤢
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-ink-soft">Ingresos</p>
                <p className="font-medium text-sage-dark break-words">{formatBag(ingresosBag)}</p>
              </div>
              <div>
                <p className="text-ink-soft">Costos</p>
                <p className="font-medium text-rose break-words">{formatBag(costosBag)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="fixed inset-0 bg-cream z-50 flex flex-col">
          <div className="border-b border-line bg-paper px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink">
              {MONTHS[expanded.monthNum - 1]} {year}
            </h2>
            <button
              onClick={() => setExpandedMonth(null)}
              className="px-4 py-2 rounded-xl text-ink-soft hover:text-ink hover:bg-cream text-lg font-medium"
            >
              Cerrar ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto space-y-8">
              <section>
                <h3 className="text-lg font-semibold text-sage-dark mb-3">
                  Ingresos — {formatBag(expanded.ingresosBag)}
                </h3>
                {expanded.monthIncome.length === 0 ? (
                  <p className="text-ink-soft text-sm">Sin ingresos este mes.</p>
                ) : (
                  <ul className="divide-y divide-line bg-paper border border-line rounded-2xl px-4">
                    {expanded.monthIncome.map((r) => (
                      <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{r.concepto}</p>
                          <p className="text-sm text-ink-soft truncate">{r.investment_nombre}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium text-ink">{formatMoney(r.monto, r.moneda)}</p>
                          <p className="text-xs text-ink-soft">{formatDate(r.fecha)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-lg font-semibold text-rose mb-3">Costos — {formatBag(expanded.costosBag)}</h3>
                {expanded.monthCosts.length === 0 ? (
                  <p className="text-ink-soft text-sm">Sin costos este mes.</p>
                ) : (
                  <ul className="divide-y divide-line bg-paper border border-line rounded-2xl px-4">
                    {expanded.monthCosts.map((r) => (
                      <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{r.concepto}</p>
                          <p className="text-sm text-ink-soft truncate">{r.investment_nombre}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium text-ink">{formatMoney(r.monto, r.moneda)}</p>
                          <p className="text-xs text-ink-soft">{formatDate(r.fecha)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
