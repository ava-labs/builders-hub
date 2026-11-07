import 'server-only'
import { normalizeAddress } from '../constants/addresses'
import type { LineFacility } from '../facilities'
import { bucketOf } from '../series'
import type {
  DateRange,
  HistoricalData,
  LineFacilityMetrics,
  TimeInterval,
  TimeSeriesDataPoint,
  TransactionRecord,
} from '../types'
import { bigintDivideAsNumber, bigintToNumber, ledgerLabels } from '../utils'
import { readLineDays, readLineLedger } from './events'
import type { LineDay, LineEntry } from './events'
import { readCreditPosition } from './position'

/* Ticket 05's figures for a line of credit, read from its position's events and the position itself: the key
   metrics, the history and the ledger the RWA routes serve. The outstanding history is draws minus principal
   repaid, day by day. No figure here is interest alone, principal repaid alone, or a term of the position: a
   repayment is one amount, its interest included. */

/** the line's key metrics: flows from its days, committed and outstanding from the position */
export async function calculateLineMetrics(facility: LineFacility): Promise<LineFacilityMetrics> {
  const [days, position] = await Promise.all([readLineDays(facility), readCreditPosition(facility)])
  const assetsFinanced = days.reduce((sum, day) => sum + day.financed, 0n)
  const lenderRepayments = days.reduce((sum, day) => sum + day.repaid, 0n)
  const idleCapital = position.deposit - position.principal
  const capitalTurnover = bigintDivideAsNumber(assetsFinanced, position.deposit)
  // the days come oldest first, so the first with a draw holds the line's first draw
  const firstDrawAt = days.find((day) => day.firstDrawAt !== null)?.firstDrawAt ?? null
  const lifeSinceInception = firstDrawAt === null ? 0 : Math.floor((Date.now() - firstDrawAt * 1000) / 86_400_000)
  const utilization = dailyHistory(days).capitalUtilization

  return {
    general: {
      assetsFinanced,
      lenderRepayments,
      idleCapital: idleCapital > 0n ? idleCapital : 0n,
      committedCapital: position.deposit,
      capitalTurnover,
      lifeSinceInception,
      avgCapitalRecycling: capitalTurnover > 0 ? lifeSinceInception / capitalTurnover : 0,
      averageCapitalUtilization:
        utilization.length > 0 ? utilization.reduce((sum, point) => sum + point.value, 0) / utilization.length : 0,
    },
    line: {
      capitalOutstanding: position.principal,
      draws: days.reduce((sum, day) => sum + day.draws, 0),
    },
    lastUpdated: new Date().toISOString(),
  }
}

/** the share of committed capital outstanding, in percent, kept between 0 and 100 */
function utilizationOf(outstanding: bigint, committed: bigint): number {
  if (committed <= 0n) return 0
  return Math.min(100, Math.max(0, (bigintToNumber(outstanding) / bigintToNumber(committed)) * 100))
}

/**
 * The position's history by UTC day: each flow on the days it moved, each level at every day's close, and
 * committed on the days it changed.
 */
function dailyHistory(days: LineDay[]): HistoricalData {
  let runningOutstanding = 0n
  let runningCommitted = 0n
  const closes = days.map((day) => {
    runningOutstanding += day.outstanding
    runningCommitted += day.committed
    return {
      date: day.day,
      outstanding: runningOutstanding,
      committed: runningCommitted,
      committedChanged: day.committed !== 0n,
    }
  })

  return {
    transactedVolume: [],
    assetsFinanced: days
      .filter((day) => day.draws > 0)
      .map((day) => ({ date: day.day, value: bigintToNumber(day.financed) })),
    lenderRepayments: days
      .filter((day) => day.repaid > 0n)
      .map((day) => ({ date: day.day, value: bigintToNumber(day.repaid) })),
    capitalUtilization: closes.map(({ date, outstanding, committed }) => ({
      date,
      value: utilizationOf(outstanding, committed),
    })),
    committedCapital: closes
      .filter((close) => close.committedChanged)
      .map(({ date, committed }) => ({ date, value: bigintToNumber(committed) })),
    netCapitalPosition: closes.map(({ date, outstanding }) => ({ date, value: bigintToNumber(outstanding) })),
  }
}

type Merge = (kept: number, next: number) => number
const sum: Merge = (kept, next) => kept + next
const last: Merge = (_kept, next) => next

/** a series by bucket, oldest first: the points of each bucket merged in date order; a daily bucket is its day */
function inBuckets(points: TimeSeriesDataPoint[], interval: TimeInterval, merge: Merge): TimeSeriesDataPoint[] {
  const buckets = new Map<string, number>()
  for (const point of points) {
    const bucket = bucketOf(point.date, interval)
    const kept = buckets.get(bucket)
    buckets.set(bucket, kept === undefined ? point.value : merge(kept, point.value))
  }
  return [...buckets].map(([date, value]) => ({ date, value }))
}

/**
 * The position's history by day, week or month, each flow summed over its bucket and each level at the bucket's
 * last point, cut to the range's whole UTC days when there is one. A week is dated by its ISO Monday and a month by
 * its first day, where OatFi's history on the same route writes yyyy-'W'ww and yyyy-MM: OatFi's dates stay as they
 * were, and every date here stays a UTC day, the unit the page reads and rolls its charts by.
 */
export async function calculateLineHistory(
  facility: LineFacility,
  interval: TimeInterval = 'daily',
  dateRange?: DateRange
): Promise<HistoricalData> {
  const daily = dailyHistory(await readLineDays(facility))
  // the range's first and last UTC days, both kept
  const range = dateRange && {
    from: dateRange.from.toISOString().slice(0, 10),
    to: dateRange.to.toISOString().slice(0, 10),
  }
  const series = (points: TimeSeriesDataPoint[], merge: Merge) =>
    inBuckets(points, interval, merge).filter((point) => !range || (point.date >= range.from && point.date <= range.to))

  return {
    transactedVolume: [],
    assetsFinanced: series(daily.assetsFinanced, sum),
    lenderRepayments: series(daily.lenderRepayments, sum),
    capitalUtilization: series(daily.capitalUtilization, last),
    committedCapital: series(daily.committedCapital, last),
    netCapitalPosition: series(daily.netCapitalPosition, last),
  }
}

/** where an entry's money moves, by its kind, addresses lower-cased */
function movementOf(facility: LineFacility, entry: LineEntry): Pick<TransactionRecord, 'from' | 'to' | 'direction'> {
  const line = normalizeAddress(facility.pool.address)
  const lender = normalizeAddress(facility.lenders[0].address)
  switch (entry.kind) {
    case 'draw':
      return { from: line, to: normalizeAddress(entry.recipient ?? facility.borrower.address), direction: 'outbound' }
    case 'repayment':
      // every repayment on the position so far was paid by the Spigot; the events name no payer
      return { from: normalizeAddress(facility.line.spigot.address), to: line, direction: 'inbound' }
    case 'commitment':
      return { from: lender, to: line, direction: 'inbound' }
    case 'withdrawal':
      return { from: line, to: lender, direction: 'outbound' }
  }
}

/** the line's ledger in chain order: a row per transaction and kind, each repayment one amount, interest included */
export async function listLineTransactions(facility: LineFacility): Promise<TransactionRecord[]> {
  const entries = await readLineLedger(facility)
  const labels = ledgerLabels(facility)
  const labelOf = (address: string) => labels[address] ?? address

  return entries.map((entry) => {
    const { from, to, direction } = movementOf(facility, entry)
    return {
      txHash: entry.txHash,
      timestamp: new Date(entry.timestamp * 1000).toISOString(),
      from,
      fromLabel: labelOf(from),
      to,
      toLabel: labelOf(to),
      amount: entry.amount,
      direction,
      kind: entry.kind,
    }
  })
}
