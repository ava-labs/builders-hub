// Server-only: Fence metrics orchestrator
// Do NOT import this file from client components

import { FENCE_METRIC_IDS, FENCE_CACHE_TTL, FENCE_STALE_TTL } from '../constants/fence'
import { cache, CacheKeys } from '../glacier/cache'
import { fetchMetricLatest, fetchMetricValues } from './client'
import { transformCollectionLatest, transformCollectionSeries, transformCL01 } from './transform'
import type { FenceMetrics, FenceHistoricalData, DateRange } from '../types'

// A failed read is remembered for a minute: until then the same read throws
// at once, so an outage answers from the route's stale copy or a 503 instead
// of holding a function for the full timeout on every view.
const FAILURE_MEMORY_MS = 60_000

/** the cache entry that remembers a failed read of `key` */
export function fenceFailureKey(key: string): string {
  return `${key}:failed`
}

const failedRecently = (key: string) => cache.get<true>(fenceFailureKey(key)) !== null
const rememberFailure = (key: string) =>
  cache.set(fenceFailureKey(key), true, { ttl: FAILURE_MEMORY_MS, staleWhileRevalidate: 0 })

export async function fetchFenceMetrics(slug: string): Promise<FenceMetrics> {
  const cacheKey = CacheKeys.fenceMetrics(slug)

  const cached = cache.get<FenceMetrics>(cacheKey)
  if (cached && !cached.isStale) return cached.data
  if (failedRecently(cacheKey)) throw new Error('Fence unavailable')

  const results = await Promise.allSettled([
    fetchMetricLatest(FENCE_METRIC_IDS.paidTotalCollections),
    fetchMetricLatest(FENCE_METRIC_IDS.expectedTotalCollections),
    fetchMetricLatest(FENCE_METRIC_IDS.cl01Concentration),
  ])
  const [paidResult, expectedResult, cl01Result] = results

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

  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) rememberFailure(cacheKey)
  // no figure at all is an outage, not three missing figures: the route
  // answers it with its stale copy or a 503
  if (failed === results.length) throw new Error('Fence unavailable')

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

  // a partial read is served once but not kept, so it never replaces a complete copy
  if (failed === 0) {
    cache.set(cacheKey, metrics, {
      ttl: FENCE_CACHE_TTL,
      staleWhileRevalidate: FENCE_STALE_TTL,
    })
  }

  return metrics
}

export async function fetchFenceHistorical(
  slug: string,
  dateRange?: DateRange
): Promise<FenceHistoricalData> {
  const startDate = dateRange?.from.toISOString()
  const endDate = dateRange?.to.toISOString()
  const cacheKey = CacheKeys.fenceHistorical(slug, startDate, endDate)

  const cached = cache.get<FenceHistoricalData>(cacheKey)
  if (cached && !cached.isStale) return cached.data
  if (failedRecently(cacheKey)) throw new Error('Fence history unavailable')

  const fetchOptions = {
    asOfDateGte: startDate,
    asOfDateLte: endDate,
  }

  const results = await Promise.allSettled([
    fetchMetricValues(FENCE_METRIC_IDS.paidTotalCollections, fetchOptions),
    fetchMetricValues(FENCE_METRIC_IDS.expectedTotalCollections, fetchOptions),
  ])
  const [paidResult, expectedResult] = results

  if (paidResult.status === 'rejected') {
    console.warn('[Fence] Failed to fetch paid historical:', paidResult.reason)
  }
  if (expectedResult.status === 'rejected') {
    console.warn('[Fence] Failed to fetch expected historical:', expectedResult.reason)
  }

  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) rememberFailure(cacheKey)
  // no series at all is an outage, not an empty history: the route answers
  // it with its stale copy or a 503 instead of two empty lines
  if (failed === results.length) throw new Error('Fence history unavailable')

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

  // a partial history is served once but not kept
  if (failed === 0) {
    cache.set(cacheKey, historical, {
      ttl: FENCE_CACHE_TTL,
      staleWhileRevalidate: FENCE_STALE_TTL,
    })
  }

  return historical
}
