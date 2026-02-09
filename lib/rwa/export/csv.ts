import type { AllMetrics, HistoricalData, TimeSeriesDataPoint } from '../types'
import { bigintToNumber } from '../utils'

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
    ['Committed Capital', metrics.general.committedCapital, 'General'],
    ['Capital Turnover', metrics.general.capitalTurnover, 'General'],
    ['Life Since Inception (Days)', metrics.general.lifeSinceInception, 'General'],
    ['Avg Capital Recycling (Days)', metrics.general.avgCapitalRecycling, 'General'],
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

  const headers = ['Date', 'Transacted Volume', 'Assets Financed', 'Lender Repayments', 'Capital Utilization (%)']
  const rows = sortedDates.map((date) => {
    const values = valuesByDate.get(date) ?? {}
    return [
      date,
      values.transactedVolume ?? '',
      values.assetsFinanced ?? '',
      values.lenderRepayments ?? '',
      values.capitalUtilization ?? '',
    ]
  })

  const csv = arrayToCSV(headers, rows as (string | number)[][])
  downloadCSV(csv, filename)
}
