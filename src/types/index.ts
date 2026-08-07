export type Currency = 'UYU' | 'ARS' | 'USD' | 'EUR' | 'OTHER'

export type IncomeStatus = 'programado' | 'cobrado'

export interface Profile {
  id: string
  nombre: string
  email: string
  rol: 'admin' | 'usuario'
  created_at: string
}

export interface Category {
  id: string
  nombre: string
  creado_por: string | null
  created_at: string
}

export interface Investment {
  id: string
  category_id: string
  nombre: string
  moneda: Currency
  cotizacion: number
  valor_compra: number
  fecha_compra: string
  valor_actual: number
  notas: string | null
  created_at: string
  updated_at: string
}

export interface InvestmentIncome {
  id: string
  investment_id: string
  fecha: string
  monto: number
  concepto: string
  estado: IncomeStatus
  created_at: string
}

export interface InvestmentCost {
  id: string
  investment_id: string
  fecha: string
  monto: number
  concepto: string
  created_at: string
}

export interface InvestmentResponsible {
  investment_id: string
  user_id: string
}

export type DayOfWeek =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo'

export interface TaskCard {
  id: string
  dia_semana: DayOfWeek
  titulo: string
  asignado_a: string | null
  completada: boolean
  fecha_completada: string | null
  creado_en: string
  posicion: number
}

export const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

export const CURRENCIES: Currency[] = ['USD', 'UYU', 'ARS', 'EUR', 'OTHER']

// Monedas que se pueden elegir para VER los totales consolidados
// (dashboard y reportes). "OTHER" queda afuera porque no es una moneda
// concreta contra la que se pueda cotizar.
export const VIEW_CURRENCIES: Currency[] = ['USD', 'UYU', 'ARS', 'EUR']

// Moneda en la que cada inversión guarda su "cotización" (el tipo de
// cambio cargado al momento de comprar). Todo el resto de monedas de
// visualización se calculan a partir de esta con un tipo de cambio
// que el usuario ingresa al elegirlas.
export const BASE_CURRENCY: Currency = 'USD'
