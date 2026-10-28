import type { FacilityMetrics, HistoricalData, TimeSeriesDataPoint, TransactionRecord } from '../types'
import { bigintToNumber, isLineMetrics, LINE_EVENT_LABELS } from '../utils'
import { normalizeAddress } from '../constants/addresses'
import { isLineFacility } from '../facilities'
import type { RWAFacility } from '../facilities'

function escapeCsvValue(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return ''
  const stringValue = typeof value === 'bigint' ? bigintToNumber(value).toString() : String(value)
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function arrayToCSV(headers: string[], rows: (string | number | bigint | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(',')
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','))
  return [headerLine, ...dataLines].join('\n')
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** a CSV's name for today: OatFi's keep the names they had before a second facility came in, and every other
 *  facility's carry its slug, so two facilities' exports of one day never share a name */
function csvFilename(facility: RWAFacility, content: 'metrics' | 'historical' | 'transactions'): string {
  const prefix = facility.slug === 'oatfi' ? 'rwa' : `rwa-${facility.slug}`
  return `${prefix}-${content}-${new Date().toISOString().split('T')[0]}.csv`
}

export function exportMetricsToCSV(metrics: FacilityMetrics, facility: RWAFacility): void {
  const filename = csvFilename(facility, 'metrics')

  const headers = ['Metric', 'Value', 'Category']
  const general: (string | number | bigint)[][] = [
    ['Assets Financed', metrics.general.assetsFinanced, 'General'],
    ['Lender Repayments', metrics.general.lenderRepayments, 'General'],
    ['Idle Capital', metrics.general.idleCapital, 'General'],
    ['Lender Invested Capital', metrics.general.committedCapital, 'General'],
    ['Capital Turnover', metrics.general.capitalTurnover, 'General'],
    ['Life Since Inception (Days)', metrics.general.lifeSinceInception, 'General'],
    ['Avg Capital Recycling (Days)', metrics.general.avgCapitalRecycling, 'General'],
    ['Avg Capital Utilization (%)', metrics.general.averageCapitalUtilization, 'General'],
  ]
  // a line of credit has no transacted volume and no OatFi breakdown: the line's own two figures close its rows
  const rows: (string | number | bigint)[][] = isLineMetrics(metrics)
    ? [
        ...general,
        ['Capital Outstanding', metrics.line.capitalOutstanding, 'Line of credit'],
        ['Draws', metrics.line.draws, 'Line of credit'],
      ]
    : [
        ['Transacted Volume', metrics.general.transactedVolume, 'General'],
        ...general,
        ['Capital Outstanding', metrics.oatfi.capitalOutstanding, 'OatFi'],
        ['Principal Repayments', metrics.oatfi.principalRepayments, 'OatFi'],
        ['Converted USDC', metrics.oatfi.convertedUsdc, 'OatFi'],
      ]

  const csv = arrayToCSV(headers, rows)
  downloadCSV(csv, filename)
}

export function exportHistoricalToCSV(historical: HistoricalData, facility: RWAFacility): void {
  const filename = csvFilename(facility, 'historical')

  const allDates = new Set<string>()
  Object.values(historical).forEach((series: TimeSeriesDataPoint[]) => {
    series.forEach((point: TimeSeriesDataPoint) => allDates.add(point.date))
  })
  const sortedDates = Array.from(allDates).sort()

  const valuesByDate = new Map<string, Record<string, number>>()
  for (const date of sortedDates) {
    valuesByDate.set(date, {})
  }

  for (const [key, series] of Object.entries(historical)) {
    for (const point of series as TimeSeriesDataPoint[]) {
      const record = valuesByDate.get(point.date)
      if (record) {
        record[key] = point.value
      }
    }
  }

  // a line of credit has no transacted volume, so its history has no column for it
  const volume = !isLineFacility(facility)
  const headers = ['Date', ...(volume ? ['Transacted Volume'] : []), 'Assets Financed', 'Lender Repayments', 'Capital Utilization (%)', 'Committed Capital', 'Net Capital Position']
  const rows = sortedDates.map((date) => {
    const values = valuesByDate.get(date) ?? {}
    return [
      date,
      ...(volume ? [values.transactedVolume ?? ''] : []),
      values.assetsFinanced ?? '',
      values.lenderRepayments ?? '',
      values.capitalUtilization ?? '',
      values.committedCapital ?? '',
      values.netCapitalPosition ?? '',
    ]
  })

  const csv = arrayToCSV(headers, rows as (string | number)[][])
  downloadCSV(csv, filename)
}

/** the export's name for each of the facility's addresses, by lower-cased address; a line's Spigot included */
function txAddressLabels(facility: RWAFacility): Record<string, string> {
  return Object.fromEntries([
    [normalizeAddress(facility.pool.address), facility.pool.label],
    [normalizeAddress(facility.borrower.address), `Borrower (${facility.borrower.partner})`],
    ...facility.lenders.map((lender) => [normalizeAddress(lender.address), `Lender (${lender.partner})`]),
    ...(isLineFacility(facility) ? [[normalizeAddress(facility.line.spigot.address), facility.line.spigot.label]] : []),
  ])
}

function labelForAddress(labels: Record<string, string>, address: string): string {
  return labels[normalizeAddress(address)] ?? address
}

export function exportTransactionsToCSV(transactions: TransactionRecord[], facility: RWAFacility): void {
  const filename = csvFilename(facility, 'transactions')
  const labels = txAddressLabels(facility)
  // a line of credit's rows carry their type where OatFi's carry their direction
  const line = isLineFacility(facility)

  const headers = ['Date', 'From Address', 'From Label', 'To Address', 'To Label', 'Amount (USD)', line ? 'Type' : 'Direction', 'Tx Hash']
  const rows = transactions.map((tx) => [
    tx.timestamp,
    tx.from,
    labelForAddress(labels, tx.from),
    tx.to,
    labelForAddress(labels, tx.to),
    bigintToNumber(typeof tx.amount === 'bigint' ? tx.amount : BigInt(tx.amount)),
    line ? (tx.kind ? LINE_EVENT_LABELS[tx.kind] : '') : tx.direction,
    tx.txHash,
  ])

  const csv = arrayToCSV(headers, rows as (string | number)[][])
  downloadCSV(csv, filename)
}
