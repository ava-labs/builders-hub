import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/fence/client', () => ({ fetchMetricLatest: vi.fn(), fetchMetricValues: vi.fn() }))

import { fetchMetricLatest, fetchMetricValues } from '@/lib/rwa/fence/client'
import type { FenceApiMetricValue } from '@/lib/rwa/fence/client'
import { fenceFailureKey, fetchFenceHistorical, fetchFenceMetrics } from '@/lib/rwa/fence/metrics'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'

const SLUG = 'oatfi'
const TIMEOUT = new Error('The operation was aborted due to timeout')

/** one Fence reading of a collections total, in USDC base units */
const reading = (asOf: string, raw: number): FenceApiMetricValue => ({
  id: asOf,
  name: 'collections',
  metric_definition_id: 'metric',
  deal_id: 'deal',
  value: { value: raw, decimals: 6 },
  as_of_date: asOf,
  value_type: null,
})

/** the latest CL01 reading */
const concentration: FenceApiMetricValue = {
  id: 'cl01',
  name: 'cl01',
  metric_definition_id: 'cl01',
  deal_id: 'deal',
  value: 0.128,
  as_of_date: '2026-10-01T17:03:23',
  value_type: null,
  metadata: { comparison_configuration: { threshold_value: 0.35 }, calculation_results: { comparison_result: true } },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  for (const key of [CacheKeys.fenceHistorical(SLUG), CacheKeys.fenceMetrics(SLUG)]) {
    cache.invalidate(key)
    cache.invalidate(fenceFailureKey(key))
  }
})

describe('the Fence collections history', () => {
  it('fails when neither series answers, so the route can say so, and caches nothing', async () => {
    vi.mocked(fetchMetricValues).mockRejectedValue(TIMEOUT)

    await expect(fetchFenceHistorical(SLUG)).rejects.toThrow()
    expect(cache.get(CacheKeys.fenceHistorical(SLUG))).toBeNull()
  })

  it('serves the series that answered without caching the partial history', async () => {
    vi.mocked(fetchMetricValues)
      .mockResolvedValueOnce([reading('2026-09-30T10:00:00', 5_000_000)])
      .mockRejectedValueOnce(TIMEOUT)

    const history = await fetchFenceHistorical(SLUG)

    expect(history).toEqual({ paidCollections: [{ date: '2026-09-30', value: 5 }], expectedCollections: [] })
    expect(cache.get(CacheKeys.fenceHistorical(SLUG))).toBeNull()
  })

  it('caches a history both series answered', async () => {
    vi.mocked(fetchMetricValues).mockResolvedValue([reading('2026-09-30T10:00:00', 5_000_000)])

    await fetchFenceHistorical(SLUG)

    expect(cache.get(CacheKeys.fenceHistorical(SLUG))?.data).toEqual({
      paidCollections: [{ date: '2026-09-30', value: 5 }],
      expectedCollections: [{ date: '2026-09-30', value: 5 }],
    })
  })

  it('does not ask Fence again within a minute of a failed read', async () => {
    vi.mocked(fetchMetricValues).mockRejectedValue(TIMEOUT)

    await expect(fetchFenceHistorical(SLUG)).rejects.toThrow()
    await expect(fetchFenceHistorical(SLUG)).rejects.toThrow()

    expect(fetchMetricValues).toHaveBeenCalledTimes(2)
  })

  it("keeps each day's latest reading whatever order Fence lists them in", async () => {
    vi.mocked(fetchMetricValues).mockResolvedValue([reading('2026-09-30T18:00:00', 7_000_000), reading('2026-09-30T09:00:00', 5_000_000)])

    const history = await fetchFenceHistorical(SLUG)

    expect(history.paidCollections).toEqual([{ date: '2026-09-30', value: 7 }])
  })
})

describe('the Fence latest figures', () => {
  it('fail when no reading answers, so the route serves its stale copy or a 503 instead of n/a', async () => {
    vi.mocked(fetchMetricLatest).mockRejectedValue(TIMEOUT)

    await expect(fetchFenceMetrics(SLUG)).rejects.toThrow()
    expect(cache.get(CacheKeys.fenceMetrics(SLUG))).toBeNull()
  })

  it('serve a partial read once without caching it', async () => {
    vi.mocked(fetchMetricLatest)
      .mockResolvedValueOnce(reading('2026-10-01T17:02:02', 58_837_806_600_000))
      .mockResolvedValueOnce(reading('2026-10-01T17:00:32', 57_867_071_170_000))
      .mockRejectedValueOnce(TIMEOUT)

    const figures = await fetchFenceMetrics(SLUG)

    expect(figures.paidTotalCollections?.value).toBeCloseTo(58_837_806.6)
    expect(figures.cl01Concentration).toBeNull()
    expect(cache.get(CacheKeys.fenceMetrics(SLUG))).toBeNull()
  })

  it('cache a read where every figure answered', async () => {
    vi.mocked(fetchMetricLatest)
      .mockResolvedValueOnce(reading('2026-10-01T17:02:02', 58_837_806_600_000))
      .mockResolvedValueOnce(reading('2026-10-01T17:00:32', 57_867_071_170_000))
      .mockResolvedValueOnce(concentration)

    await fetchFenceMetrics(SLUG)

    expect(cache.get(CacheKeys.fenceMetrics(SLUG))).not.toBeNull()
  })

  it('do not ask Fence again within a minute of a failed read', async () => {
    vi.mocked(fetchMetricLatest).mockRejectedValue(TIMEOUT)

    await expect(fetchFenceMetrics(SLUG)).rejects.toThrow()
    await expect(fetchFenceMetrics(SLUG)).rejects.toThrow()

    expect(fetchMetricLatest).toHaveBeenCalledTimes(3)
  })
})
