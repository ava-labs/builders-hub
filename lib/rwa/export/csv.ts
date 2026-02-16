import type { AllMetrics, HistoricalData, TimeSeriesDataPoint, TransactionRecord } from '../types'
import { bigintToNumber } from '../utils'
import { ADDRESSES, normalizeAddress } from '../constants/addresses'

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

export function exportMetricsToCSV(metrics: AllMetrics): void {
  const filename = `rwa-metrics-${new Date().toISOString().split('T')[0]}.csv`

  const headers = ['Metric', 'Value', 'Category']
  const rows: (string | number | bigint)[][] = [
    ['Transacted Volume', metrics.general.transactedVolume, 'General'],
    ['Assets Financed', metrics.general.assetsFinanced, 'General'],
    ['Lender Repayments', metrics.general.lenderRepayments, 'General'],
    ['Idle Capital', metrics.general.idleCapital, 'General'],
    ['Lender Invested Capital', metrics.general.committedCapital, 'General'],
    ['Capital Turnover', metrics.general.capitalTurnover, 'General'],
    ['Life Since Inception (Days)', metrics.general.lifeSinceInception, 'General'],
    ['Avg Capital Recycling (Days)', metrics.general.avgCapitalRecycling, 'General'],
    ['Avg Capital Utilization (%)', metrics.general.averageCapitalUtilization, 'General'],
    ['Capital Outstanding', metrics.oatfi.capitalOutstanding, 'OatFi'],
    ['Principal Repayments', metrics.oatfi.principalRepayments, 'OatFi'],
    ['Converted USDC', metrics.oatfi.convertedUsdc, 'OatFi'],
  ]

  const csv = arrayToCSV(headers, rows)
  downloadCSV(csv, filename)
}

export function exportHistoricalToCSV(historical: HistoricalData): void {
  const filename = `rwa-historical-${new Date().toISOString().split('T')[0]}.csv`

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

  const headers = ['Date', 'Transacted Volume', 'Assets Financed', 'Lender Repayments', 'Capital Utilization (%)', 'Committed Capital', 'Net Capital Position']
  const rows = sortedDates.map((date) => {
    const values = valuesByDate.get(date) ?? {}
    return [
      date,
      values.transactedVolume ?? '',
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

const TX_ADDRESS_LABELS: Record<string, string> = {
  [normalizeAddress(ADDRESSES.TRANCHE_POOL)]: 'Tranche Pool',
  [normalizeAddress(ADDRESSES.BORROWER_OPERATING)]: 'Borrower (OatFi)',
  [normalizeAddress(ADDRESSES.LENDER_VALINOR)]: 'Lender (Valinor)',
  [normalizeAddress(ADDRESSES.LENDER_AVALANCHE)]: 'Lender (Avalanche)',
}

function labelForAddress(address: string): string {
  return TX_ADDRESS_LABELS[normalizeAddress(address)] ?? address
}

export function exportTransactionsToCSV(transactions: TransactionRecord[]): void {
  const filename = `rwa-transactions-${new Date().toISOString().split('T')[0]}.csv`

  const headers = ['Date', 'From Address', 'From Label', 'To Address', 'To Label', 'Amount (USD)', 'Direction', 'Tx Hash']
  const rows = transactions.map((tx) => [
    tx.timestamp,
    tx.from,
    labelForAddress(tx.from),
    tx.to,
    labelForAddress(tx.to),
    bigintToNumber(typeof tx.amount === 'bigint' ? tx.amount : BigInt(tx.amount)),
    tx.direction,
    tx.txHash,
  ])

  const csv = arrayToCSV(headers, rows as (string | number)[][])
  downloadCSV(csv, filename)
}
