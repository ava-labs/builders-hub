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

  const lenderBreakdown = calculateLenderBreakdown(lenderTransfers)

  return {
    general,
    oatfi,
    lenderBreakdown,
    lastUpdated: new Date().toISOString(),
  }
}
