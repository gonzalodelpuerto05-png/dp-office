import type { Currency, Investment } from '../types'

export function formatARS(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatMoney(value: number, currency: Currency | string) {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'OTHER' ? 'USD' : currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toLocaleString('es-AR')} ${currency}`
  }
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR')
}

// Convierte el valor de una inversión a ARS usando la cotización cargada al momento de la compra.
export function toARS(investment: Pick<Investment, 'moneda' | 'cotizacion'>, amount: number) {
  if (investment.moneda === 'ARS') return amount
  const rate = investment.cotizacion || 1
  return amount * rate
}

export function gainLoss(investment: Pick<Investment, 'valor_actual' | 'valor_compra'>) {
  return investment.valor_actual - investment.valor_compra
}

export function gainLossPercent(investment: Pick<Investment, 'valor_actual' | 'valor_compra'>) {
  if (!investment.valor_compra) return 0
  return (gainLoss(investment) / investment.valor_compra) * 100
}
