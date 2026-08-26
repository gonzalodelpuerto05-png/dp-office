import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useCategoriesWithInvestments } from '../hooks/useCategories'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateDueRecurringIncome } from '../lib/recurringIncome'
import type { AppEvent, InvestmentIncome } from '../types'
import { MONTHS } from '../types'
import {
  toBase,
  gainLoss,
  formatDate,
  formatMoney,
  addToBag,
  formatBag,
  subtractBags,
  bagHasNegative,
  type MoneyBag,
} from '../lib/format'
import { useDisplayCurrency } from '../hooks/useDisplayCurrency'
import CurrencySelector from '../components/CurrencySelector'

const PIE_COLORS = ['#c4633f', '#6f8f6a', '#c99a3c', '#b4494f', '#7c8fb0', '#9a7bb0', '#d9a441', '#5c9e8f']

export default function Dashboard() {
  const { profile } = useAuth()
  const profileRef = useRef(profile)
  profileRef.current = profile
  const { categories, investments, loading } = useCategoriesWithInvestments()
  const [upcomingIncome, setUpcomingIncome] = useState<(InvestmentIncome & { investment_nombre: string })[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<AppEvent[]>([])
  const { currency, setCurrency, rate, setRate, convert } = useDisplayCurrency()
  const [chartExpanded, setChartExpanded] = useState(false)

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [ingresosBag, setIngresosBag] = useState<MoneyBag>({})
  const [costosBag, setCostosBag] = useState<MoneyBag>({})

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setChartExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    async function loadUpcoming() {
      const in90 = new Date()
      in90.setDate(in90.getDate() + 90)
      const { data } = await supabase
        .from('investment_income')
        .select('*, investments(nombre)')
        .eq('estado', 'programado')
        .lte('fecha', in90.toISOString().slice(0, 10))
        .order('fecha')
      const rows = (data ?? []).map((r: any) => ({ ...r, investment_nombre: r.investments?.nombre ?? '' }))
      setUpcomingIncome(rows)
    }
    async function loadEvents() {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('events')
        .select('*')
        .gte('fecha', today)
        .order('fecha')
        .limit(5)
      setUpcomingEvents((data as AppEvent[]) ?? [])
    }
    generateDueRecurringIncome(profileRef.current).finally(() => {
      loadUpcoming()
      loadEvents()
    })
  }, [])

  useEffect(() => {
    async function loadMes() {
      const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
      const ultimoDia = new Date(anio, mes, 0).getDate()
      const hasta = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`
      const [{ data: inc }, { data: cst }] = await Promise.all([
        supabase.from('investment_income').select('monto, moneda').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('investment_costs').select('monto, moneda').gte('fecha', desde).lte('fecha', hasta),
      ])
      const toBag = (rows: { monto: number; moneda: string }[] | null) =>
        (rows ?? []).reduce((acc, row) => addToBag(acc, row.moneda, row.monto), {} as MoneyBag)
      setIngresosBag(toBag(inc))
      setCostosBag(toBag(cst))
    }
    loadMes()
  }, [mes, anio])

  const netoBag = useMemo(() => subtractBags(ingresosBag, costosBag), [ingresosBag, costosBag])

  const patrimonioTotal = useMemo(
    () => convert(investments.reduce((sum, inv) => sum + toBase(inv, inv.valor_actual), 0)),
    [investments, convert]
  )

  const porCategoria = useMemo(
    () =>
      categories
        .map((cat) => {
          const catInv = investments.filter((i) => i.category_id === cat.id)
          const value = convert(catInv.reduce((sum, i) => sum + toBase(i, i.valor_actual), 0))
          return { name: cat.nombre, value }
        })
        .filter((c) => c.value > 0),
    [categories, investments, convert]
  )

  const gananciaRevalorizacion = useMemo(
    () => convert(investments.reduce((sum, inv) => sum + toBase(inv, gainLoss(inv)), 0)),
    [investments, convert]
  )

  const today = new Date()
  const in30 = new Date()
  in30.setDate(today.getDate() + 30)

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i)

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold text-ink">Inicio</h1>
        <CurrencySelector currency={currency} onCurrencyChange={setCurrency} rate={rate} onRateChange={setRate} />
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-paper border border-line rounded-2xl p-6">
          <p className="text-ink-soft text-sm">Patrimonio total ({currency})</p>
          <p className="text-4xl font-semibold text-ink mt-1">{formatMoney(patrimonioTotal, currency)}</p>
        </div>
        <div className="bg-paper border border-line rounded-2xl p-6">
          <p className="text-ink-soft text-sm">Ganancia por revalorización ({currency})</p>
          <p className={`text-4xl font-semibold mt-1 ${gananciaRevalorizacion >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
            {formatMoney(gananciaRevalorizacion, currency)}
          </p>
          <p className="text-xs text-ink-soft mt-1">Valor actual vs. valor de compra, de todas las inversiones.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-ink-soft text-sm">Resultado del mes</p>
          <div className="flex gap-2">
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-line text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-line text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-paper border border-line rounded-2xl p-6">
            <p className="text-sm text-ink-soft">Ingresos</p>
            <p className="text-2xl font-semibold text-sage-dark break-words mt-1">
              {formatBag(ingresosBag, currency)}
            </p>
          </div>
          <div className="bg-paper border border-line rounded-2xl p-6">
            <p className="text-sm text-ink-soft">Costos</p>
            <p className="text-2xl font-semibold text-rose break-words mt-1">{formatBag(costosBag, currency)}</p>
          </div>
          <div className="bg-paper border border-line rounded-2xl p-6">
            <p className="text-sm text-ink-soft">Resultado neto</p>
            <p
              className={`text-2xl font-semibold break-words mt-1 ${
                bagHasNegative(netoBag) ? 'text-rose' : 'text-sage-dark'
              }`}
            >
              {formatBag(netoBag, currency)}
            </p>
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          Ingresos y costos cargados en {MONTHS[mes - 1]} {anio}, agrupados por moneda.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">Desglose por categoría</h2>
            {porCategoria.length > 0 && (
              <button
                onClick={() => setChartExpanded(true)}
                title="Ver en pantalla completa"
                className="text-ink-soft hover:text-terracotta text-lg leading-none px-1"
              >
                ⤢
              </button>
            )}
          </div>
          {porCategoria.length === 0 ? (
            <p className="text-ink-soft text-sm">Cargá inversiones para ver el desglose.</p>
          ) : (
            <PieWithLegend data={porCategoria} total={patrimonioTotal} currency={currency} height={240} />
          )}
        </section>

        <section className="bg-paper border border-line rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Próximos cobros (90 días)</h2>
          {upcomingIncome.length === 0 ? (
            <p className="text-ink-soft text-sm">No hay cobros programados próximamente.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingIncome.map((inc) => {
                const fecha = new Date(inc.fecha + 'T00:00:00')
                const isUrgent = fecha <= in30
                return (
                  <li key={inc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink">{inc.concepto}</p>
                      <p className="text-sm text-ink-soft">{inc.investment_nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-ink">{formatDate(inc.fecha)}</p>
                      {isUrgent && (
                        <span className="text-xs font-medium text-gold">Próximo a vencer</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Próximos eventos</h2>
          <Link to="/eventos" className="text-sm font-medium text-terracotta hover:text-terracotta-dark">
            Ver todos
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No hay eventos próximos. <Link to="/eventos" className="text-terracotta">Agregar uno</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {upcomingEvents.map((ev) => (
              <li key={ev.id} className="py-3 flex items-center justify-between">
                <p className="font-medium text-ink">{ev.titulo}</p>
                <p className="text-sm text-ink-soft">{formatDate(ev.fecha)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Ganancia/Pérdida por inversión</h2>
        {investments.length === 0 ? (
          <p className="text-ink-soft text-sm">
            Todavía no cargaste inversiones. <Link to="/inversiones" className="text-terracotta">Empezá acá</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm text-ink-soft border-b border-line">
                  <th className="py-2 pr-4 font-medium">Inversión</th>
                  <th className="py-2 pr-4 font-medium">Categoría</th>
                  <th className="py-2 pr-4 font-medium">Ganancia/Pérdida ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const catName = categories.find((c) => c.id === inv.category_id)?.nombre ?? '-'
                  const glConverted = convert(toBase(inv, gainLoss(inv)))
                  return (
                    <tr key={inv.id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-4">
                        <Link to={`/inversiones/${inv.id}`} className="font-medium text-ink hover:text-terracotta">
                          {inv.nombre}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{catName}</td>
                      <td className={`py-3 pr-4 font-medium ${glConverted >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
                        {formatMoney(glConverted, currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {chartExpanded && (
        <div className="fixed inset-0 bg-cream z-50 flex flex-col">
          <div className="border-b border-line bg-paper px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink">Desglose por categoría</h2>
            <button
              onClick={() => setChartExpanded(false)}
              className="px-4 py-2 rounded-xl text-ink-soft hover:text-ink hover:bg-cream text-lg font-medium"
            >
              Cerrar ✕
            </button>
          </div>
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
            <PieWithLegend data={porCategoria} total={patrimonioTotal} currency={currency} height={480} large />
          </div>
        </div>
      )}
    </div>
  )
}

// Gráfico de torta sin etiquetas encima de las porciones (se superponían
// y se volvían ilegibles con muchas categorías). En su lugar, una lista
// con el color, nombre y porcentaje de cada una al lado del gráfico.
function PieWithLegend({
  data,
  total,
  currency,
  height,
  large,
}: {
  data: { name: string; value: number }[]
  total: number
  currency: string
  height: number
  large?: boolean
}) {
  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <ResponsiveContainer width="100%" height={height} className="lg:flex-1">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={large ? '85%' : 100}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full lg:w-64 shrink-0 space-y-2">
        {data.map((c, i) => (
          <li key={c.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="flex-1 min-w-0 truncate text-ink">{c.name}</span>
            <span className="text-ink-soft shrink-0">{total ? ((c.value / total) * 100).toFixed(0) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
