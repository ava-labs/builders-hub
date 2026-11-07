import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/calculations/metrics', () => ({ calculateAllMetrics: vi.fn() }))
vi.mock('@/lib/rwa/calculations/aggregations', () => ({
  calculateHistoricalData: vi.fn(),
  getMetricTimeSeries: vi.fn(),
}))
vi.mock('@/lib/rwa/fence/metrics', () => ({
  fetchFenceMetrics: vi.fn(),
  fetchFenceHistorical: vi.fn(),
}))
vi.mock('@/lib/rwa/glacier/transactions', () => ({ getAllTrackedTransfers: vi.fn() }))
vi.mock('@/lib/rwa/line/figures', () => ({
  calculateLineMetrics: vi.fn(),
  calculateLineHistory: vi.fn(),
  listLineTransactions: vi.fn(),
}))

import { calculateAllMetrics } from '@/lib/rwa/calculations/metrics'
import { calculateHistoricalData, getMetricTimeSeries } from '@/lib/rwa/calculations/aggregations'
import { fetchFenceHistorical, fetchFenceMetrics } from '@/lib/rwa/fence/metrics'
import { getAllTrackedTransfers } from '@/lib/rwa/glacier/transactions'
import { calculateLineHistory, calculateLineMetrics, listLineTransactions } from '@/lib/rwa/line/figures'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { getFacility, RWA_FACILITIES } from '@/lib/rwa/facilities'
import type { AllMetrics, FenceMetrics, LineFacilityMetrics, ParsedTransfer } from '@/lib/rwa/types'
import { GET as metricsGET } from '@/app/api/dapps/rwa/[slug]/metrics/route'
import { GET as historicalGET } from '@/app/api/dapps/rwa/[slug]/historical/route'
import { GET as transactionsGET } from '@/app/api/dapps/rwa/[slug]/transactions/route'
import { GET as fenceGET } from '@/app/api/dapps/rwa/[slug]/fence/route'
import { GET as fenceHistoricalGET } from '@/app/api/dapps/rwa/[slug]/fence/historical/route'

const SLUG = 'oatfi'
const at = (path: string) => new Request(`http://localhost/api/dapps/rwa/${SLUG}/${path}`)
const params = { params: Promise.resolve({ slug: SLUG }) }

/** a request under valinor, a partner's slug from before facilities, which names OatFi's facility */
const underValinor = (path: string) => new Request(`http://localhost/api/dapps/rwa/valinor/${path}`)
const valinorParams = { params: Promise.resolve({ slug: 'valinor' }) }

const DAY_MS = 86_400_000
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
/** a window the way the view asks Fence for one: whole UTC days, `span` of them, ending `endsAgo` days back */
const fenceWindow = (span: number, endsAgo = 0) => {
  const end = Date.now() - endsAgo * DAY_MS
  return `startDate=${dayOf(end - (span - 1) * DAY_MS)}T00:00:00.000Z&endDate=${dayOf(end)}T23:59:59.999Z`
}

const EMPTY_HISTORY = {
  transactedVolume: [],
  assetsFinanced: [],
  lenderRepayments: [],
  capitalUtilization: [],
  committedCapital: [],
  netCapitalPosition: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  cache.invalidate(CacheKeys.metrics(SLUG))
  cache.invalidate(CacheKeys.fenceMetrics(SLUG))
  cache.invalidate(CacheKeys.fenceHistorical(SLUG))
  cache.invalidate(CacheKeys.metrics('rain'))
})

describe('the Fence metrics route', () => {
  it('answers 503 without passing the upstream error text to the browser', async () => {
    vi.mocked(fetchFenceMetrics).mockRejectedValue(new Error('upstream detail: token xyz expired'))

    const res = await fenceGET(at('fence'), params)

    expect(res.status).toBe(503)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: 'Fence API unavailable' })
    expect(text).not.toContain('xyz')
  })

  it('serves its fresh copy even when a caller asks for a refresh', async () => {
    const fresh = { repaymentRatio: 1, lastUpdated: '2026-10-01T00:00:00.000Z' } as unknown as FenceMetrics
    cache.set(CacheKeys.fenceMetrics(SLUG), fresh)

    const res = await fenceGET(at('fence?refresh=true'), params)

    expect(await res.json()).toEqual(fresh)
    expect(fetchFenceMetrics).not.toHaveBeenCalled()
  })

  it("serves the old partner slug valinor from OatFi's Fence entry", async () => {
    const kept = { repaymentRatio: 1, lastUpdated: '2026-10-01T00:00:00.000Z' } as unknown as FenceMetrics
    cache.set(CacheKeys.fenceMetrics('oatfi'), kept)

    const hit = await fenceGET(underValinor('fence'), valinorParams)

    expect(hit.headers.get('X-Cache')).toBe('HIT')
    expect(await hit.json()).toEqual(kept)

    // once that entry is stale, valinor's refresh asks for OatFi's figures and a failed one falls back to the entry
    cache.set(CacheKeys.fenceMetrics('oatfi'), kept, { ttl: -1 })
    vi.mocked(fetchFenceMetrics).mockRejectedValue(new Error('Fence unavailable'))

    const stale = await fenceGET(underValinor('fence'), valinorParams)

    expect(fetchFenceMetrics).toHaveBeenCalledWith('oatfi')
    expect(stale.headers.get('X-Cache')).toBe('STALE')
    expect(await stale.json()).toEqual(kept)
  })
})

describe('the metrics route', () => {
  it('serves its stale copy for the slug when a refresh fails', async () => {
    const stale = { general: { transactedVolume: '1' }, lastUpdated: '2026-10-01T00:00:00.000Z' }
    // a negative ttl stores the entry already stale but not yet expired
    cache.set(CacheKeys.metrics(SLUG), stale, { ttl: -1 })
    vi.mocked(calculateAllMetrics).mockRejectedValue(new Error('stats api down'))

    const res = await metricsGET(at('metrics'), params)

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Cache')).toBe('STALE')
    expect(await res.json()).toEqual(stale)
  })

  it('serves its fresh copy even when a caller asks for a refresh', async () => {
    const fresh = { general: { transactedVolume: '1' }, lastUpdated: '2026-10-01T00:00:00.000Z' }
    cache.set(CacheKeys.metrics(SLUG), fresh)
    vi.mocked(calculateAllMetrics).mockResolvedValue({ lastUpdated: 'recomputed' } as unknown as AllMetrics)

    const res = await metricsGET(at('metrics?refresh=true'), params)

    expect(await res.json()).toEqual(fresh)
    expect(calculateAllMetrics).not.toHaveBeenCalled()
  })

  // valinor is a partner's slug from before facilities; it names OatFi's facility
  const valinorMetrics = () =>
    metricsGET(new Request('http://localhost/api/dapps/rwa/valinor/metrics'), {
      params: Promise.resolve({ slug: 'valinor' }),
    })

  it("answers the old partner slug valinor with OatFi's metrics", async () => {
    vi.mocked(calculateAllMetrics).mockResolvedValue({
      general: { transactedVolume: 7n },
      lastUpdated: '2026-10-01T00:00:00.000Z',
    } as unknown as AllMetrics)

    const res = await valinorMetrics()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(calculateAllMetrics).toHaveBeenCalledWith(RWA_FACILITIES.oatfi)
    expect(body).toEqual({ general: { transactedVolume: '7' }, lastUpdated: '2026-10-01T00:00:00.000Z' })
    // stored at OatFi's key, the one the stale fallback below reads
    expect(cache.get(CacheKeys.metrics('oatfi'))?.data).toEqual(body)
  })

  it("serves the old partner slug valinor OatFi's stale copy when a refresh fails", async () => {
    const stale = { general: { transactedVolume: '1' }, lastUpdated: '2026-10-01T00:00:00.000Z' }
    cache.set(CacheKeys.metrics('oatfi'), stale, { ttl: -1 })
    vi.mocked(calculateAllMetrics).mockRejectedValue(new Error('stats api down'))

    const res = await valinorMetrics()

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Cache')).toBe('STALE')
    expect(await res.json()).toEqual(stale)
  })
})

describe('the historical route', () => {
  it('rejects a start date that is not an ISO date', async () => {
    vi.mocked(calculateHistoricalData).mockResolvedValue(EMPTY_HISTORY)

    const res = await historicalGET(at('historical?startDate=garbage&endDate=2026-01-01'), params)

    expect(res.status).toBe(400)
    expect(calculateHistoricalData).not.toHaveBeenCalled()
  })

  it('accepts ISO days and ISO timestamps', async () => {
    vi.mocked(calculateHistoricalData).mockResolvedValue(EMPTY_HISTORY)

    const days = await historicalGET(at('historical?startDate=2026-01-01&endDate=2026-02-01'), params)
    const stamps = await historicalGET(at('historical?startDate=2026-01-01T00:00:00.000Z&endDate=2026-02-01T00:00:00.000Z'), params)

    expect(days.status).toBe(200)
    expect(stamps.status).toBe(200)
  })

  it('never forces a recompute for a caller', async () => {
    vi.mocked(calculateHistoricalData).mockResolvedValue(EMPTY_HISTORY)

    await historicalGET(at('historical?refresh=true'), params)

    expect(calculateHistoricalData).toHaveBeenCalledWith(RWA_FACILITIES.oatfi, 'daily', false, undefined)
  })
})

describe('the Fence historical route', () => {
  it('serves its stale copy of the asked window when Fence fails', async () => {
    const stale = { paidCollections: [{ date: '2026-09-30', value: 5 }], expectedCollections: [] }
    const ask = new URLSearchParams(fenceWindow(30))
    const key = CacheKeys.fenceHistorical(SLUG, ask.get('startDate') ?? undefined, ask.get('endDate') ?? undefined)
    cache.set(key, stale, { ttl: -1 })
    vi.mocked(fetchFenceHistorical).mockRejectedValue(new Error('Fence history unavailable'))

    const res = await fenceHistoricalGET(at(`fence/historical?${fenceWindow(30)}`), params)
    cache.invalidate(key)

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Cache')).toBe('STALE')
    expect(await res.json()).toEqual(stale)
  })

  it('accepts each window the view asks for', async () => {
    vi.mocked(fetchFenceHistorical).mockResolvedValue({ paidCollections: [], expectedCollections: [] })

    for (const span of [7, 30, 90, 365]) {
      const res = await fenceHistoricalGET(at(`fence/historical?${fenceWindow(span)}`), params)
      expect(res.status).toBe(200)
    }
  })

  it('rejects a window the view never asks for, so a caller cannot mint a cache entry per request', async () => {
    vi.mocked(fetchFenceHistorical).mockResolvedValue({ paidCollections: [], expectedCollections: [] })
    const today = dayOf(Date.now())
    const asks = [
      `startDate=2020-01-01T00:00:00.000Z&endDate=${today}T23:59:59.999Z`,
      fenceWindow(30).replace('T00:00:00.000Z', 'T00:00:00.001Z'),
      fenceWindow(30, 10),
      fenceWindow(31),
      `startDate=${today}T00:00:00.000Z`,
      'startDate=2026-01-01&endDate=soon',
    ]

    for (const ask of asks) {
      const res = await fenceHistoricalGET(at(`fence/historical?${ask}`), params)
      expect(res.status, ask).toBe(400)
    }
    expect(fetchFenceHistorical).not.toHaveBeenCalled()
  })

  it('never forces a Fence read for a caller', async () => {
    vi.mocked(fetchFenceHistorical).mockResolvedValue({ paidCollections: [], expectedCollections: [] })

    await fenceHistoricalGET(at('fence/historical?refresh=true'), params)

    expect(fetchFenceHistorical).toHaveBeenCalledWith(SLUG, undefined)
  })

  it("serves the old partner slug valinor from OatFi's Fence history entry", async () => {
    const kept = { paidCollections: [{ date: '2026-09-30', value: 5 }], expectedCollections: [] }
    cache.set(CacheKeys.fenceHistorical('oatfi'), kept)

    const hit = await fenceHistoricalGET(underValinor('fence/historical'), valinorParams)

    expect(hit.headers.get('X-Cache')).toBe('HIT')
    expect(await hit.json()).toEqual(kept)

    // once that entry is stale, valinor's refresh asks for OatFi's history and a failed one falls back to the entry
    cache.set(CacheKeys.fenceHistorical('oatfi'), kept, { ttl: -1 })
    vi.mocked(fetchFenceHistorical).mockRejectedValue(new Error('Fence history unavailable'))

    const stale = await fenceHistoricalGET(underValinor('fence/historical'), valinorParams)

    expect(fetchFenceHistorical).toHaveBeenCalledWith('oatfi', undefined)
    expect(stale.headers.get('X-Cache')).toBe('STALE')
    expect(await stale.json()).toEqual(kept)
  })
})

describe('the transactions route', () => {
  it('lists every tracked transfer once, two in one transaction included', async () => {
    const pool = RWA_FACILITIES.oatfi.pool.address.toLowerCase()
    const borrower = RWA_FACILITIES.oatfi.borrower.address.toLowerCase()
    const outside = '0x4c2c0f0bb2631b02ac9299c59690914ee7a200b8'
    const leg = (from: string, to: string, amount: bigint): ParsedTransfer => ({
      txHash: '0xaa',
      blockNumber: 1,
      timestamp: new Date('2026-09-30T12:00:00Z'),
      from,
      to,
      amount,
      isInternal: [pool, borrower].includes(from) && [pool, borrower].includes(to),
    })
    // one transaction moves pool -> borrower and borrower -> outside; the internal leg is listed under both addresses
    const financed = leg(pool, borrower, 100n)
    const sent = leg(borrower, outside, 90n)
    vi.mocked(getAllTrackedTransfers).mockResolvedValue(new Map([[pool, [financed]], [borrower, [financed, sent]]]))

    const res = await transactionsGET(at('transactions'), params)
    const body = (await res.json()) as { total: number; transactions: { from: string; to: string }[] }

    expect(body.total).toBe(2)
    expect(body.transactions.map((t) => `${t.from}>${t.to}`).sort()).toEqual([`${borrower}>${outside}`, `${pool}>${borrower}`].sort())
  })
})

describe("Rain's routes", () => {
  const atRain = (path: string) => new Request(`http://localhost/api/dapps/rwa/rain/${path}`)
  const rainParams = { params: Promise.resolve({ slug: 'rain' }) }

  it("serves Rain's metrics from its line, never from transfers", async () => {
    vi.mocked(calculateLineMetrics).mockResolvedValue({
      line: { capitalOutstanding: 7n, draws: 1 },
      lastUpdated: '2026-10-01T00:00:00.000Z',
    } as unknown as LineFacilityMetrics)

    const res = await metricsGET(atRain('metrics'), rainParams)

    expect(res.status).toBe(200)
    expect(calculateLineMetrics).toHaveBeenCalledTimes(1)
    expect(calculateLineMetrics).toHaveBeenCalledWith(getFacility('rain'))
    expect(calculateAllMetrics).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ line: { capitalOutstanding: '7', draws: 1 }, lastUpdated: '2026-10-01T00:00:00.000Z' })
  })

  it("serves Rain's stale metrics when a refresh fails", async () => {
    const stale = { line: { capitalOutstanding: '1', draws: 1 }, lastUpdated: '2026-10-01T00:00:00.000Z' }
    cache.set(CacheKeys.metrics('rain'), stale, { ttl: -1 })
    vi.mocked(calculateLineMetrics).mockRejectedValue(new Error('the query service is busy'))

    const res = await metricsGET(atRain('metrics'), rainParams)

    expect(calculateLineMetrics).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Cache')).toBe('STALE')
    expect(await res.json()).toEqual(stale)
  })

  it("asks Rain's history from its line, never forcing a read", async () => {
    vi.mocked(calculateLineHistory).mockResolvedValue(EMPTY_HISTORY)

    const res = await historicalGET(atRain('historical?refresh=true'), rainParams)

    expect(res.status).toBe(200)
    expect(calculateLineHistory).toHaveBeenCalledWith(getFacility('rain'), 'daily', undefined)
    expect(calculateHistoricalData).not.toHaveBeenCalled()
  })

  it("answers one series of Rain's history", async () => {
    const history = { ...EMPTY_HISTORY, assetsFinanced: [{ date: '2026-02-12', value: 52713.705714 }] }
    vi.mocked(calculateLineHistory).mockResolvedValue(history)

    const res = await historicalGET(atRain('historical?metric=assetsFinanced'), rainParams)

    expect(await res.json()).toEqual({ metric: 'assetsFinanced', interval: 'daily', data: history.assetsFinanced })
    expect(getMetricTimeSeries).not.toHaveBeenCalled()
  })

  it("lists Rain's ledger from its line, never from transfers", async () => {
    vi.mocked(listLineTransactions).mockResolvedValue([])

    const res = await transactionsGET(atRain('transactions'), rainParams)

    expect(res.status).toBe(200)
    expect(listLineTransactions).toHaveBeenCalledWith(getFacility('rain'))
    expect(getAllTrackedTransfers).not.toHaveBeenCalled()
  })

  it("answers 404 for Rain's Fence routes", async () => {
    const answers = [await fenceGET(atRain('fence'), rainParams), await fenceHistoricalGET(atRain('fence/historical'), rainParams)]

    for (const res of answers) {
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Fence metrics not available for this project' })
    }
    expect(fetchFenceMetrics).not.toHaveBeenCalled()
    expect(fetchFenceHistorical).not.toHaveBeenCalled()
  })
})
