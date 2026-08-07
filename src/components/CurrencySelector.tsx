import type { Currency } from '../types'
import { BASE_CURRENCY, VIEW_CURRENCIES } from '../types'

export default function CurrencySelector({
  currency,
  onCurrencyChange,
  rate,
  onRateChange,
}: {
  currency: Currency
  onCurrencyChange: (c: Currency) => void
  rate: number
  onRateChange: (r: number) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-sm text-ink-soft">Ver en</label>
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value as Currency)}
        className="px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink bg-paper"
      >
        {VIEW_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {currency !== BASE_CURRENCY && (
        <span className="flex items-center gap-1.5 text-sm text-ink-soft">
          1 {BASE_CURRENCY} =
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
            className="w-24 px-2 py-1.5 rounded-lg border border-line text-ink"
          />
          {currency}
        </span>
      )}
    </div>
  )
}
