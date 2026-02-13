import {
  getAllTrackedTransfers,
  getUsdcBalance,
  getLenderTransfers,
} from '../glacier/transactions'
import { ADDRESSES, normalizeAddress } from '../constants/addresses'
import { aggregateByPeriod, calculateUtilizationSeries } from './aggregations'
import type {
  GeneralMetrics,
  OatFiMetrics,
  AllMetrics,
  ParsedTransfer,
  MetricTrend,
  MultiPeriodTrend,
  LenderBreakdown,
} from '../types'

/**
 * Calculates transacted volume by deduplicating transfers across addresses.
 * Uses composite key (txHash-from-to) so distinct events within the same
 * transaction are preserved while duplicates across address lists are removed.
 */
function calculateTransactedVolume(
  transfersByAddress: Map<string, ParsedTransfer[]>
): bigint {
  const seen = new Set<string>()
  let total = BigInt(0)

  for (const [, transfers] of transfersByAddress) {
    for (const transfer of transfers) {
      if (transfer.isInternal) continue
      const key = `${transfer.txHash}-${transfer.from}-${transfer.to}`
      if (seen.has(key)) continue
      seen.add(key)
      total += transfer.amount
    }
  }

  return total
}

function calculateAssetsFinanced(tranchePoolTransfers: ParsedTransfer[]): bigint {
  const borrowerAddress = normalizeAddress(ADDRESSES.BORROWER_OPERATING)
  return tranchePoolTransfers
    .filter((t) => t.to === borrowerAddress)
    .reduce((sum, t) => sum + t.amount, BigInt(0))
}

function calculateLenderRepayments(borrowerTransfers: ParsedTransfer[]): bigint {
  const tranchePoolAddress = normalizeAddress(ADDRESSES.TRANCHE_POOL)
  return borrowerTransfers
    .filter((t) => t.to === tranchePoolAddress)
    .reduce((sum, t) => sum + t.amount, BigInt(0))
}

function calculateCommittedCapital(lenderTransfers: ParsedTransfer[]): bigint {
  return lenderTransfers.reduce((sum, t) => sum + t.amount, BigInt(0))
}

function getFirstTransactionDate(tranchePoolTransfers: ParsedTransfer[]): Date | null {
  const borrowerAddress = normalizeAddress(ADDRESSES.BORROWER_OPERATING)
  const outboundToBorrower = tranchePoolTransfers.filter((t) => t.to === borrowerAddress)

  if (outboundToBorrower.length === 0) return null

  return outboundToBorrower.reduce(
    (earliest, t) => (t.timestamp < earliest ? t.timestamp : earliest),
    outboundToBorrower[0].timestamp
  )
}

function calculateConvertedUsdc(borrowerTransfers: ParsedTransfer[]): bigint {
  const tranchePoolAddress = normalizeAddress(ADDRESSES.TRANCHE_POOL)
  const borrowerAddress = normalizeAddress(ADDRESSES.BORROWER_OPERATING)

  return borrowerTransfers
    .filter(
      (t) =>
        t.from === borrowerAddress &&
        t.to !== tranchePoolAddress
    )
    .reduce((sum, t) => sum + t.amount, BigInt(0))
}

function bigintDivideAsNumber(numerator: bigint, denominator: bigint): number {
  if (denominator === BigInt(0)) return 0
  const scaled = (numerator * BigInt(10000)) / denominator
  return Number(scaled) / 10000
}

function buildTrend(current: number, previous: number): MetricTrend {
  if (previous === 0) {
    return { value: 0, direction: 'neutral' }
  }
  const change = ((current - previous) / Math.abs(previous)) * 100
  const direction = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'neutral'
  return { value: Math.round(change * 100) / 100, direction }
}

function calculateTrends(
  transfersByAddress: Map<string, ParsedTransfer[]>,
  lenderTransfers: ParsedTransfer[]
): Record<string, MultiPeriodTrend> {
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const periods = [
    { label: '7d' as const, days: 7 },
    { label: '30d' as const, days: 30 },
    { label: '90d' as const, days: 90 },
  ]

  const tranchePoolAddress = normalizeAddress(ADDRESSES.TRANCHE_POOL)
  const borrowerAddress = normalizeAddress(ADDRESSES.BORROWER_OPERATING)

  const sumAmounts = (ts: ParsedTransfer[]): number =>
    Number(ts.reduce((s, t) => s + t.amount, BigInt(0))) / 1e6

  const cumulativeTrendForPeriod = (
    transfers: ParsedTransfer[],
    days: number,
    filterFn?: (t: ParsedTransfer) => boolean
  ): MetricTrend => {
    const filtered = filterFn ? transfers.filter(filterFn) : transfers
    const totalNow = sumAmounts(filtered)
    const cutoff = now - days * DAY_MS
    const totalThen = sumAmounts(
      filtered.filter((t) => t.timestamp.getTime() < cutoff)
    )
    return buildTrend(totalNow, totalThen)
  }

  const periodTrendForPeriod = (
    transfers: ParsedTransfer[],
    days: number,
    filterFn?: (t: ParsedTransfer) => boolean
  ): MetricTrend => {
    const filtered = filterFn ? transfers.filter(filterFn) : transfers
    const periodStart = now - days * DAY_MS
    const prevStart = now - 2 * days * DAY_MS
    const current = filtered.filter((t) => {
      const ts = t.timestamp.getTime()
      return ts >= periodStart && ts < now
    })
    const previous = filtered.filter((t) => {
      const ts = t.timestamp.getTime()
      return ts >= prevStart && ts < periodStart
    })
    return buildTrend(sumAmounts(current), sumAmounts(previous))
  }

  const buildMultiPeriod = (
    trendFn: (days: number) => MetricTrend
  ): MultiPeriodTrend => ({
    '7d': trendFn(7),
    '30d': trendFn(30),
    '90d': trendFn(90),
  })

  // Deduplicated non-internal transfers for volume trend
  const dedupedTransfers: ParsedTransfer[] = []
  const seen = new Set<string>()
  for (const [, transfers] of transfersByAddress) {
    for (const transfer of transfers) {
      if (transfer.isInternal) continue
      const key = `${transfer.txHash}-${transfer.from}-${transfer.to}`
      if (seen.has(key)) continue
      seen.add(key)
      dedupedTransfers.push(transfer)
    }
  }

  const tranchePoolTransfers = transfersByAddress.get(tranchePoolAddress) ?? []
  const borrowerTransfers = transfersByAddress.get(borrowerAddress) ?? []

  return {
    transactedVolume: buildMultiPeriod((days) =>
      cumulativeTrendForPeriod(dedupedTransfers, days)
    ),
    committedCapital: buildMultiPeriod((days) =>
      cumulativeTrendForPeriod(lenderTransfers, days)
    ),
    assetsFinanced: buildMultiPeriod((days) =>
      cumulativeTrendForPeriod(
        tranchePoolTransfers,
        days,
        (t) => t.to === borrowerAddress
      )
    ),
    lenderRepayments: buildMultiPeriod((days) =>
      periodTrendForPeriod(
        borrowerTransfers,
        days,
        (t) => t.to === tranchePoolAddress
      )
    ),
  }
}

function calculateLenderBreakdown(
  lenderTransfers: ParsedTransfer[]
): LenderBreakdown[] {
  const valinorAddress = normalizeAddress(ADDRESSES.LENDER_VALINOR)
  const avalancheAddress = normalizeAddress(ADDRESSES.LENDER_AVALANCHE)

  const addressLabels: Record<string, string> = {
    [valinorAddress]: 'Valinor',
    [avalancheAddress]: 'Avalanche',
  }

  const byLender = new Map<string, bigint>()
  for (const t of lenderTransfers) {
    const current = byLender.get(t.from) ?? BigInt(0)
    byLender.set(t.from, current + t.amount)
  }

  const total = lenderTransfers.reduce((s, t) => s + t.amount, BigInt(0))

  return Array.from(byLender.entries()).map(([address, amount]) => ({
    lender: addressLabels[address] ?? address,
    address,
    amount,
    percentage: bigintDivideAsNumber(amount, total) * 100,
  }))
}

export async function calculateAllMetrics(forceRefresh = false): Promise<AllMetrics> {
  const [transfersByAddress, idleCapital, lenderTransfers] = await Promise.all([
    getAllTrackedTransfers(forceRefresh),
    getUsdcBalance(ADDRESSES.TRANCHE_POOL),
    getLenderTransfers(forceRefresh),
  ])

  const tranchePoolAddress = normalizeAddress(ADDRESSES.TRANCHE_POOL)
  const borrowerAddress = normalizeAddress(ADDRESSES.BORROWER_OPERATING)

  const tranchePoolTransfers = transfersByAddress.get(tranchePoolAddress) ?? []
  const borrowerTransfers = transfersByAddress.get(borrowerAddress) ?? []

  const transactedVolume = calculateTransactedVolume(transfersByAddress)
  const assetsFinanced = calculateAssetsFinanced(tranchePoolTransfers)
  const lenderRepayments = calculateLenderRepayments(borrowerTransfers)
  const committedCapital = calculateCommittedCapital(lenderTransfers)

  const capitalTurnover = bigintDivideAsNumber(assetsFinanced, committedCapital)

  const firstTransactionDate = getFirstTransactionDate(tranchePoolTransfers)
  const lifeSinceInception = firstTransactionDate
    ? Math.floor((Date.now() - firstTransactionDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const avgCapitalRecycling = capitalTurnover > 0 ? lifeSinceInception / capitalTurnover : 0

  const assetsFinancedTransfers = tranchePoolTransfers.filter(
    (t) => t.to === borrowerAddress
  )
  const repaymentTransfers = borrowerTransfers.filter(
    (t) => t.to === tranchePoolAddress
  )
  const utilizationSeries = calculateUtilizationSeries(
    aggregateByPeriod(lenderTransfers, 'daily'),
    aggregateByPeriod(repaymentTransfers, 'daily'),
    aggregateByPeriod(assetsFinancedTransfers, 'daily')
  )
  const averageCapitalUtilization = utilizationSeries.length > 0
    ? utilizationSeries.reduce((sum, p) => sum + p.value, 0) / utilizationSeries.length
    : 0

  const general: GeneralMetrics = {
    transactedVolume,
    assetsFinanced,
    lenderRepayments,
    idleCapital,
    committedCapital,
    capitalTurnover,
    lifeSinceInception,
    avgCapitalRecycling,
    averageCapitalUtilization,
  }

  const capitalOutstanding =
    committedCapital > idleCapital ? committedCapital - idleCapital : BigInt(0)
  const principalRepayments = lenderRepayments
  const convertedUsdc = calculateConvertedUsdc(borrowerTransfers)

  const oatfi: OatFiMetrics = {
    capitalOutstanding,
    principalRepayments,
    convertedUsdc,
  }

  const trends = calculateTrends(transfersByAddress, lenderTransfers)
  const lenderBreakdown = calculateLenderBreakdown(lenderTransfers)

  return {
    general,
    oatfi,
    trends,
    lenderBreakdown,
    lastUpdated: new Date().toISOString(),
  }
}
