import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCategoriesWithInvestments } from '../hooks/useCategories'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import type { Currency, Investment } from '../types'
import { CURRENCIES, BASE_CURRENCY } from '../types'
import { formatMoney, gainLoss, gainLossPercent, formatPercent } from '../lib/format'
import { logActivity } from '../lib/activity'

export default function Investments() {
  const { categories, investments, loading, reload } = useCategoriesWithInvestments()
  const { profile } = useAuth()
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [investmentModalFor, setInvestmentModalFor] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<{ id: string; nombre: string } | null>(null)

  async function createCategory() {
    if (!newCategoryName.trim()) return
    const nombre = newCategoryName.trim()
    await supabase.from('categories').insert({ nombre, creado_por: profile?.id })
    logActivity(profile, 'creó', 'categoría', nombre)
    setNewCategoryName('')
    setShowNewCategory(false)
    reload()
  }

  async function updateCategory() {
    if (!editingCategory || !editingCategory.nombre.trim()) return
    const nombre = editingCategory.nombre.trim()
    await supabase.from('categories').update({ nombre }).eq('id', editingCategory.id)
    logActivity(profile, 'editó', 'categoría', nombre)
    setEditingCategory(null)
    reload()
  }

  async function deleteCategory(id: string, nombre: string) {
    if (!confirm('¿Eliminar esta categoría? También se eliminarán sus inversiones.')) return
    await supabase.from('categories').delete().eq('id', id)
    logActivity(profile, 'eliminó', 'categoría', nombre)
    reload()
  }

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-ink">Inversiones</h1>
        <button
          onClick={() => setShowNewCategory(true)}
          className="px-5 py-2.5 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark"
        >
          + Nueva categoría
        </button>
      </div>

      {categories.length === 0 && (
        <p className="text-ink-soft">
          Todavía no hay categorías. Creá la primera para empezar a cargar inversiones.
        </p>
      )}

      {categories.map((cat) => {
        const catInvestments = investments.filter((i) => i.category_id === cat.id)
        const total = catInvestments.reduce((sum, i) => sum + i.valor_actual, 0)
        return (
          <section key={cat.id} className="bg-paper border border-line rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-semibold text-ink">{cat.nombre}</h2>
                <p className="text-sm text-ink-soft">
                  {catInvestments.length === 1 ? '1 inversión' : `${catInvestments.length} inversiones`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setInvestmentModalFor(cat.id)}
                  className="px-4 py-2 rounded-lg bg-sage text-white text-sm font-medium hover:bg-sage-dark"
                >
                  + Inversión
                </button>
                <button
                  onClick={() => setEditingCategory({ id: cat.id, nombre: cat.nombre })}
                  className="px-4 py-2 rounded-lg border border-line text-sm font-medium text-ink-soft hover:text-ink"
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteCategory(cat.id, cat.nombre)}
                  className="px-4 py-2 rounded-lg border border-line text-sm font-medium text-rose hover:bg-rose/10"
                >
                  Eliminar
                </button>
              </div>
            </div>

            {catInvestments.length === 0 ? (
              <p className="text-ink-soft text-sm">Sin inversiones cargadas todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sm text-ink-soft border-b border-line">
                      <th className="py-2 pr-4 font-medium">Nombre</th>
                      <th className="py-2 pr-4 font-medium">Moneda</th>
                      <th className="py-2 pr-4 font-medium">Valor actual</th>
                      <th className="py-2 pr-4 font-medium">Ganancia/Pérdida</th>
                      <th className="py-2 pr-4 font-medium">Rentabilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catInvestments.map((inv) => {
                      const gl = gainLoss(inv)
                      const glp = gainLossPercent(inv)
                      return (
                        <tr key={inv.id} className="border-b border-line last:border-0">
                          <td className="py-3 pr-4">
                            <Link
                              to={`/inversiones/${inv.id}`}
                              className="font-medium text-ink hover:text-terracotta"
                            >
                              {inv.nombre}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-ink-soft">{inv.moneda}</td>
                          <td className="py-3 pr-4">{formatMoney(inv.valor_actual, inv.moneda)}</td>
                          <td className={`py-3 pr-4 ${gl >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
                            {formatMoney(gl, inv.moneda)}
                          </td>
                          <td className={`py-3 pr-4 ${glp >= 0 ? 'text-sage-dark' : 'text-rose'}`}>
                            {formatPercent(glp)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-sm text-ink-soft mt-3">
                  Total categoría: <span className="font-medium text-ink">{formatMoney(total, catInvestments[0]?.moneda ?? BASE_CURRENCY)}</span>
                </p>
              </div>
            )}
          </section>
        )
      })}

      {showNewCategory && (
        <Modal title="Nueva categoría" onClose={() => setShowNewCategory(false)}>
          <input
            autoFocus
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ej: Inmuebles"
            className="w-full px-4 py-3 rounded-xl border border-line text-lg mb-4"
            onKeyDown={(e) => e.key === 'Enter' && createCategory()}
          />
          <button
            onClick={createCategory}
            className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark"
          >
            Crear categoría
          </button>
        </Modal>
      )}

      {editingCategory && (
        <Modal title="Editar categoría" onClose={() => setEditingCategory(null)}>
          <input
            autoFocus
            value={editingCategory.nombre}
            onChange={(e) => setEditingCategory({ ...editingCategory, nombre: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg mb-4"
            onKeyDown={(e) => e.key === 'Enter' && updateCategory()}
          />
          <button
            onClick={updateCategory}
            className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark"
          >
            Guardar cambios
          </button>
        </Modal>
      )}

      {investmentModalFor && (
        <NewInvestmentModal
          categoryId={investmentModalFor}
          onClose={() => setInvestmentModalFor(null)}
          onCreated={reload}
        />
      )}
    </div>
  )
}

function NewInvestmentModal({
  categoryId,
  onClose,
  onCreated,
}: {
  categoryId: string
  onClose: () => void
  onCreated: () => void
}) {
  const { profile } = useAuth()
  const [nombre, setNombre] = useState('')
  const [moneda, setMoneda] = useState<Currency>(BASE_CURRENCY)
  const [cotizacion, setCotizacion] = useState('1')
  const [valorCompra, setValorCompra] = useState('')
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!nombre.trim() || !valorCompra) return
    setSaving(true)
    const valor = parseFloat(valorCompra)
    const payload: Partial<Investment> = {
      category_id: categoryId,
      nombre: nombre.trim(),
      moneda,
      cotizacion: moneda === BASE_CURRENCY ? 1 : parseFloat(cotizacion) || 1,
      valor_compra: valor,
      fecha_compra: fechaCompra,
      valor_actual: valor,
    }
    await supabase.from('investments').insert(payload)
    logActivity(profile, 'creó', 'inversión', nombre.trim())
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <Modal title="Nueva inversión" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Nombre</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            placeholder="Ej: Depto Palermo"
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
          {saving ? 'Guardando...' : 'Crear inversión'}
        </button>
      </div>
    </Modal>
  )
}
