import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfiles } from '../../hooks/useProfiles'
import Modal from '../../components/Modal'
import type { Investment, InvestmentIncome, InvestmentCost, Currency, IncomeStatus } from '../../types'
import { formatMoney, formatDate, gainLoss, gainLossPercent, formatPercent } from '../../lib/format'

export default function InvestmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profiles } = useProfiles()

  const [investment, setInvestment] = useState<Investment | null>(null)
  const [income, setIncome] = useState<InvestmentIncome[]>([])
  const [costs, setCosts] = useState<InvestmentCost[]>([])
  const [responsibleIds, setResponsibleIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [editingValue, setEditingValue] = useState(false)
  const [valorActual, setValorActual] = useState('')
  const [notas, setNotas] = useState('')
  const [notasSaved, setNotasSaved] = useState(true)

  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showCostModal, setShowCostModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<InvestmentIncome | null>(null)
  const [editingCost, setEditingCost] = useState<InvestmentCost | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
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
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function saveValorActual() {
    if (!id) return
    await supabase.from('investments').update({ valor_actual: parseFloat(valorActual) || 0 }).eq('id', id)
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
    if (!confirm('¿Eliminar este ingreso?')) return
    await supabase.from('investment_income').delete().eq('id', incomeId)
    load()
  }

  async function deleteCost(costId: string) {
    if (!confirm('¿Eliminar este costo?')) return
    await supabase.from('investment_costs').delete().eq('id', costId)
    load()
  }

  async function deleteInvestment() {
    if (!id || !confirm('¿Eliminar esta inversión? No se puede deshacer.')) return
    await supabase.from('investments').delete().eq('id', id)
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
          <h2 className="text-lg font-semibold text-ink mb-4">Compra</h2>
          <dl className="space-y-2 text-base">
            <Row label="Fecha" value={formatDate(investment.fecha_compra)} />
            <Row label="Valor de compra" value={formatMoney(investment.valor_compra, investment.moneda)} />
            <Row label="Moneda" value={investment.moneda} />
            {investment.moneda !== 'ARS' && (
              <Row label="Cotización usada" value={investment.cotizacion.toLocaleString('es-AR')} />
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
              concepto: i.concepto,
              estado: i.estado,
            }))}
            currency={investment.moneda}
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
            rows={costs.map((c) => ({ id: c.id, fecha: c.fecha, monto: c.monto, concepto: c.concepto }))}
            currency={investment.moneda}
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

      {showIncomeModal && (
        <IncomeModal
          investmentId={id!}
          onClose={() => setShowIncomeModal(false)}
          onSaved={load}
        />
      )}
      {editingIncome && (
        <IncomeModal
          investmentId={id!}
          existing={editingIncome}
          onClose={() => setEditingIncome(null)}
          onSaved={load}
        />
      )}
      {showCostModal && (
        <CostModal investmentId={id!} onClose={() => setShowCostModal(false)} onSaved={load} />
      )}
      {editingCost && (
        <CostModal
          investmentId={id!}
          existing={editingCost}
          onClose={() => setEditingCost(null)}
          onSaved={load}
        />
      )}
    </div>
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
  currency,
  onEdit,
  onDelete,
}: {
  rows: { id: string; fecha: string; monto: number; concepto: string; estado?: IncomeStatus }[]
  currency: Currency
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
              <td className="py-3 pr-4">{formatMoney(row.monto, currency)}</td>
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
  existing,
  onClose,
  onSaved,
}: {
  investmentId: string
  existing?: InvestmentIncome
  onClose: () => void
  onSaved: () => void
}) {
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState(String(existing?.monto ?? ''))
  const [concepto, setConcepto] = useState(existing?.concepto ?? '')
  const [estado, setEstado] = useState<IncomeStatus>(existing?.estado ?? 'programado')

  async function save() {
    if (!monto || !concepto.trim()) return
    const payload = { investment_id: investmentId, fecha, monto: parseFloat(monto), concepto: concepto.trim(), estado }
    if (existing) {
      await supabase.from('investment_income').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('investment_income').insert(payload)
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
  existing,
  onClose,
  onSaved,
}: {
  investmentId: string
  existing?: InvestmentCost
  onClose: () => void
  onSaved: () => void
}) {
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState(String(existing?.monto ?? ''))
  const [concepto, setConcepto] = useState(existing?.concepto ?? '')

  async function save() {
    if (!monto || !concepto.trim()) return
    const payload = { investment_id: investmentId, fecha, monto: parseFloat(monto), concepto: concepto.trim() }
    if (existing) {
      await supabase.from('investment_costs').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('investment_costs').insert(payload)
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
