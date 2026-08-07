import { useCallback, useEffect, useState } from 'react'
import type { Currency } from '../types'
import { BASE_CURRENCY } from '../types'

const CURRENCY_KEY = 'dp-office:display-currency'
const rateKey = (currency: Currency) => `dp-office:fx-rate:${currency}`

function readStoredCurrency(): Currency {
  if (typeof window === 'undefined') return BASE_CURRENCY
  return (window.localStorage.getItem(CURRENCY_KEY) as Currency) || BASE_CURRENCY
}

function readStoredRate(currency: Currency): number {
  if (typeof window === 'undefined') return 1
  const saved = window.localStorage.getItem(rateKey(currency))
  return saved ? parseFloat(saved) || 1 : 1
}

// Cada inversión guarda su valor en su propia moneda + una cotización a
// BASE_CURRENCY (dólares). Para poder ver los totales consolidados en
// cualquier otra moneda (UYU, ARS, EUR), este hook guarda qué moneda
// eligió el usuario y a qué tipo de cambio, y expone `convert` para
// pasar un monto ya expresado en BASE_CURRENCY a esa moneda.
export function useDisplayCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(readStoredCurrency)
  const [rate, setRateState] = useState<number>(() => readStoredRate(readStoredCurrency()))

  useEffect(() => {
    window.localStorage.setItem(CURRENCY_KEY, currency)
    setRateState(readStoredRate(currency))
  }, [currency])

  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), [])

  const setRate = useCallback(
    (r: number) => {
      setRateState(r)
      window.localStorage.setItem(rateKey(currency), String(r))
    },
    [currency]
  )

  const convert = useCallback(
    (amountInBase: number) => (currency === BASE_CURRENCY ? amountInBase : amountInBase * rate),
    [currency, rate]
  )

  return { currency, setCurrency, rate, setRate, convert, isBase: currency === BASE_CURRENCY }
}
