import { normalizeAddress, USDC_DECIMALS } from './constants/addresses'
import { isLineFacility } from './facilities'
import type { RWAFacility } from './facilities'
import type { FacilityMetrics, LineEventKind, LineFacilityMetrics } from './types'

export function bigintToNumber(value: bigint, decimals: number = USDC_DECIMALS): number {
  const divisor = BigInt(10 ** decimals)
  const wholePart = value / divisor
  const fractionalPart = value % divisor
  return Number(wholePart) + Number(fractionalPart) / Number(divisor)
}

export function bigintDivideAsNumber(numerator: bigint, denominator: bigint): number {
  if (denominator === BigInt(0)) return 0
  const scaled = (numerator * BigInt(10000)) / denominator
  return Number(scaled) / 10000
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
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' ? serializeBigints(item as object) :
        typeof item === 'bigint' ? item.toString() : item
      )
    } else if (value && typeof value === 'object') {
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
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' ? parseBigints(item as object, bigintKeys) : item
      )
    } else if (value && typeof value === 'object') {
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
  'amount',
]

/** the ledger's name for each of the facility's addresses, by lower-cased address; a line's Spigot included */
export function ledgerLabels(facility: RWAFacility): Record<string, string> {
  return Object.fromEntries([
    [normalizeAddress(facility.pool.address), facility.pool.label],
    [normalizeAddress(facility.borrower.address), facility.borrower.label],
    ...facility.lenders.map((lender) => [normalizeAddress(lender.address), lender.partner]),
    ...(isLineFacility(facility) ? [[normalizeAddress(facility.line.spigot.address), facility.line.spigot.label]] : []),
  ])
}

/** whether the figures are a line of credit's, which carry the line's own in place of OatFi's breakdown */
export function isLineMetrics(metrics: FacilityMetrics): metrics is LineFacilityMetrics {
  return 'line' in metrics
}

/** each line event's type as the ledger and its CSV name it, in the order the ledger's type chips list them */
export const LINE_EVENT_LABELS: Record<LineEventKind, string> = {
  draw: 'Draw',
  repayment: 'Repayment',
  commitment: 'Commitment',
  withdrawal: 'Withdrawal',
}
