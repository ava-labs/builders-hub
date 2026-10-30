import {
  getAllTrackedTransfers,
  getUsdcBalance,
  getLenderTransfers,
} from '../glacier/transactions'
import { normalizeAddress } from '../constants/addresses'
import type { RWAFacility } from '../facilities'
import { aggregateByPeriod, calculateUtilizationSeries } from './aggregations'
import type {
  GeneralMetrics,
  OatFiMetrics,
  AllMetrics,
  ParsedTransfer,
  LenderBreakdown,
} from '../types'
import { bigintDivideAsNumber } from '../utils'

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

function calculateAssetsFinanced(facility: RWAFacility, tranchePoolTransfers: ParsedTransfer[]): bigint {
  const borrowerAddress = normalizeAddress(facility.borrower.address)
  return tranchePoolTransfers
    .filter((t) => t.to === borrowerAddress)
    .reduce((sum, t) => sum + t.amount, BigInt(0))
}

function calculateLenderRepayments(facility: RWAFacility, borrowerTransfers: ParsedTransfer[]): bigint {
  const tranchePoolAddress = normalizeAddress(facility.pool.address)
  return borrowerTransfers
    .filter((t) => t.to === tranchePoolAddress)
    .reduce((sum, t) => sum + t.amount, BigInt(0))
}

function calculateCommittedCapital(lenderTransfers: ParsedTransfer[]): bigint {
  return lenderTransfers.reduce((sum, t) => sum + t.amount, BigInt(0))
}

function getFirstTransactionDate(facility: RWAFacility, tranchePoolTransfers: ParsedTransfer[]): Date | null {
  const borrowerAddress = normalizeAddress(facility.borrower.address)
  const outboundToBorrower = tranchePoolTransfers.filter((t) => t.to === borrowerAddress)

  if (outboundToBorrower.length === 0) return null

  return outboundToBorrower.reduce(
    (earliest, t) => (t.timestamp < earliest ? t.timestamp : earliest),
    outboundToBorrower[0].timestamp
  )
}

function calculateConvertedUsdc(facility: RWAFacility, borrowerTransfers: ParsedTransfer[]): bigint {
  const tranchePoolAddress = normalizeAddress(facility.pool.address)
  const borrowerAddress = normalizeAddress(facility.borrower.address)

  return borrowerTransfers
    .filter(
      (t) =>
        t.from === borrowerAddress &&
        t.to !== tranchePoolAddress
    )
    .reduce((sum, t) => sum + t.amount, BigInt(0))
}

function calculateLenderBreakdown(
  facility: RWAFacility,
  lenderTransfers: ParsedTransfer[]
): LenderBreakdown[] {
  const addressLabels: Record<string, string> = Object.fromEntries(
    facility.lenders.map((lender) => [normalizeAddress(lender.address), lender.partner])
  )

  // lenders in the order they first appear in the pool's transfers, not the facility's lenders order
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

export async function calculateAllMetrics(
  facility: RWAFacility,
  forceRefresh = false
): Promise<AllMetrics> {
  const [transfersByAddress, idleCapital, lenderTransfers] = await Promise.all([
    getAllTrackedTransfers(facility, forceRefresh),
    getUsdcBalance(facility, facility.pool.address),
    getLenderTransfers(facility, forceRefresh),
  ])

  const tranchePoolAddress = normalizeAddress(facility.pool.address)
  const borrowerAddress = normalizeAddress(facility.borrower.address)

  const tranchePoolTransfers = transfersByAddress.get(tranchePoolAddress) ?? []
  const borrowerTransfers = transfersByAddress.get(borrowerAddress) ?? []

  const transactedVolume = calculateTransactedVolume(transfersByAddress)
  const assetsFinanced = calculateAssetsFinanced(facility, tranchePoolTransfers)
  const lenderRepayments = calculateLenderRepayments(facility, borrowerTransfers)
  const committedCapital = calculateCommittedCapital(lenderTransfers)

  const capitalTurnover = bigintDivideAsNumber(assetsFinanced, committedCapital)

  const firstTransactionDate = getFirstTransactionDate(facility, tranchePoolTransfers)
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
  const convertedUsdc = calculateConvertedUsdc(facility, borrowerTransfers)

  const oatfi: OatFiMetrics = {
    capitalOutstanding,
    principalRepayments,
    convertedUsdc,
  }

  const lenderBreakdown = calculateLenderBreakdown(facility, lenderTransfers)

  return {
    general,
    oatfi,
    lenderBreakdown,
    lastUpdated: new Date().toISOString(),
  }
}
