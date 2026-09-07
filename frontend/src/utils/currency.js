/**
 * Indian Rupee (INR) Currency Utilities
 */

export const CURRENCY_SYMBOL = '₹'

export function formatINR(amount, decimals = 0) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  const num = Number(amount)
  return `${CURRENCY_SYMBOL}${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function formatCompactINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  const num = Number(amount)
  if (num >= 10000000) {
    return `${CURRENCY_SYMBOL}${(num / 10000000).toFixed(2)} Cr`
  }
  if (num >= 100000) {
    return `${CURRENCY_SYMBOL}${(num / 100000).toFixed(2)} L`
  }
  if (num >= 1000) {
    return `${CURRENCY_SYMBOL}${(num / 1000).toFixed(1)}k`
  }
  return `${CURRENCY_SYMBOL}${num.toLocaleString('en-IN')}`
}
