export interface GeneralMetrics {
  transactedVolume: bigint
  assetsFinanced: bigint
  lenderRepayments: bigint
  idleCapital: bigint
  committedCapital: bigint
  capitalTurnover: number
  lifeSinceInception: number
  avgCapitalRecycling: number
}

export interface OatFiMetrics {
  capitalOutstanding: bigint
  principalRepayments: bigint
  convertedUsdc: bigint
}

export interface AllMetrics {
  general: GeneralMetrics
  oatfi: OatFiMetrics
  lastUpdated: string
}

export interface TimeSeriesDataPoint {
  date: string
  value: number
}

export interface HistoricalData {
  transactedVolume: TimeSeriesDataPoint[]
  assetsFinanced: TimeSeriesDataPoint[]
  lenderRepayments: TimeSeriesDataPoint[]
  capitalUtilization: TimeSeriesDataPoint[]
}

export type TimeInterval = 'daily' | 'weekly' | 'monthly'

export interface DateRange {
  from: Date
  to: Date
}

export type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all'

export interface ParsedTransfer {
  txHash: string
  blockNumber: number
  timestamp: Date
  from: string
  to: string
  amount: bigint
  isInternal: boolean
}
