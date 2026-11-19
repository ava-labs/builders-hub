import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rwa/stats/client', () => ({
  fetchStatsTransfers: vi.fn(),
  fetchStatsBalance: vi.fn(),
}))

import { fetchStatsBalance, fetchStatsTransfers } from '@/lib/rwa/stats/client'
import type { StatsTransfer } from '@/lib/rwa/stats/client'
import { calculateAllMetrics } from '@/lib/rwa/calculations/metrics'
import { calculateHistoricalData } from '@/lib/rwa/calculations/aggregations'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { RWA_FACILITIES } from '@/lib/rwa/facilities'
import { serializeBigints } from '@/lib/rwa/utils'
import { GET as transactionsGET } from '@/app/api/dapps/rwa/[slug]/transactions/route'

// OatFi's figures, pinned before the data layer serves more than one facility. A refactor may
// change how these figures are asked for, never the values they come out at.

// OatFi's addresses, as its entry in lib/rwa/facilities.ts lists them, lower-cased. Written out, not
// imported, so a change to one of them fails this test rather than moving with it.
const POOL = '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a'
const BORROWER = '0x41d9569610dae2b6696797382fb26b5156db426f'
const VALINOR = '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f'
const AVALANCHE = '0x7a75539cd0647625217ef93302855ddeb02f7093'
const USDC = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'
const USDC_E = '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664'
/** an exchange outside the facility */
const OUTSIDE = '0x00000000000000000000000000000000000000ee'

/** a USDC amount in base units (6 decimals) */
const usdc = (dollars: number) => String(BigInt(Math.round(dollars * 100)) * 10_000n)

/* at midday UTC, so the buckets, cut in local time, read the same day in every time zone short of UTC+12 */
const transfer = (txHash: string, day: string, token: string, from: string, to: string, amount: string, logIndex = 0): StatsTransfer => ({
  token,
  from,
  to,
  amount,
  txHash,
  blockNumber: Number(txHash),
  logIndex,
  timestamp: Date.parse(`${day}T12:00:00Z`) / 1000,
})

// The lender breakdown lists lenders as they first appear in the pool's transfers, USDC before USDC.e. Avalanche
// funds in USDC and Valinor in USDC.e, so it reads Avalanche first, unlike the config, amount or date order.
const valinorFunds = transfer('0x01', '2026-02-02', USDC_E, VALINOR, POOL, usdc(2_000_000))
const avalancheFunds = transfer('0x02', '2026-02-04', USDC, AVALANCHE, POOL, usdc(1_000_000))
const firstDraw = transfer('0x03', '2026-02-10', USDC, POOL, BORROWER, usdc(1_200_000))
const secondDraw = transfer('0x04', '2026-03-03', USDC, POOL, BORROWER, usdc(450_000))
const firstRepayment = transfer('0x05', '2026-03-24', USDC, BORROWER, POOL, usdc(900_000))
const thirdDraw = transfer('0x06', '2026-04-07', USDC_E, POOL, BORROWER, usdc(700_000))
// one transaction, two tracked transfers: the borrower swaps USDC.e for USDC at the exchange
const swapOut = transfer('0x07', '2026-04-21', USDC_E, BORROWER, OUTSIDE, usdc(250_000))
const swapIn = transfer('0x07', '2026-04-21', USDC, OUTSIDE, BORROWER, usdc(249_912.4), 1)
const secondRepayment = transfer('0x08', '2026-05-12', USDC, BORROWER, POOL, usdc(615_000))

/** the fixture key of an address and a token, both lower-cased: the code asks with checksummed ones */
const keyOf = (address: string, token: string) => `${address.toLowerCase()}:${token.toLowerCase()}`

/** the fixture's answer to a Stats read; a read the fixture does not list fails the test */
const fromFixture = <T>(fixture: Record<string, T>, address: string, token: string): T => {
  const key = keyOf(address, token)
  const answer = fixture[key]
  if (answer === undefined) throw new Error(`unexpected Stats read ${key}`)
  return answer
}

/** what the Stats API lists for each address and token, newest first as it pages back; a transfer between the pool and the borrower shows under both */
const TRANSFERS: Record<string, StatsTransfer[]> = {
  [keyOf(POOL, USDC)]: [secondRepayment, firstRepayment, secondDraw, firstDraw, avalancheFunds],
  [keyOf(POOL, USDC_E)]: [thirdDraw, valinorFunds],
  [keyOf(BORROWER, USDC)]: [secondRepayment, swapIn, firstRepayment, secondDraw, firstDraw],
  [keyOf(BORROWER, USDC_E)]: [swapOut, thirdDraw],
}

/** the pool's balance of each token, which its transfers above add up to */
const BALANCES: Record<string, string> = {
  [keyOf(POOL, USDC)]: usdc(865_000),
  [keyOf(POOL, USDC_E)]: usdc(1_300_000),
}

/** the facility the figures below are asked for */
const OATFI = RWA_FACILITIES.oatfi

/** every cache key the figures below write */
const WRITTEN_KEYS = [
  CacheKeys.transactions('oatfi', POOL),
  CacheKeys.transactions('oatfi', BORROWER),
  CacheKeys.balance('oatfi', POOL),
  CacheKeys.historical('oatfi', 'all', 'daily'),
  CacheKeys.historical('oatfi', 'all', 'weekly'),
  CacheKeys.historical('oatfi', 'all', 'monthly'),
]

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

describe("OatFi's figures on a fixed ledger", () => {
  // Checked by hand against the fixture, in USDC (the snapshot writes base units, 6 decimals):
  //   committedCapital 3,000,000.00 = Valinor 2,000,000 + Avalanche 1,000,000
  //   assetsFinanced   2,350,000.00 = the draws 1,200,000 + 450,000 + 700,000
  //   lenderRepayments 1,515,000.00 = the repayments 900,000 + 615,000
  //   transactedVolume 3,499,912.40 = the lenders' 3,000,000 + the swap's 250,000 out and 249,912.40 in
  // The swap's two transfers share one transaction and both count. Draws and repayments run between
  // the pool and the borrower, so they are internal and stay out of the volume.
  it('the metrics', async () => {
    expect(serializeBigints(await calculateAllMetrics(OATFI))).toMatchInlineSnapshot(`
      {
        "general": {
          "assetsFinanced": "2350000000000",
          "averageCapitalUtilization": 28.023809523809526,
          "avgCapitalRecycling": 329.3757181156645,
          "capitalTurnover": 0.7833,
          "committedCapital": "3000000000000",
          "idleCapital": "2165000000000",
          "lenderRepayments": "1515000000000",
          "lifeSinceInception": 258,
          "transactedVolume": "3499912400000",
        },
        "lastUpdated": "2026-10-27T00:00:00.000Z",
        "lenderBreakdown": [
          {
            "address": "0x7a75539cd0647625217ef93302855ddeb02f7093",
            "amount": "1000000000000",
            "lender": "Avalanche",
            "percentage": 33.33,
          },
          {
            "address": "0xe3cde6f051872e67d0a7c2124e9a024d80e2733f",
            "amount": "2000000000000",
            "lender": "Valinor",
            "percentage": 66.66,
          },
        ],
        "oatfi": {
          "capitalOutstanding": "835000000000",
          "convertedUsdc": "250000000000",
          "principalRepayments": "1515000000000",
        },
      }
    `)
  })

  it('the daily history', async () => {
    expect(await calculateHistoricalData(OATFI, 'daily')).toMatchInlineSnapshot(`
      {
        "assetsFinanced": [
          {
            "date": "2026-02-10",
            "value": 1200000,
          },
          {
            "date": "2026-03-03",
            "value": 450000,
          },
          {
            "date": "2026-04-07",
            "value": 700000,
          },
        ],
        "capitalUtilization": [
          {
            "date": "2026-02-02",
            "value": 0,
          },
          {
            "date": "2026-02-04",
            "value": 0,
          },
          {
            "date": "2026-02-10",
            "value": 40,
          },
          {
            "date": "2026-03-03",
            "value": 55.00000000000001,
          },
          {
            "date": "2026-03-24",
            "value": 25,
          },
          {
            "date": "2026-04-07",
            "value": 48.333333333333336,
          },
          {
            "date": "2026-05-12",
            "value": 27.833333333333332,
          },
        ],
        "committedCapital": [
          {
            "date": "2026-02-02",
            "value": 2000000,
          },
          {
            "date": "2026-02-04",
            "value": 3000000,
          },
        ],
        "lenderRepayments": [
          {
            "date": "2026-03-24",
            "value": 900000,
          },
          {
            "date": "2026-05-12",
            "value": 615000,
          },
        ],
        "netCapitalPosition": [
          {
            "date": "2026-02-10",
            "value": 1200000,
          },
          {
            "date": "2026-03-03",
            "value": 1650000,
          },
          {
            "date": "2026-03-24",
            "value": 750000,
          },
          {
            "date": "2026-04-07",
            "value": 1450000,
          },
          {
            "date": "2026-05-12",
            "value": 835000,
          },
        ],
        "transactedVolume": [
          {
            "date": "2026-02-02",
            "value": 2000000,
          },
          {
            "date": "2026-02-04",
            "value": 1000000,
          },
          {
            "date": "2026-04-21",
            "value": 499912.4,
          },
        ],
      }
    `)
  })

  it('the weekly history', async () => {
    expect(await calculateHistoricalData(OATFI, 'weekly')).toMatchInlineSnapshot(`
      {
        "assetsFinanced": [
          {
            "date": "2026-W07",
            "value": 1200000,
          },
          {
            "date": "2026-W10",
            "value": 450000,
          },
          {
            "date": "2026-W15",
            "value": 700000,
          },
        ],
        "capitalUtilization": [
          {
            "date": "2026-W06",
            "value": 0,
          },
          {
            "date": "2026-W07",
            "value": 40,
          },
          {
            "date": "2026-W10",
            "value": 55.00000000000001,
          },
          {
            "date": "2026-W13",
            "value": 25,
          },
          {
            "date": "2026-W15",
            "value": 48.333333333333336,
          },
          {
            "date": "2026-W20",
            "value": 27.833333333333332,
          },
        ],
        "committedCapital": [
          {
            "date": "2026-W06",
            "value": 3000000,
          },
        ],
        "lenderRepayments": [
          {
            "date": "2026-W13",
            "value": 900000,
          },
          {
            "date": "2026-W20",
            "value": 615000,
          },
        ],
        "netCapitalPosition": [
          {
            "date": "2026-W07",
            "value": 1200000,
          },
          {
            "date": "2026-W10",
            "value": 1650000,
          },
          {
            "date": "2026-W13",
            "value": 750000,
          },
          {
            "date": "2026-W15",
            "value": 1450000,
          },
          {
            "date": "2026-W20",
            "value": 835000,
          },
        ],
        "transactedVolume": [
          {
            "date": "2026-W06",
            "value": 3000000,
          },
          {
            "date": "2026-W17",
            "value": 499912.4,
          },
        ],
      }
    `)
  })

  it('the monthly history', async () => {
    expect(await calculateHistoricalData(OATFI, 'monthly')).toMatchInlineSnapshot(`
      {
        "assetsFinanced": [
          {
            "date": "2026-02",
            "value": 1200000,
          },
          {
            "date": "2026-03",
            "value": 450000,
          },
          {
            "date": "2026-04",
            "value": 700000,
          },
        ],
        "capitalUtilization": [
          {
            "date": "2026-02",
            "value": 40,
          },
          {
            "date": "2026-03",
            "value": 25,
          },
          {
            "date": "2026-04",
            "value": 48.333333333333336,
          },
          {
            "date": "2026-05",
            "value": 27.833333333333332,
          },
        ],
        "committedCapital": [
          {
            "date": "2026-02",
            "value": 3000000,
          },
        ],
        "lenderRepayments": [
          {
            "date": "2026-03",
            "value": 900000,
          },
          {
            "date": "2026-05",
            "value": 615000,
          },
        ],
        "netCapitalPosition": [
          {
            "date": "2026-02",
            "value": 1200000,
          },
          {
            "date": "2026-03",
            "value": 750000,
          },
          {
            "date": "2026-04",
            "value": 1450000,
          },
          {
            "date": "2026-05",
            "value": 835000,
          },
        ],
        "transactedVolume": [
          {
            "date": "2026-02",
            "value": 3000000,
          },
          {
            "date": "2026-04",
            "value": 499912.4,
          },
        ],
      }
    `)
  })

  it('the transactions route at a page size of 100', async () => {
    const res = await transactionsGET(new Request('http://localhost/api/dapps/rwa/oatfi/transactions?pageSize=100'), {
      params: Promise.resolve({ slug: 'oatfi' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=1800')
    expect(await res.json()).toMatchInlineSnapshot(`
      {
        "page": 1,
        "pageSize": 100,
        "total": 9,
        "transactions": [
          {
            "amount": "615000000000",
            "direction": "internal",
            "from": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "fromLabel": "Borrower Operating",
            "timestamp": "2026-05-12T12:00:00.000Z",
            "to": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "toLabel": "Tranche Pool",
            "txHash": "0x08",
          },
          {
            "amount": "249912400000",
            "direction": "inbound",
            "from": "0x00000000000000000000000000000000000000ee",
            "fromLabel": "0x00000000000000000000000000000000000000ee",
            "timestamp": "2026-04-21T12:00:00.000Z",
            "to": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "toLabel": "Borrower Operating",
            "txHash": "0x07",
          },
          {
            "amount": "250000000000",
            "direction": "outbound",
            "from": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "fromLabel": "Borrower Operating",
            "timestamp": "2026-04-21T12:00:00.000Z",
            "to": "0x00000000000000000000000000000000000000ee",
            "toLabel": "0x00000000000000000000000000000000000000ee",
            "txHash": "0x07",
          },
          {
            "amount": "700000000000",
            "direction": "internal",
            "from": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "fromLabel": "Tranche Pool",
            "timestamp": "2026-04-07T12:00:00.000Z",
            "to": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "toLabel": "Borrower Operating",
            "txHash": "0x06",
          },
          {
            "amount": "900000000000",
            "direction": "internal",
            "from": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "fromLabel": "Borrower Operating",
            "timestamp": "2026-03-24T12:00:00.000Z",
            "to": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "toLabel": "Tranche Pool",
            "txHash": "0x05",
          },
          {
            "amount": "450000000000",
            "direction": "internal",
            "from": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "fromLabel": "Tranche Pool",
            "timestamp": "2026-03-03T12:00:00.000Z",
            "to": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "toLabel": "Borrower Operating",
            "txHash": "0x04",
          },
          {
            "amount": "1200000000000",
            "direction": "internal",
            "from": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "fromLabel": "Tranche Pool",
            "timestamp": "2026-02-10T12:00:00.000Z",
            "to": "0x41d9569610dae2b6696797382fb26b5156db426f",
            "toLabel": "Borrower Operating",
            "txHash": "0x03",
          },
          {
            "amount": "1000000000000",
            "direction": "inbound",
            "from": "0x7a75539cd0647625217ef93302855ddeb02f7093",
            "fromLabel": "Avalanche",
            "timestamp": "2026-02-04T12:00:00.000Z",
            "to": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "toLabel": "Tranche Pool",
            "txHash": "0x02",
          },
          {
            "amount": "2000000000000",
            "direction": "inbound",
            "from": "0xe3cde6f051872e67d0a7c2124e9a024d80e2733f",
            "fromLabel": "Valinor",
            "timestamp": "2026-02-02T12:00:00.000Z",
            "to": "0xe25cb545bdd47a8ec2d08001cb5661b00d47621a",
            "toLabel": "Tranche Pool",
            "txHash": "0x01",
          },
        ],
      }
    `)
  })

  it('reads each figure back from its own cache entry', async () => {
    const fresh = {
      metrics: serializeBigints(await calculateAllMetrics(OATFI, true)),
      daily: await calculateHistoricalData(OATFI, 'daily', true),
      weekly: await calculateHistoricalData(OATFI, 'weekly', true),
      monthly: await calculateHistoricalData(OATFI, 'monthly', true),
    }
    expect({
      monthly: await calculateHistoricalData(OATFI, 'monthly'),
      weekly: await calculateHistoricalData(OATFI, 'weekly'),
      daily: await calculateHistoricalData(OATFI, 'daily'),
      metrics: serializeBigints(await calculateAllMetrics(OATFI)),
    }).toEqual(fresh)
  })
})
