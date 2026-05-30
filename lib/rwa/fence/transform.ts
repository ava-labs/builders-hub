// Server-only: Transform raw Fence API responses into dashboard types
// Do NOT import this file from client components

import { CL01_THRESHOLD } from '../constants/fence'
import type { TimeSeriesDataPoint, FenceCollectionValue, FenceCL01Value } from '../types'
import type { FenceApiMetricValue } from './client'

function convertCollectionRawValue(rawValue: { value: number | string; decimals?: number }): number | null {
  if (rawValue.decimals === undefined || rawValue.decimals === null) {
    console.warn('[Fence] Missing decimals field in collection value, skipping')
    return null
  }

  const divisor = Math.pow(10, rawValue.decimals)

  if (typeof rawValue.value === 'string') {
    // String values can use BigInt for exact precision
    try {
      const raw = BigInt(rawValue.value)
      const scale = BigInt(10) ** BigInt(rawValue.decimals)
      const wholePart = raw / scale
      const remainder = raw % scale
      return Number(wholePart) + Number(remainder) / Number(scale)
    } catch {
      return Number(rawValue.value) / divisor
    }
  }

  // JSON.parse converts large integers to JS numbers (loses precision in
  // least-significant digits). Division still gives correct USD to the cent.
  return rawValue.value / divisor
}

function normalizeDate(isoDate: string): string {
  return isoDate.slice(0, 10)
}

export function transformCollectionLatest(raw: FenceApiMetricValue): FenceCollectionValue | null {
  if (typeof raw.value !== 'object' || raw.value === null) return null

  const usdValue = convertCollectionRawValue(raw.value as { value: number | string; decimals?: number })
  if (usdValue === null) return null

  return {
    value: usdValue,
    asOfDate: raw.as_of_date,
  }
}

export function transformCollectionSeries(rawValues: FenceApiMetricValue[]): TimeSeriesDataPoint[] {
  const dateMap = new Map<string, number>()

  for (const entry of rawValues) {
    if (typeof entry.value !== 'object' || entry.value === null) continue

    const usdValue = convertCollectionRawValue(entry.value as { value: number | string; decimals?: number })
    if (usdValue === null) continue

    const date = normalizeDate(entry.as_of_date)
    dateMap.set(date, usdValue)
  }

  return Array.from(dateMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function transformCL01(raw: FenceApiMetricValue): FenceCL01Value | null {
  if (typeof raw.value !== 'number') return null

  const config = raw.metadata?.comparison_configuration as
    Record<string, number> | undefined
  const threshold =
    config?.threshold_value ??
    config?.threshole ??
    config?.threshold ??
    CL01_THRESHOLD

  const withinLimit = raw.metadata?.calculation_results?.comparison_result ?? true

  return {
    value: raw.value,
    asOfDate: raw.as_of_date,
    withinLimit,
    threshold,
  }
}
