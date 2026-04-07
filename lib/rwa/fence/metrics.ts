// Server-only: Fence metrics orchestrator
// Do NOT import this file from client components

import { FENCE_METRIC_IDS, FENCE_CACHE_TTL, FENCE_STALE_TTL } from '../constants/fence'
import { cache, CacheKeys } from '../glacier/cache'
import { fetchMetricLatest, fetchMetricValues } from './client'
import { transformCollectionLatest, transformCollectionSeries, transformCL01 } from './transform'
import type { FenceMetrics, FenceHistoricalData, DateRange } from '../types'

export async function fetchFenceMetrics(slug: string, forceRefresh = false): Promise<FenceMetrics> {
  const cacheKey = CacheKeys.fenceMetrics(slug)

  if (!forceRefresh) {
    const cached = cache.get<FenceMetrics>(cacheKey)
    if (cached && !cached.isStale) return cached.data
  }

  const [paidResult, expectedResult, cl01Result] = await Promise.allSettled([
    fetchMetricLatest(FENCE_METRIC_IDS.paidTotalCollections),
    fetchMetricLatest(FENCE_METRIC_IDS.expectedTotalCollections),
    fetchMetricLatest(FENCE_METRIC_IDS.cl01Concentration),
  ])

  const paidTotalCollections =
    paidResult.status === 'fulfilled'
      ? transformCollectionLatest(paidResult.value)
      : null

  const expectedTotalCollections =
    expectedResult.status === 'fulfilled'
      ? transformCollectionLatest(expectedResult.value)
      : null

  const cl01Concentration =
    cl01Result.status === 'fulfilled'
      ? transformCL01(cl01Result.value)
      : null

  if (paidResult.status === 'rejected') {
    console.warn('[Fence] Failed to fetch paid collections:', paidResult.reason)
  }
  if (expectedResult.status === 'rejected') {
    console.warn('[Fence] Failed to fetch expected collections:', expectedResult.reason)
  }
  if (cl01Result.status === 'rejected') {
    console.warn('[Fence] Failed to fetch CL01:', cl01Result.reason)
  }

  let repaymentRatio: number | null = null
  if (
    paidTotalCollections !== null &&
    expectedTotalCollections !== null &&
    expectedTotalCollections.value > 0
  ) {
    repaymentRatio = paidTotalCollections.value / expectedTotalCollections.value
  }

  const metrics: FenceMetrics = {
    paidTotalCollections,
    expectedTotalCollections,
    cl01Concentration,
    repaymentRatio,
    lastUpdated: new Date().toISOString(),
  }

  cache.set(cacheKey, metrics, {
    ttl: FENCE_CACHE_TTL,
    staleWhileRevalidate: FENCE_STALE_TTL,
  })

  return metrics
}

export async function fetchFenceHistorical(
  slug: string,
  dateRange?: DateRange,
  forceRefresh = false
): Promise<FenceHistoricalData> {
  const startDate = dateRange?.from.toISOString()
  const endDate = dateRange?.to.toISOString()
  const cacheKey = CacheKeys.fenceHistorical(slug, startDate, endDate)

  if (!forceRefresh) {
    const cached = cache.get<FenceHistoricalData>(cacheKey)
    if (cached && !cached.isStale) return cached.data
  }

  const fetchOptions = {
    asOfDateGte: startDate,
    asOfDateLte: endDate,
  }

  const [paidResult, expectedResult] = await Promise.allSettled([
    fetchMetricValues(FENCE_METRIC_IDS.paidTotalCollections, fetchOptions),
    fetchMetricValues(FENCE_METRIC_IDS.expectedTotalCollections, fetchOptions),
  ])

  if (paidResult.status === 'rejected') {
    console.warn('[Fence] Failed to fetch paid historical:', paidResult.reason)
  }
  if (expectedResult.status === 'rejected') {
    console.warn('[Fence] Failed to fetch expected historical:', expectedResult.reason)
  }

  const historical: FenceHistoricalData = {
    paidCollections:
      paidResult.status === 'fulfilled'
        ? transformCollectionSeries(paidResult.value)
        : [],
    expectedCollections:
      expectedResult.status === 'fulfilled'
        ? transformCollectionSeries(expectedResult.value)
        : [],
  }

  cache.set(cacheKey, historical, {
    ttl: FENCE_CACHE_TTL,
    staleWhileRevalidate: FENCE_STALE_TTL,
  })

  return historical
}
