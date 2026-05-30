export interface GeneralMetrics {
  transactedVolume: bigint
  assetsFinanced: bigint
  lenderRepayments: bigint
  idleCapital: bigint
  committedCapital: bigint
  capitalTurnover: number
  lifeSinceInception: number
  avgCapitalRecycling: number
  averageCapitalUtilization: number
}

export interface OatFiMetrics {
  capitalOutstanding: bigint
  principalRepayments: bigint
  convertedUsdc: bigint
}

export interface LenderBreakdown {
  lender: string
  address: string
  amount: bigint
  percentage: number
}

export interface AllMetrics {
  general: GeneralMetrics
  oatfi: OatFiMetrics
  lenderBreakdown: LenderBreakdown[]
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
  committedCapital: TimeSeriesDataPoint[]
  netCapitalPosition: TimeSeriesDataPoint[]
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

export interface TransactionRecord {
  txHash: string
  timestamp: string
  from: string
  fromLabel: string
  to: string
  toLabel: string
  amount: bigint
  direction: 'inbound' | 'outbound' | 'internal'
}

// Fence Finance API types

export interface FenceCollectionValue {
  value: number
  asOfDate: string
}

export interface FenceCL01Value {
  value: number
  asOfDate: string
  withinLimit: boolean
  threshold: number
}

export interface FenceMetrics {
  paidTotalCollections: FenceCollectionValue | null
  expectedTotalCollections: FenceCollectionValue | null
  cl01Concentration: FenceCL01Value | null
  repaymentRatio: number | null
  lastUpdated: string
}

export interface FenceHistoricalData {
  paidCollections: TimeSeriesDataPoint[]
  expectedCollections: TimeSeriesDataPoint[]
}
