import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import type { Investment, InvestmentIncome, InvestmentCost, Currency, IncomeStatus } from '../../types'
import { BASE_CURRENCY, CURRENCIES } from '../../types'
import { formatMoney, formatDate, gainLoss, gainLossPercent, formatPercent } from '../../lib/format'
import { logActivity } from '../../lib/activity'
import InvestmentFiles from '../../components/InvestmentFiles'

export default function InvestmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profiles } = useProfiles()
  const { profile } = useAuth()

  const [investment, setInvestment] = useState<Investment | null>(null)
  const [income, setIncome] = useState<InvestmentIncome[]>([])
  const [costs, setCosts] = useState<InvestmentCost[]>([])
  const [responsibleIds, setResponsibleIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [editingValue, setEditingValue] = useState(false)
  const [valorActual, setValorActual] = useState('')
  const [notas, setNotas] = useState('')
  const [notasSaved, setNotasSaved] = useState(true)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showCostModal, setShowCostModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<InvestmentIncome | null>(null)
  const [editingCost, setEditingCost] = useState<InvestmentCost | null>(null)

  // No toca "loading": se usa para refrescar después de guardar cualquier
  // cambio (ingreso, costo, valor actual, etc). Si tocara loading, cada
  // guardado colapsaría la página a "Cargando..." y se perdía el scroll.
  const load = useCallback(async () => {
    if (!id) return
    const [{ data: inv }, { data: inc }, { data: cst }, { data: resp }] = await Promise.all([
      supabase.from('investments').select('*').eq('id', id).single(),
      supabase.from('investment_income').select('*').eq('investment_id', id).order('fecha'),
      supabase.from('investment_costs').select('*').eq('investment_id', id).order('fecha'),
      supabase.from('investment_responsibles').select('user_id').eq('investment_id', id),
    ])
    setInvestment(inv as Investment)
    setIncome((inc as InvestmentIncome[]) ?? [])
    setCosts((cst as InvestmentCost[]) ?? [])
    setResponsibleIds((resp as { user_id: string }[])?.map((r) => r.user_id) ?? [])
    if (inv) {
      setValorActual(String((inv as Investment).valor_actual))
      setNotas((inv as Investment).notas ?? '')
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  async function saveValorActual() {
    if (!id || !investment) return
    const nuevo = parseFloat(valorActual) || 0
    await supabase.from('investments').update({ valor_actual: nuevo }).eq('id', id)
    logActivity(
      profile,
      'actualizó el valor actual de',
      'inversión',
      investment.nombre,
      `${formatMoney(investment.valor_actual, investment.moneda)} → ${formatMoney(nuevo, investment.moneda)}`
    )
    setEditingValue(false)
    load()
  }

  async function saveNotas() {
    if (!id) return
    setNotasSaved(false)
    await supabase.from('investments').update({ notas }).eq('id', id)
    setNotasSaved(true)
  }

  async function toggleResponsible(userId: string) {
    if (!id) return
    if (responsibleIds.includes(userId)) {
      await supabase
        .from('investment_responsibles')
        .delete()
        .eq('investment_id', id)
        .eq('user_id', userId)
    } else {
      await supabase.from('investment_responsibles').insert({ investment_id: id, user_id: userId })
    }
    load()
  }

  async function deleteIncome(incomeId: string) {
    if (!investment || !confirm('¿Eliminar este ingreso?')) return
    const item = income.find((i) => i.id === incomeId)
    await supabase.from('investment_income').delete().eq('id', incomeId)
    logActivity(profile, 'eliminó un ingreso de', 'inversión', investment.nombre, item?.concepto)
    load()
  }

  async function deleteCost(costId: string) {
    if (!investment || !confirm('¿Eliminar este costo?')) return
    const item = costs.find((c) => c.id === costId)
    await supabase.from('investment_costs').delete().eq('id', costId)
    logActivity(profile, 'eliminó un costo de', 'inversión', investment.nombre, item?.concepto)
    load()
  }

  async function deleteInvestment() {
    if (!id || !investment || !confirm('¿Eliminar esta inversión? No se puede deshacer.')) return
    await supabase.from('investments').delete().eq('id', id)
    logActivity(profile, 'eliminó', 'inversión', investment.nombre)
    navigate('/inversiones')
  }

  if (loading || !investment) return <p className="text-ink-soft">Cargando...</p>

  const gl = gainLoss(investment)
  const glp = gainLossPercent(investment)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/inversiones" className="text-sm text-ink-soft hover:text-ink">
          ← Volver a inversiones
        </Link>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <h1 className="text-3xl font-semibold text-ink">{investment.nombre}</h1>
          <button
            onClick={deleteInvestment}
            className="px-4 py-2 rounded-lg border border-line text-sm font-medium text-rose hover:bg-rose/10"
          >
            Eliminar inversión
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">Compra</h2>
            <button
              onClick={() => setShowEditModal(true)}
              className="text-sm font-medium text-terracotta hover:text-terracotta-dark"
            >
              Editar
            </button>
          </div>
          <dl className="space-y-2 text-base">
            <Row label="Nombre" value={investment.nombre} />
            <Row label="Fecha" value={formatDate(investment.fecha_compra)} />
            <Row label="Valor de compra" value={formatMoney(investment.valor_compra, investment.moneda)} />
            <Row label="Moneda" value={investment.moneda} />
            {investment.moneda !== BASE_CURRENCY && (
              <Row label="Cotización usada" value={investment.cotizacion.toLocaleString('es-UY')} />
            )}
          </dl>
        </section>

        <section className="bg-paper border border-line rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Valor actual</h2>
          {editingValue ? (
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                autoFocus
                value={valorActual}
                onChange={(e) => setValorActual(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl border border-line text-lg"
              />
              <button
                onClick={saveValorActual}
                className="px-4 py-2 rounded-xl bg-terracotta text-white font-medium"
              >
                Guardar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-2xl font-semibold text-ink">
                {formatMoney(investment.valor_actual, investment.moneda)}
              </p>
              <button
                onClick={() => setEditingValue(true)}
                className="text-sm font-medium text-terracotta hover:text-terracotta-dark"
              >
                Editar
              </button>
            </div>
          )}
          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-sm text-ink-soft">Ganancia/Pérdida</p>
              <p className={`text-lg font-semibold ${gl >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
                {formatMoney(gl, investment.moneda)}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Rentabilidad</p>
              <p className={`text-lg font-semibold ${glp >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
                {formatPercent(glp)}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Ingresos</h2>
          <button
            onClick={() => setShowIncomeModal(true)}
            className="px-4 py-2 rounded-lg bg-sage text-white text-sm font-medium hover:bg-sage-dark"
          >
            + Ingreso
          </button>
        </div>
        {income.length === 0 ? (
          <p className="text-ink-soft text-sm">Sin ingresos cargados.</p>
        ) : (
          <IncomeCostTable
            rows={income.map((i) => ({
              id: i.id,
              fecha: i.fecha,
              monto: i.monto,
              moneda: i.moneda,
              concepto: i.concepto,
              estado: i.estado,
            }))}
            onEdit={(row) => setEditingIncome(income.find((i) => i.id === row.id) ?? null)}
            onDelete={deleteIncome}
          />
        )}
      </section>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Costos</h2>
          <button
            onClick={() => setShowCostModal(true)}
            className="px-4 py-2 rounded-lg bg-sage text-white text-sm font-medium hover:bg-sage-dark"
          >
            + Costo
          </button>
        </div>
        {costs.length === 0 ? (
          <p className="text-ink-soft text-sm">Sin costos cargados.</p>
        ) : (
          <IncomeCostTable
            rows={costs.map((c) => ({
              id: c.id,
              fecha: c.fecha,
              monto: c.monto,
              moneda: c.moneda,
              concepto: c.concepto,
            }))}
            onEdit={(row) => setEditingCost(costs.find((c) => c.id === row.id) ?? null)}
            onDelete={deleteCost}
          />
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Responsables</h2>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => {
              const active = responsibleIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleResponsible(p.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-terracotta text-white border-terracotta'
                      : 'border-line text-ink-soft hover:text-ink'
                  }`}
                >
                  {p.nombre}
                </button>
              )
            })}
          </div>
        </section>

        <section className="bg-paper border border-line rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">Notas</h2>
            <span className="text-xs text-ink-soft">{notasSaved ? 'Guardado' : 'Guardando...'}</span>
          </div>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={saveNotas}
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-line text-base resize-none"
            placeholder="Anotaciones sobre esta inversión..."
          />
        </section>
      </div>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Documentos</h2>
        <InvestmentFiles investmentId={id!} investmentNombre={investment.nombre} />
      </section>

      {showEditModal && (
        <EditInvestmentModal
          investment={investment}
          onClose={() => setShowEditModal(false)}
          onSaved={load}
        />
      )}
      {showIncomeModal && (
        <IncomeModal
          investmentId={id!}
          investmentNombre={investment.nombre}
          investmentMoneda={investment.moneda}
          onClose={() => setShowIncomeModal(false)}
          onSaved={load}
        />
      )}
      {editingIncome && (
        <IncomeModal
          investmentId={id!}
          investmentNombre={investment.nombre}
          investmentMoneda={investment.moneda}
          existing={editingIncome}
          onClose={() => setEditingIncome(null)}
          onSaved={load}
        />
      )}
      {showCostModal && (
        <CostModal
          investmentId={id!}
          investmentNombre={investment.nombre}
          investmentMoneda={investment.moneda}
          onClose={() => setShowCostModal(false)}
          onSaved={load}
        />
      )}
      {editingCost && (
        <CostModal
          investmentId={id!}
          investmentNombre={investment.nombre}
          investmentMoneda={investment.moneda}
          existing={editingCost}
          onClose={() => setEditingCost(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function EditInvestmentModal({
  investment,
  onClose,
  onSaved,
}: {
  investment: Investment
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [nombre, setNombre] = useState(investment.nombre)
  const [moneda, setMoneda] = useState<Currency>(investment.moneda)
  const [cotizacion, setCotizacion] = useState(String(investment.cotizacion))
  const [valorCompra, setValorCompra] = useState(String(investment.valor_compra))
  const [fechaCompra, setFechaCompra] = useState(investment.fecha_compra)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!nombre.trim() || !valorCompra) return
    setSaving(true)
    await supabase
      .from('investments')
      .update({
        nombre: nombre.trim(),
        moneda,
        cotizacion: moneda === BASE_CURRENCY ? 1 : parseFloat(cotizacion) || 1,
        valor_compra: parseFloat(valorCompra),
        fecha_compra: fechaCompra,
      })
      .eq('id', investment.id)
    logActivity(profile, 'editó los datos de compra de', 'inversión', nombre.trim())
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal title="Editar inversión" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Nombre</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Currency)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'OTHER' ? 'Otra' : c}
                </option>
              ))}
            </select>
          </div>
          {moneda !== BASE_CURRENCY && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Cotización a {BASE_CURRENCY}</label>
              <input
                type="number"
                step="0.01"
                value={cotizacion}
                onChange={(e) => setCotizacion(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-line text-lg"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Valor de compra</label>
            <input
              type="number"
              step="0.01"
              value={valorCompra}
              onChange={(e) => setValorCompra(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Fecha de compra</label>
            <input
              type="date"
              value={fechaCompra}
              onChange={(e) => setFechaCompra(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            />
          </div>
        </div>
        <button
          disabled={saving}
          onClick={save}
          className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}

function IncomeCostTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: { id: string; fecha: string; monto: number; moneda: Currency; concepto: string; estado?: IncomeStatus }[]
  onEdit: (row: { id: string }) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm text-ink-soft border-b border-line">
            <th className="py-2 pr-4 font-medium">Fecha</th>
            <th className="py-2 pr-4 font-medium">Concepto</th>
            <th className="py-2 pr-4 font-medium">Monto</th>
            {rows[0]?.estado !== undefined && <th className="py-2 pr-4 font-medium">Estado</th>}
            <th className="py-2 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4">{formatDate(row.fecha)}</td>
              <td className="py-3 pr-4">{row.concepto}</td>
              <td className="py-3 pr-4">{formatMoney(row.monto, row.moneda)}</td>
              {row.estado !== undefined && (
                <td className="py-3 pr-4">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      row.estado === 'cobrado' ? 'bg-sage/20 text-sage-dark' : 'bg-gold/20 text-gold'
                    }`}
                  >
                    {row.estado === 'cobrado' ? 'Cobrado' : 'Programado'}
                  </span>
                </td>
              )}
              <td className="py-3 pr-4 text-right whitespace-nowrap">
                <button
                  onClick={() => onEdit(row)}
                  className="text-sm font-medium text-terracotta hover:text-terracotta-dark mr-3"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(row.id)}
                  className="text-sm font-medium text-rose hover:text-rose/70"
                >
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IncomeModal({
  investmentId,
  investmentNombre,
  investmentMoneda,
  existing,
  onClose,
  onSaved,
}: {
  investmentId: string
  investmentNombre: string
  investmentMoneda: Currency
  existing?: InvestmentIncome
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState(String(existing?.monto ?? ''))
  const [moneda, setMoneda] = useState<Currency>(existing?.moneda ?? investmentMoneda)
  const [concepto, setConcepto] = useState(existing?.concepto ?? '')
  const [estado, setEstado] = useState<IncomeStatus>(existing?.estado ?? 'programado')

  async function save() {
    if (!monto || !concepto.trim()) return
    const payload = {
      investment_id: investmentId,
      fecha,
      monto: parseFloat(monto),
      moneda,
      concepto: concepto.trim(),
      estado,
    }
    if (existing) {
      await supabase.from('investment_income').update(payload).eq('id', existing.id)
      logActivity(profile, 'editó un ingreso de', 'inversión', investmentNombre, concepto.trim())
    } else {
      await supabase.from('investment_income').insert(payload)
      logActivity(profile, 'agregó un ingreso a', 'inversión', investmentNombre, concepto.trim())
    }
    onSaved()
    onClose()
  }

  return (
    <Modal title={existing ? 'Editar ingreso' : 'Nuevo ingreso'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Concepto</label>
          <input
            autoFocus
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            placeholder="Ej: Alquiler mensual"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-sm font-medium text-ink mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Currency)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'OTHER' ? 'Otra' : c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as IncomeStatus)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            >
              <option value="programado">Programado</option>
              <option value="cobrado">Cobrado</option>
            </select>
          </div>
        </div>
        <button
          onClick={save}
          className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark"
        >
          {existing ? 'Guardar cambios' : 'Agregar ingreso'}
        </button>
      </div>
    </Modal>
  )
}

function CostModal({
  investmentId,
  investmentNombre,
  investmentMoneda,
  existing,
  onClose,
  onSaved,
}: {
  investmentId: string
  investmentNombre: string
  investmentMoneda: Currency
  existing?: InvestmentCost
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState(String(existing?.monto ?? ''))
  const [moneda, setMoneda] = useState<Currency>(existing?.moneda ?? investmentMoneda)
  const [concepto, setConcepto] = useState(existing?.concepto ?? '')

  async function save() {
    if (!monto || !concepto.trim()) return
    const payload = { investment_id: investmentId, fecha, monto: parseFloat(monto), moneda, concepto: concepto.trim() }
    if (existing) {
      await supabase.from('investment_costs').update(payload).eq('id', existing.id)
      logActivity(profile, 'editó un costo de', 'inversión', investmentNombre, concepto.trim())
    } else {
      await supabase.from('investment_costs').insert(payload)
      logActivity(profile, 'agregó un costo a', 'inversión', investmentNombre, concepto.trim())
    }
    onSaved()
    onClose()
  }

  return (
    <Modal title={existing ? 'Editar costo' : 'Nuevo costo'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Concepto</label>
          <input
            autoFocus
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            placeholder="Ej: Impuesto municipal"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-sm font-medium text-ink mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Moneda</label>
          <select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as Currency)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === 'OTHER' ? 'Otra' : c}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark"
        >
          {existing ? 'Guardar cambios' : 'Agregar costo'}
        </button>
      </div>
    </Modal>
  )
}
