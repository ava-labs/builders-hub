import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import {
  getAllTrackedTransfers,
  getLenderTransfers,
} from '../glacier/transactions'
import { ADDRESSES, normalizeAddress } from '../constants/addresses'
import type {
  TimeSeriesDataPoint,
  HistoricalData,
  TimeInterval,
  DateRange,
  ParsedTransfer,
} from '../types'
import { cache, CacheKeys } from '../glacier/cache'
import { bigintToNumber } from '../utils'

function getStartOfPeriod(date: Date, interval: TimeInterval): Date {
  switch (interval) {
    case 'daily':
      return startOfDay(date)
    case 'weekly':
      return startOfWeek(date, { weekStartsOn: 1 })
    case 'monthly':
      return startOfMonth(date)
  }
}

function formatDate(date: Date, interval: TimeInterval): string {
  switch (interval) {
    case 'daily':
      return format(date, 'yyyy-MM-dd')
    case 'weekly':
      return format(date, "yyyy-'W'ww")
    case 'monthly':
      return format(date, 'yyyy-MM')
  }
}

export function aggregateByPeriod(
  transfers: ParsedTransfer[],
  interval: TimeInterval
): TimeSeriesDataPoint[] {
  const periodMap = new Map<string, bigint>()

  for (const transfer of transfers) {
    const periodStart = getStartOfPeriod(transfer.timestamp, interval)
    const key = formatDate(periodStart, interval)
    const current = periodMap.get(key) ?? BigInt(0)
    periodMap.set(key, current + transfer.amount)
  }

  return Array.from(periodMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value: bigintToNumber(value) }))
}

export function calculateUtilizationSeries(
  committedSeries: TimeSeriesDataPoint[],
  repaymentsSeries: TimeSeriesDataPoint[],
  financedSeries: TimeSeriesDataPoint[]
): TimeSeriesDataPoint[] {
  const allDates = new Set<string>()
  committedSeries.forEach((p) => allDates.add(p.date))
  repaymentsSeries.forEach((p) => allDates.add(p.date))
  financedSeries.forEach((p) => allDates.add(p.date))

  const sortedDates = Array.from(allDates).sort()

  const committedByDate = new Map(committedSeries.map((p) => [p.date, p.value]))
  const repaymentsByDate = new Map(repaymentsSeries.map((p) => [p.date, p.value]))
  const financedByDate = new Map(financedSeries.map((p) => [p.date, p.value]))

  let runningCommitted = 0
  let runningRepayments = 0
  let runningFinanced = 0

  return sortedDates.map((date) => {
    runningCommitted += committedByDate.get(date) ?? 0
    runningRepayments += repaymentsByDate.get(date) ?? 0
    runningFinanced += financedByDate.get(date) ?? 0

    const outstanding = runningFinanced - runningRepayments
    const utilization = runningCommitted > 0 ? (outstanding / runningCommitted) * 100 : 0

    return { date, value: Math.max(0, Math.min(100, utilization)) }
  })
}

function parseDateString(dateStr: string): Date {
  if (dateStr.includes('W')) {
    const [year, weekStr] = dateStr.split('-W')
    const weekNum = parseInt(weekStr, 10)
    const jan4 = new Date(parseInt(year, 10), 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    const firstMonday = new Date(jan4)
    firstMonday.setDate(jan4.getDate() - dayOfWeek + 1)
    const targetDate = new Date(firstMonday)
    targetDate.setDate(firstMonday.getDate() + (weekNum - 1) * 7)
    return targetDate
  } else if (dateStr.length === 7) {
    return parseISO(dateStr + '-01')
  } else {
    return parseISO(dateStr)
  }
}

function filterByDateRange(
  data: TimeSeriesDataPoint[],
  dateRange?: DateRange
): TimeSeriesDataPoint[] {
  if (!dateRange) return data

  return data.filter((point) => {
    const pointDate = parseDateString(point.date)
    return isWithinInterval(pointDate, { start: dateRange.from, end: dateRange.to })
  })
}

export function toCumulative(series: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
  let runningTotal = 0
  return series.map((point) => ({
    date: point.date,
    value: (runningTotal += point.value),
  }))
}

function buildNetCapitalPosition(
  cumulativeRepayments: TimeSeriesDataPoint[],
  cumulativeFinanced: TimeSeriesDataPoint[]
): TimeSeriesDataPoint[] {
  const allDates = new Set<string>()
  cumulativeRepayments.forEach((p) => allDates.add(p.date))
  cumulativeFinanced.forEach((p) => allDates.add(p.date))

  const repaymentsByDate = new Map(
    cumulativeRepayments.map((p) => [p.date, p.value])
  )
  const financedByDate = new Map(
    cumulativeFinanced.map((p) => [p.date, p.value])
  )

  const sortedDates = Array.from(allDates).sort()
  let lastRepayment = 0
  let lastFinanced = 0

  return sortedDates.map((date) => {
    lastRepayment = repaymentsByDate.get(date) ?? lastRepayment
    lastFinanced = financedByDate.get(date) ?? lastFinanced
    return { date, value: lastFinanced - lastRepayment }
  })
}

export async function calculateHistoricalData(
  interval: TimeInterval = 'daily',
  forceRefresh = false,
  dateRange?: DateRange
): Promise<HistoricalData> {
  const cacheKey = dateRange
    ? CacheKeys.historical('all', interval) + `-${dateRange.from.toISOString()}-${dateRange.to.toISOString()}`
    : CacheKeys.historical('all', interval)

  if (!forceRefresh) {
    const cached = cache.get<HistoricalData>(cacheKey)
    if (cached && !cached.isStale) return cached.data
  }

  const [transfersByAddress, lenderTransfers] = await Promise.all([
    getAllTrackedTransfers(forceRefresh),
    getLenderTransfers(forceRefresh),
  ])

  const tranchePoolAddress = normalizeAddress(ADDRESSES.TRANCHE_POOL)
  const borrowerAddress = normalizeAddress(ADDRESSES.BORROWER_OPERATING)

  const tranchePoolTransfers = transfersByAddress.get(tranchePoolAddress) ?? []
  const borrowerTransfers = transfersByAddress.get(borrowerAddress) ?? []

  const allTransfers = [...tranchePoolTransfers, ...borrowerTransfers]
  const seen = new Set<string>()
  const dedupedTransfers = allTransfers.filter((t) => {
    if (t.isInternal) return false
    const key = `${t.txHash}-${t.from}-${t.to}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const transactedVolume = aggregateByPeriod(dedupedTransfers, interval)

  const assetsFinancedTransfers = tranchePoolTransfers.filter(
    (t) => t.to === borrowerAddress
  )
  const assetsFinanced = aggregateByPeriod(assetsFinancedTransfers, interval)

  const repaymentTransfers = borrowerTransfers.filter(
    (t) => t.to === tranchePoolAddress
  )
  const lenderRepayments = aggregateByPeriod(repaymentTransfers, interval)

  const committedSeries = aggregateByPeriod(lenderTransfers, interval)

  const capitalUtilization = calculateUtilizationSeries(
    committedSeries,
    lenderRepayments,
    assetsFinanced
  )

  const committedCapital = toCumulative(committedSeries)

  const cumulativeRepayments = toCumulative(lenderRepayments)
  const cumulativeFinanced = toCumulative(assetsFinanced)
  const netCapitalPosition = buildNetCapitalPosition(
    cumulativeRepayments,
    cumulativeFinanced
  )

  const data: HistoricalData = {
    transactedVolume: filterByDateRange(transactedVolume, dateRange),
    assetsFinanced: filterByDateRange(assetsFinanced, dateRange),
    lenderRepayments: filterByDateRange(lenderRepayments, dateRange),
    capitalUtilization: filterByDateRange(capitalUtilization, dateRange),
    committedCapital: filterByDateRange(committedCapital, dateRange),
    netCapitalPosition: filterByDateRange(netCapitalPosition, dateRange),
  }

  cache.set(cacheKey, data)
  return data
}

export async function getMetricTimeSeries(
  metricKey: keyof HistoricalData,
  interval: TimeInterval = 'daily',
  forceRefresh = false,
  dateRange?: DateRange
): Promise<TimeSeriesDataPoint[]> {
  const historical = await calculateHistoricalData(interval, forceRefresh, dateRange)
  return historical[metricKey]
}
