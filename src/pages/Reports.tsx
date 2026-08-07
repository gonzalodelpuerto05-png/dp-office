import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabase'
import { useCategoriesWithInvestments } from '../hooks/useCategories'
import { useProfiles } from '../hooks/useProfiles'
import { toBase, gainLoss, gainLossPercent, formatDate, formatMoney } from '../lib/format'
import type { InvestmentIncome, InvestmentCost, TaskCard } from '../types'
import { BASE_CURRENCY } from '../types'
import { useDisplayCurrency } from '../hooks/useDisplayCurrency'
import CurrencySelector from '../components/CurrencySelector'

type Periodo = 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'personalizado'

function rangoPorPeriodo(periodo: Periodo, desde: string, hasta: string) {
  if (periodo === 'personalizado') return { desde, hasta }
  const hoy = new Date()
  const fin = hoy.toISOString().slice(0, 10)
  const inicio = new Date(hoy)
  if (periodo === 'semanal') inicio.setDate(hoy.getDate() - 7)
  if (periodo === 'mensual') inicio.setMonth(hoy.getMonth() - 1)
  if (periodo === 'trimestral') inicio.setMonth(hoy.getMonth() - 3)
  if (periodo === 'semestral') inicio.setMonth(hoy.getMonth() - 6)
  if (periodo === 'anual') inicio.setFullYear(hoy.getFullYear() - 1)
  return { desde: inicio.toISOString().slice(0, 10), hasta: fin }
}

async function fetchPeriodData(d: string, h: string) {
  const [{ data: incomeData }, { data: costsData }, { data: tasksData }] = await Promise.all([
    supabase.from('investment_income').select('*').gte('fecha', d).lte('fecha', h),
    supabase.from('investment_costs').select('*').gte('fecha', d).lte('fecha', h),
    supabase
      .from('tasks')
      .select('*')
      .eq('completada', true)
      .gte('fecha_completada', d)
      .lte('fecha_completada', h + 'T23:59:59'),
  ])
  return {
    income: (incomeData as InvestmentIncome[]) ?? [],
    costs: (costsData as InvestmentCost[]) ?? [],
    tasks: (tasksData as TaskCard[]) ?? [],
  }
}

export default function Reports() {
  const { categories, investments } = useCategoriesWithInvestments()
  const { profiles } = useProfiles()
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const [desde, setDesde] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [generating, setGenerating] = useState(false)
  const [generatingExcel, setGeneratingExcel] = useState(false)
  const { currency, setCurrency, rate, setRate, convert } = useDisplayCurrency()

  async function generar() {
    setGenerating(true)
    try {
      const { desde: d, hasta: h } = rangoPorPeriodo(periodo, desde, hasta)
      const { income, costs, tasks } = await fetchPeriodData(d, h)

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 20

      doc.setFontSize(20)
      doc.text('DP Office — Informe', 14, y)
      y += 8
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Período: ${formatDate(d)} — ${formatDate(h)}`, 14, y)
      y += 6
      if (currency !== BASE_CURRENCY) {
        doc.text(`Montos consolidados en ${currency} (1 ${BASE_CURRENCY} = ${rate} ${currency})`, 14, y)
        y += 6
      }
      doc.setTextColor(0)
      y += 6

      const patrimonioTotal = convert(investments.reduce((sum, inv) => sum + toBase(inv, inv.valor_actual), 0))
      const gananciaTotal = convert(investments.reduce((sum, inv) => sum + toBase(inv, gainLoss(inv)), 0))

      doc.setFontSize(14)
      doc.text('Resumen ejecutivo', 14, y)
      y += 8
      doc.setFontSize(11)
      doc.text(`Patrimonio total: ${formatMoney(patrimonioTotal, currency)}`, 14, y)
      y += 6
      doc.text(`Ganancia / Pérdida total: ${formatMoney(gananciaTotal, currency)}`, 14, y)
      y += 10

      autoTable(doc, {
        startY: y,
        head: [['Categoría', `Valor (${currency})`, '% del total']],
        body: categories
          .map((cat) => {
            const catInv = investments.filter((i) => i.category_id === cat.id)
            const value = convert(catInv.reduce((sum, i) => sum + toBase(i, i.valor_actual), 0))
            return [cat.nombre, formatMoney(value, currency), patrimonioTotal ? `${((value / patrimonioTotal) * 100).toFixed(1)}%` : '0%']
          })
          .filter((row) => row[1] !== formatMoney(0, currency)),
        theme: 'striped',
        headStyles: { fillColor: [196, 99, 63] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 12

      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(14)
      doc.text('Inversiones', 14, y)
      y += 4
      autoTable(doc, {
        startY: y + 4,
        head: [['Inversión', 'Categoría', 'Valor actual', 'Ganancia/Pérdida', 'Rentabilidad']],
        body: investments.map((inv) => {
          const catName = categories.find((c) => c.id === inv.category_id)?.nombre ?? '-'
          return [
            inv.nombre,
            catName,
            formatMoney(inv.valor_actual, inv.moneda),
            formatMoney(gainLoss(inv), inv.moneda),
            `${gainLossPercent(inv).toFixed(1)}%`,
          ]
        }),
        theme: 'striped',
        headStyles: { fillColor: [196, 99, 63] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 12

      if (y > 240) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(14)
      doc.text('Ingresos del período', 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Fecha', 'Inversión', 'Concepto', 'Monto', 'Estado']],
        body: income.map((i) => {
          const inv = investments.find((v) => v.id === i.investment_id)
          return [formatDate(i.fecha), inv?.nombre ?? '-', i.concepto, formatMoney(i.monto, inv?.moneda ?? BASE_CURRENCY), i.estado]
        }),
        theme: 'striped',
        headStyles: { fillColor: [111, 143, 106] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 12

      if (y > 240) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(14)
      doc.text('Costos del período', 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Fecha', 'Inversión', 'Concepto', 'Monto']],
        body: costs.map((c) => {
          const inv = investments.find((v) => v.id === c.investment_id)
          return [formatDate(c.fecha), inv?.nombre ?? '-', c.concepto, formatMoney(c.monto, inv?.moneda ?? BASE_CURRENCY)]
        }),
        theme: 'striped',
        headStyles: { fillColor: [180, 73, 79] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 12

      if (y > 240) {
        doc.addPage()
        y = 20
      }
      doc.setFontSize(14)
      doc.text('Tareas completadas por responsable', 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Responsable', 'Tarea', 'Fecha completada']],
        body: tasks.map((t) => [
          profiles.find((p) => p.id === t.asignado_a)?.nombre ?? 'Sin asignar',
          t.titulo,
          t.fecha_completada ? formatDate(t.fecha_completada.slice(0, 10)) : '-',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [201, 154, 60] },
        margin: { left: 14, right: 14 },
      })

      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(150)
        doc.text(`DP Office — generado el ${formatDate(new Date().toISOString().slice(0, 10))}`, 14, doc.internal.pageSize.getHeight() - 10)
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10)
      }

      doc.save(`dp-office-informe-${d}-a-${h}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  async function generarExcel() {
    setGeneratingExcel(true)
    try {
      const { desde: d, hasta: h } = rangoPorPeriodo(periodo, desde, hasta)
      const { income, costs, tasks } = await fetchPeriodData(d, h)

      const patrimonioTotal = convert(investments.reduce((sum, inv) => sum + toBase(inv, inv.valor_actual), 0))
      const gananciaTotal = convert(investments.reduce((sum, inv) => sum + toBase(inv, gainLoss(inv)), 0))

      const wb = new ExcelJS.Workbook()
      wb.creator = 'DP Office'
      wb.created = new Date()

      const headerStyle = { font: { bold: true } }

      const resumen = wb.addWorksheet('Resumen')
      resumen.columns = [{ width: 28 }, { width: 20 }]
      resumen.addRow(['Período', `${d} a ${h}`])
      resumen.addRow(['Moneda', currency])
      if (currency !== BASE_CURRENCY) resumen.addRow([`1 ${BASE_CURRENCY} =`, rate])
      resumen.addRow([`Patrimonio total (${currency})`, patrimonioTotal])
      resumen.addRow([`Ganancia / Pérdida total (${currency})`, gananciaTotal])

      const porCategoria = wb.addWorksheet('Por categoría')
      porCategoria.columns = [
        { header: 'Categoría', key: 'categoria', width: 24 },
        { header: `Valor (${currency})`, key: 'valor', width: 18 },
        { header: '% del total', key: 'pct', width: 14 },
      ]
      porCategoria.getRow(1).font = headerStyle.font
      categories.forEach((cat) => {
        const catInv = investments.filter((i) => i.category_id === cat.id)
        const value = convert(catInv.reduce((sum, i) => sum + toBase(i, i.valor_actual), 0))
        if (value === 0) return
        porCategoria.addRow({
          categoria: cat.nombre,
          valor: Number(value.toFixed(2)),
          pct: patrimonioTotal ? Number(((value / patrimonioTotal) * 100).toFixed(1)) : 0,
        })
      })

      const invSheet = wb.addWorksheet('Inversiones')
      invSheet.columns = [
        { header: 'Inversión', key: 'nombre', width: 28 },
        { header: 'Categoría', key: 'categoria', width: 20 },
        { header: 'Moneda', key: 'moneda', width: 10 },
        { header: 'Valor de compra', key: 'compra', width: 16 },
        { header: 'Valor actual', key: 'actual', width: 16 },
        { header: 'Ganancia/Pérdida', key: 'gl', width: 16 },
        { header: 'Rentabilidad %', key: 'rent', width: 14 },
      ]
      invSheet.getRow(1).font = headerStyle.font
      investments.forEach((inv) => {
        const catName = categories.find((c) => c.id === inv.category_id)?.nombre ?? '-'
        invSheet.addRow({
          nombre: inv.nombre,
          categoria: catName,
          moneda: inv.moneda,
          compra: inv.valor_compra,
          actual: inv.valor_actual,
          gl: Number(gainLoss(inv).toFixed(2)),
          rent: Number(gainLossPercent(inv).toFixed(1)),
        })
      })

      const incomeSheet = wb.addWorksheet('Ingresos')
      incomeSheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Inversión', key: 'inversion', width: 24 },
        { header: 'Concepto', key: 'concepto', width: 24 },
        { header: 'Moneda', key: 'moneda', width: 10 },
        { header: 'Monto', key: 'monto', width: 14 },
        { header: 'Estado', key: 'estado', width: 14 },
      ]
      incomeSheet.getRow(1).font = headerStyle.font
      income.forEach((i) => {
        const inv = investments.find((v) => v.id === i.investment_id)
        incomeSheet.addRow({
          fecha: i.fecha,
          inversion: inv?.nombre ?? '-',
          concepto: i.concepto,
          moneda: inv?.moneda ?? BASE_CURRENCY,
          monto: i.monto,
          estado: i.estado,
        })
      })

      const costsSheet = wb.addWorksheet('Costos')
      costsSheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Inversión', key: 'inversion', width: 24 },
        { header: 'Concepto', key: 'concepto', width: 24 },
        { header: 'Moneda', key: 'moneda', width: 10 },
        { header: 'Monto', key: 'monto', width: 14 },
      ]
      costsSheet.getRow(1).font = headerStyle.font
      costs.forEach((c) => {
        const inv = investments.find((v) => v.id === c.investment_id)
        costsSheet.addRow({
          fecha: c.fecha,
          inversion: inv?.nombre ?? '-',
          concepto: c.concepto,
          moneda: inv?.moneda ?? BASE_CURRENCY,
          monto: c.monto,
        })
      })

      const tasksSheet = wb.addWorksheet('Tareas completadas')
      tasksSheet.columns = [
        { header: 'Responsable', key: 'responsable', width: 20 },
        { header: 'Tarea', key: 'tarea', width: 30 },
        { header: 'Fecha completada', key: 'fecha', width: 18 },
      ]
      tasksSheet.getRow(1).font = headerStyle.font
      tasks.forEach((t) => {
        tasksSheet.addRow({
          responsable: profiles.find((p) => p.id === t.asignado_a)?.nombre ?? 'Sin asignar',
          tarea: t.titulo,
          fecha: t.fecha_completada ? t.fecha_completada.slice(0, 10) : '-',
        })
      })

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dp-office-informe-${d}-a-${h}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingExcel(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-3xl font-semibold text-ink">Reportes</h1>

      <section className="bg-paper border border-line rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Moneda del informe</label>
          <CurrencySelector currency={currency} onCurrencyChange={setCurrency} rate={rate} onRateChange={setRate} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Período</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
          >
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        {periodo === 'personalizado' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-line text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-line text-lg"
              />
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={generar}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-terracotta text-white font-medium text-lg hover:bg-terracotta-dark disabled:opacity-60"
          >
            {generating ? 'Generando...' : 'Descargar PDF'}
          </button>
          <button
            onClick={generarExcel}
            disabled={generatingExcel}
            className="w-full py-3 rounded-xl border border-line text-ink font-medium text-lg hover:bg-cream disabled:opacity-60"
          >
            {generatingExcel ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      </section>
    </div>
  )
}
