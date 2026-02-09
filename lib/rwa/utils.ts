import { USDC_DECIMALS } from './constants/addresses'

export function bigintToNumber(value: bigint, decimals: number = USDC_DECIMALS): number {
  const divisor = BigInt(10 ** decimals)
  const wholePart = value / divisor
  const fractionalPart = value % divisor
  return Number(wholePart) + Number(fractionalPart) / Number(divisor)
}

export function formatBigintCurrency(value: bigint, decimals: number = USDC_DECIMALS): string {
  const numValue = bigintToNumber(value, decimals)
  return formatCurrency(numValue)
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

export function serializeBigints<T extends object>(obj: T): T {
  const result = {} as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      result[key] = value.toString()
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeBigints(value as object)
    } else {
      result[key] = value
    }
  }
  return result as T
}

export function parseBigints<T extends object>(obj: T, bigintKeys: string[]): T {
  const result = {} as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    if (bigintKeys.includes(key) && typeof value === 'string') {
      result[key] = BigInt(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = parseBigints(value as object, bigintKeys)
    } else {
      result[key] = value
    }
  }
  return result as T
}

export const BIGINT_METRIC_KEYS = [
  'transactedVolume',
  'assetsFinanced',
  'lenderRepayments',
  'idleCapital',
  'committedCapital',
  'capitalOutstanding',
  'principalRepayments',
  'convertedUsdc',
]
