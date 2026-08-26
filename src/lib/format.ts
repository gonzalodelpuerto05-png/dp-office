import type { Currency, Investment } from '../types'
import { BASE_CURRENCY } from '../types'

export function formatBase(value: number) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: BASE_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatMoney(value: number, currency: Currency | string) {
  try {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: currency === 'OTHER' ? 'USD' : currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toLocaleString('es-UY')} ${currency}`
  }
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value + 'T00:00:00').toLocaleDateString('es-UY')
}

// Convierte el valor de una inversión a la moneda base (USD) usando la
// cotización cargada al momento de la compra.
export function toBase(investment: Pick<Investment, 'moneda' | 'cotizacion'>, amount: number) {
  if (investment.moneda === BASE_CURRENCY) return amount
  const rate = investment.cotizacion || 1
  return amount * rate
}

// Suma montos agrupados por moneda. Se usa para ingresos/costos, que
// pueden estar en monedas distintas entre sí sin un tipo de cambio
// conocido entre ellas — sumarlos a ciegas en una sola moneda daría un
// número incorrecto, así que se muestran agrupados por moneda.
export type MoneyBag = Record<string, number>

export function addToBag(bag: MoneyBag, currency: string, amount: number): MoneyBag {
  return { ...bag, [currency]: (bag[currency] ?? 0) + amount }
}

export function formatBag(bag: MoneyBag, emptyCurrency: Currency = BASE_CURRENCY) {
  const entries = Object.entries(bag).filter(([, v]) => v !== 0)
  if (entries.length === 0) return formatMoney(0, emptyCurrency)
  return entries.map(([cur, amt]) => formatMoney(amt, cur)).join('  +  ')
}

// Resta dos bolsas moneda por moneda (ej. ingresos - costos = resultado
// neto), sin inventar una conversión entre monedas distintas.
export function subtractBags(a: MoneyBag, b: MoneyBag): MoneyBag {
  const result: MoneyBag = { ...a }
  for (const [cur, amt] of Object.entries(b)) {
    result[cur] = (result[cur] ?? 0) - amt
  }
  return result
}

export function bagHasNegative(bag: MoneyBag) {
  return Object.values(bag).some((v) => v < 0)
}

// Convierte una bolsa en filas [etiqueta, monto] listas para una planilla:
// si hay una sola moneda, una fila con el monto numérico; si hay varias,
// una fila por moneda para que cada celda siga siendo un número editable.
export function bagToRows(label: string, bag: MoneyBag): [string, number][] {
  const entries = Object.entries(bag).filter(([, v]) => v !== 0)
  if (entries.length === 0) return [[label, 0]]
  if (entries.length === 1) return [[`${label} (${entries[0][0]})`, Number(entries[0][1].toFixed(2))]]
  return entries.map(([cur, amt]) => [`${label} (${cur})`, Number(amt.toFixed(2))])
}

export function gainLoss(investment: Pick<Investment, 'valor_actual' | 'valor_compra'>) {
  return investment.valor_actual - investment.valor_compra
}

export function gainLossPercent(investment: Pick<Investment, 'valor_actual' | 'valor_compra'>) {
  if (!investment.valor_compra) return 0
  return (gainLoss(investment) / investment.valor_compra) * 100
}
