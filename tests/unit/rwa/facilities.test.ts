import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/stats/client', () => ({
  fetchStatsTransfers: vi.fn(),
  fetchStatsBalance: vi.fn(),
}))

import { fetchStatsBalance, fetchStatsTransfers } from '@/lib/rwa/stats/client'
import type { StatsTransfer } from '@/lib/rwa/stats/client'
import { getFacility, isLineFacility, RWA_FACILITIES } from '@/lib/rwa/facilities'
import type { RWAFacility } from '@/lib/rwa/facilities'
import { calculateAllMetrics } from '@/lib/rwa/calculations/metrics'
import { calculateHistoricalData } from '@/lib/rwa/calculations/aggregations'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { serializeBigints } from '@/lib/rwa/utils'

/** Rain's entry, written out: its line of credit's position 3 */
const RAIN = {
  slug: 'rain',
  pool: { address: '0x3042f180826f4D16cFD28296f6362760105b2b94', label: 'Line of credit' },
  borrower: { address: '0xae51564961886aee70941d69a4f5968c96007200', label: 'Rain', partner: 'Rain' },
  lenders: [{ address: '0x41640a4a2ec0caa60ab1f57cd4c614485057af4d', partner: 'Valinor' }],
  usdcTokens: ['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'],
  features: { fence: false },
  line: {
    positionId: 3,
    fromBlock: 74_018_962,
    spigot: { address: '0x0AE1D18e2f23D32a7e44c45984f3505f9f81d04c', label: 'Spigot' },
  },
}

describe('getFacility', () => {
  it("finds OatFi's facility by its slug", () => {
    expect(getFacility('oatfi')).toEqual({
      slug: 'oatfi',
      pool: { address: '0xE25CB545Bdd47a8Ec2d08001cb5661B00D47621a', label: 'Tranche Pool' },
      borrower: { address: '0x41d9569610DaE2B6696797382fb26B5156Db426F', label: 'Borrower Operating', partner: 'OatFi' },
      lenders: [
        { address: '0xE3cdE6F051872E67d0a7C2124E9A024D80E2733f', partner: 'Valinor' },
        { address: '0x7a75539cd0647625217EF93302855DDeB02F7093', partner: 'Avalanche' },
      ],
      usdcTokens: ['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664'],
      features: { fence: true },
    })
  })

  it("reads the old partner slugs valinor and fence as OatFi's facility", () => {
    const oatfi = getFacility('oatfi')
    expect(oatfi).not.toBeNull()
    expect(getFacility('valinor')).toBe(oatfi)
    expect(getFacility('fence')).toBe(oatfi)
  })

  it('finds no facility for a slug it does not list', () => {
    expect(getFacility('nope')).toBeNull()
    // a name every object inherits is a slug like any other
    expect(getFacility('constructor')).toBeNull()
  })

  it('names Rain the line of credit facility, apart from OatFi', () => {
    expect(getFacility('rain')).toEqual(RAIN)
    expect(isLineFacility(getFacility('rain')!)).toBe(true)
    expect(isLineFacility(getFacility('oatfi')!)).toBe(false)
    expect(getFacility('nope')).toBeNull()
  })
})

const USDC = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
const USDC_E = '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664'
const OATFI = RWA_FACILITIES.oatfi

/** a second facility, made up for these tests: none of its addresses is OatFi's */
const SECOND: RWAFacility = {
  slug: 'second',
  pool: { address: '0x000000000000000000000000000000000000A001', label: 'Second Pool' },
  borrower: { address: '0x000000000000000000000000000000000000B001', label: 'Second Borrower', partner: 'Borrower Two' },
  lenders: [{ address: '0x000000000000000000000000000000000000C001', partner: 'Lender Two' }],
  usdcTokens: [USDC],
  features: { fence: false },
}

/** a USDC amount in base units (6 decimals) */
const usdc = (dollars: number) => String(BigInt(dollars) * 1_000_000n)

/* at midday UTC, so the buckets, cut in local time, read the same day in every time zone short of UTC+12 */
const transfer = (txHash: string, day: string, from: string, to: string, dollars: number): StatsTransfer => ({
  token: USDC.toLowerCase(),
  from: from.toLowerCase(),
  to: to.toLowerCase(),
  amount: usdc(dollars),
  txHash,
  blockNumber: Number(txHash),
  logIndex: 0,
  timestamp: Date.parse(`${day}T12:00:00Z`) / 1000,
})

// OatFi: Valinor funds the pool, and the pool finances the borrower
const oatfiFunds = transfer('0x01', '2026-08-03', OATFI.lenders[0].address, OATFI.pool.address, 1_000)
const oatfiDraw = transfer('0x02', '2026-08-04', OATFI.pool.address, OATFI.borrower.address, 600)
// the second facility: its lender funds its pool, the pool finances its borrower, and the borrower repays part
const secondFunds = transfer('0x11', '2026-09-01', SECOND.lenders[0].address, SECOND.pool.address, 400)
const secondDraw = transfer('0x12', '2026-09-02', SECOND.pool.address, SECOND.borrower.address, 200)
const secondRepayment = transfer('0x13', '2026-09-03', SECOND.borrower.address, SECOND.pool.address, 100)

/** the fixture key of an address and a token, both lower-cased */
const keyOf = (address: string, token: string) => `${address.toLowerCase()}:${token.toLowerCase()}`

/** the fixture's answer to a Stats read; a read the fixture does not list fails the test */
const fromFixture = <T>(fixture: Record<string, T>, address: string, token: string): T => {
  const key = keyOf(address, token)
  const answer = fixture[key]
  if (answer === undefined) throw new Error(`unexpected Stats read ${key}`)
  return answer
}

/** what the Stats API lists for each address and token, newest first */
const TRANSFERS: Record<string, StatsTransfer[]> = {
  [keyOf(OATFI.pool.address, USDC)]: [oatfiDraw, oatfiFunds],
  [keyOf(OATFI.pool.address, USDC_E)]: [],
  [keyOf(OATFI.borrower.address, USDC)]: [oatfiDraw],
  [keyOf(OATFI.borrower.address, USDC_E)]: [],
  [keyOf(SECOND.pool.address, USDC)]: [secondRepayment, secondDraw, secondFunds],
  [keyOf(SECOND.borrower.address, USDC)]: [secondRepayment, secondDraw],
}

/** each pool's balance, which its transfers above add up to */
const BALANCES: Record<string, string> = {
  [keyOf(OATFI.pool.address, USDC)]: usdc(400),
  [keyOf(OATFI.pool.address, USDC_E)]: usdc(0),
  [keyOf(SECOND.pool.address, USDC)]: usdc(300),
}

/** every cache key the figures below write, for both facilities */
const WRITTEN_KEYS = [OATFI, SECOND].flatMap((facility) => [
  CacheKeys.transactions(facility.slug, facility.pool.address),
  CacheKeys.transactions(facility.slug, facility.borrower.address),
  CacheKeys.balance(facility.slug, facility.pool.address),
  CacheKeys.historical(facility.slug, 'all', 'daily'),
])

/** the address and token of each transfer list read from the Stats API since the last clear */
const transferReads = () =>
  new Set(vi.mocked(fetchStatsTransfers).mock.calls.map(([address, token]) => keyOf(address, token)))

/** the second facility's own transfer lists: its pool's and its borrower's, in its one token */
const SECOND_READS = new Set([keyOf(SECOND.pool.address, USDC), keyOf(SECOND.borrower.address, USDC)])

describe('a second facility', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
    for (const key of WRITTEN_KEYS) cache.invalidate(key)
    vi.mocked(fetchStatsTransfers).mockImplementation(async (address, token) => fromFixture(TRANSFERS, address, token))
    vi.mocked(fetchStatsBalance).mockImplementation(async (address, token) => ({
      address,
      token,
      balance: fromFixture(BALANCES, address, token),
      totalIn: '0',
      totalOut: '0',
      transferCount: 0,
      lastBlock: 0,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Checked by hand against the fixture, in USDC: committed 400, financed 200, repaid 100, idle 300. The draw
  // and the repayment run between its pool and its borrower, so they stay out of the volume.
  it("computes its own metrics from its own transfers after OatFi's fill the cache", async () => {
    await calculateAllMetrics(OATFI)
    vi.mocked(fetchStatsTransfers).mockClear()

    const metrics = serializeBigints(await calculateAllMetrics(SECOND))

    expect(transferReads()).toEqual(SECOND_READS)
    expect(metrics).toEqual({
      general: {
        transactedVolume: '400000000',
        assetsFinanced: '200000000',
        lenderRepayments: '100000000',
        idleCapital: '300000000',
        committedCapital: '400000000',
        capitalTurnover: 0.5,
        lifeSinceInception: 54,
        avgCapitalRecycling: 108,
        averageCapitalUtilization: 25,
      },
      oatfi: {
        capitalOutstanding: '100000000',
        principalRepayments: '100000000',
        convertedUsdc: '0',
      },
      lenderBreakdown: [
        { lender: 'Lender Two', address: '0x000000000000000000000000000000000000c001', amount: '400000000', percentage: 100 },
      ],
      lastUpdated: '2026-10-27T00:00:00.000Z',
    })
  })

  it("computes its own daily history from its own transfers after OatFi's fills the cache", async () => {
    await calculateHistoricalData(OATFI, 'daily')
    vi.mocked(fetchStatsTransfers).mockClear()

    const history = await calculateHistoricalData(SECOND, 'daily')

    expect(transferReads()).toEqual(SECOND_READS)
    expect(history).toEqual({
      transactedVolume: [{ date: '2026-09-01', value: 400 }],
      assetsFinanced: [{ date: '2026-09-02', value: 200 }],
      lenderRepayments: [{ date: '2026-09-03', value: 100 }],
      capitalUtilization: [
        { date: '2026-09-01', value: 0 },
        { date: '2026-09-02', value: 50 },
        { date: '2026-09-03', value: 25 },
      ],
      committedCapital: [{ date: '2026-09-01', value: 400 }],
      netCapitalPosition: [
        { date: '2026-09-02', value: 200 },
        { date: '2026-09-03', value: 100 },
      ],
    })
  })
})
