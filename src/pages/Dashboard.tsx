import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useCategoriesWithInvestments } from '../hooks/useCategories'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InvestmentIncome } from '../types'
import { formatARS, toARS, gainLoss, formatDate } from '../lib/format'

const PIE_COLORS = ['#c4633f', '#6f8f6a', '#c99a3c', '#b4494f', '#7c8fb0', '#9a7bb0']

export default function Dashboard() {
  const { categories, investments, loading } = useCategoriesWithInvestments()
  const [upcomingIncome, setUpcomingIncome] = useState<(InvestmentIncome & { investment_nombre: string })[]>([])

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
    loadUpcoming()
  }, [])

  const patrimonioTotal = useMemo(
    () => investments.reduce((sum, inv) => sum + toARS(inv, inv.valor_actual), 0),
    [investments]
  )

  const porCategoria = useMemo(
    () =>
      categories
        .map((cat) => {
          const catInv = investments.filter((i) => i.category_id === cat.id)
          const value = catInv.reduce((sum, i) => sum + toARS(i, i.valor_actual), 0)
          return { name: cat.nombre, value }
        })
        .filter((c) => c.value > 0),
    [categories, investments]
  )

  const gananciaTotal = useMemo(
    () => investments.reduce((sum, inv) => sum + toARS(inv, gainLoss(inv)), 0),
    [investments]
  )

  const today = new Date()
  const in30 = new Date()
  in30.setDate(today.getDate() + 30)

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold text-ink">Inicio</h1>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-paper border border-line rounded-2xl p-6">
          <p className="text-ink-soft text-sm">Patrimonio total (ARS)</p>
          <p className="text-4xl font-semibold text-ink mt-1">{formatARS(patrimonioTotal)}</p>
        </div>
        <div className="bg-paper border border-line rounded-2xl p-6">
          <p className="text-ink-soft text-sm">Ganancia / Pérdida total (ARS)</p>
          <p className={`text-4xl font-semibold mt-1 ${gananciaTotal >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
            {formatARS(gananciaTotal)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Desglose por categoría</h2>
          {porCategoria.length === 0 ? (
            <p className="text-ink-soft text-sm">Cargá inversiones para ver el desglose.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={porCategoria}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name} (${((entry.value / patrimonioTotal) * 100).toFixed(0)}%)`}
                >
                  {porCategoria.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatARS(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
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
                  <th className="py-2 pr-4 font-medium">Ganancia/Pérdida (ARS)</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const catName = categories.find((c) => c.id === inv.category_id)?.nombre ?? '-'
                  const glARS = toARS(inv, gainLoss(inv))
                  return (
                    <tr key={inv.id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-4">
                        <Link to={`/inversiones/${inv.id}`} className="font-medium text-ink hover:text-terracotta">
                          {inv.nombre}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{catName}</td>
                      <td className={`py-3 pr-4 font-medium ${glARS >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
                        {formatARS(glARS)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
