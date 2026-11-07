import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn() }))
vi.mock('@/lib/rwa/line/position', () => ({ readCreditPosition: vi.fn() }))

import { runQuery } from '@/lib/explorer-query/clickhouse'
import type { QueryResult } from '@/lib/explorer-query/clickhouse'
import { getFacility } from '@/lib/rwa/facilities'
import type { LineFacility } from '@/lib/rwa/facilities'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { calculateLineHistory, calculateLineMetrics, listLineTransactions } from '@/lib/rwa/line/figures'
import { readCreditPosition } from '@/lib/rwa/line/position'
import type { TransactionRecord } from '@/lib/rwa/types'
import { GET as metricsGET } from '@/app/api/dapps/rwa/[slug]/metrics/route'
import { GET as historicalGET } from '@/app/api/dapps/rwa/[slug]/historical/route'
import { GET as transactionsGET } from '@/app/api/dapps/rwa/[slug]/transactions/route'
import { RAIN_DAYS } from './rain-line.fixture'

/* Rain's figures at block 98,617,516 (2026-10-26 15:55:14 UTC), the block the build notes read them at: the line's
   days from the fixture, five of its ledger rows, and the position as getCreditPosition(3) read it at that block. */

const rain = getFacility('rain') as LineFacility

/** the fixture's days as lineDaysSql's rows */
const DAY_ROWS = RAIN_DAYS.map(([day, draws, financed, repaid, outstanding, committed, first_draw]) => ({
  day,
  draws,
  financed,
  repaid,
  outstanding,
  committed,
  first_draw,
}))

/** five real rows of lineLedgerSql at the reference block: the first commitment, the first draw, the first repayment,
 *  the lender's withdrawal, and the last repayment, whose 17,621.573983 is the Spigot's whole transfer (research 01
 *  section 4) */
const LEDGER = [
  { block_number: 77912246, ts: 1770923543, tx_hash: '0xbf4b90cb50828870adbcd143dca808e2ebcb92b85e383675de35c278fe4b1d60', kind: 'commitment', recipient: '', amount: '100000000000', first_log: 40 },
  { block_number: 77914541, ts: 1770925925, tx_hash: '0x971e71a558d2a126b005977e590236b8ef02348748288b1e7435344c2b5152c2', kind: 'draw', recipient: '0xae51564961886aee70941d69a4f5968c96007200', amount: '52713705714', first_log: 380 },
  { block_number: 77920625, ts: 1770932235, tx_hash: '0x70114ca32b714f024fcb64033c79451f67227c1bae4ca11f1ab04aaf567e4d2f', kind: 'repayment', recipient: '', amount: '10000000000', first_log: 18 },
  { block_number: 92491940, ts: 1786378517, tx_hash: '0x6dbd6592ced8cd128e91c409575957701340ebeff5707a1953ec33f2ce3a6663', kind: 'withdrawal', recipient: '', amount: '4406473522', first_log: 137 },
  { block_number: 98615151, ts: 1793027939, tx_hash: '0xb3e02832ba2f227a6cee72bbf0bca5bc2b6d3c34af181de265065c1c790a4e29', kind: 'repayment', recipient: '', amount: '17621573983', first_log: 7 },
]

const line = '0x3042f180826f4d16cfd28296f6362760105b2b94'
const strategy = '0x41640a4a2ec0caa60ab1f57cd4c614485057af4d'
const spigot = '0x0ae1d18e2f23d32a7e44c45984f3505f9f81d04c'

/** LEDGER's rows as ledger records, oldest first */
const RECORDS: TransactionRecord[] = [
  { txHash: LEDGER[0].tx_hash, timestamp: '2026-02-12T19:12:23.000Z', from: strategy, fromLabel: 'Valinor', to: line, toLabel: 'Line of credit', amount: 100000000000n, direction: 'inbound', kind: 'commitment' },
  { txHash: LEDGER[1].tx_hash, timestamp: '2026-02-12T19:52:05.000Z', from: line, fromLabel: 'Line of credit', to: '0xae51564961886aee70941d69a4f5968c96007200', toLabel: 'Rain', amount: 52713705714n, direction: 'outbound', kind: 'draw' },
  { txHash: LEDGER[2].tx_hash, timestamp: '2026-02-12T21:37:15.000Z', from: spigot, fromLabel: 'Spigot', to: line, toLabel: 'Line of credit', amount: 10000000000n, direction: 'inbound', kind: 'repayment' },
  { txHash: LEDGER[3].tx_hash, timestamp: '2026-08-10T16:15:17.000Z', from: line, fromLabel: 'Line of credit', to: strategy, toLabel: 'Valinor', amount: 4406473522n, direction: 'outbound', kind: 'withdrawal' },
  { txHash: LEDGER[4].tx_hash, timestamp: '2026-10-26T15:18:59.000Z', from: spigot, fromLabel: 'Spigot', to: line, toLabel: 'Line of credit', amount: 17621573983n, direction: 'inbound', kind: 'repayment' },
]

/** a record as the transactions route serves it: the amount as text */
const served = (record: TransactionRecord) => ({ ...record, amount: record.amount.toString() })

/** what runQuery answers: every row, under the 2,000-row cap */
const result = (rows: Record<string, unknown>[]): QueryResult => ({
  columns: [],
  rows,
  rowCount: rows.length,
  elapsedMs: 0,
  rowsRead: 0,
  bytesRead: 0,
  truncated: false,
  ranAt: '2026-10-26T15:55:14.000Z',
})

type Route = (request: Request, context: { params: Promise<{ slug: string }> }) => Promise<Response>

/** one of Rain's routes, asked for a path */
const ask = (route: Route, path: string) =>
  route(new Request(`http://localhost/api/dapps/rwa/rain/${path}`), { params: Promise.resolve({ slug: 'rain' }) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T15:55:14Z'))
  for (const read of ['days', 'ledger', 'position'] as const) cache.invalidate(CacheKeys.line('rain', read))
  cache.invalidate(CacheKeys.metrics('rain'))
  vi.mocked(runQuery).mockImplementation(async (sql) => result(sql.includes('GROUP BY day') ? DAY_ROWS : LEDGER))
  vi.mocked(readCreditPosition).mockResolvedValue({ deposit: 250000000000n, principal: 203533489689n })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Rain's figures at block 98,617,516", () => {
  it("Rain's metrics route matches the build notes at block 98,617,516, to the base unit", async () => {
    const res = await metricsGET(new Request('http://localhost/api/dapps/rwa/rain/metrics'), { params: Promise.resolve({ slug: 'rain' }) })
    const body = await res.json()
    expect(body.general.assetsFinanced).toBe('17224206832469')
    expect(body.line.draws).toBe(233)
    expect(body.general.lenderRepayments).toBe('17028947463693')
    expect(body.general.committedCapital).toBe('250000000000')
    expect(body.line.capitalOutstanding).toBe('203533489689')
    expect(body.general.idleCapital).toBe('46466510311')
    expect(body.general.capitalTurnover).toBe(68.8968)
    expect(body.general.lifeSinceInception).toBe(255)
    expect(body.general.avgCapitalRecycling).toBeCloseTo(3.7012, 4)
    expect(body.general.averageCapitalUtilization).toBeCloseTo(28.679, 3)
    // the map's identity: repayments - financed + outstanding is the interest repaid, though no figure shows it
    expect(BigInt(body.general.lenderRepayments) - BigInt(body.general.assetsFinanced) + BigInt(body.line.capitalOutstanding)).toBe(8274120913n)
    expect(Object.keys(body)).toEqual(['general', 'line', 'lastUpdated'])
    expect(Object.keys(body.general)).toEqual(['assetsFinanced', 'lenderRepayments', 'idleCapital', 'committedCapital', 'capitalTurnover', 'lifeSinceInception', 'avgCapitalRecycling', 'averageCapitalUtilization'])
    expect(Object.keys(body.line)).toEqual(['capitalOutstanding', 'draws'])
  })

  it("Rain's daily history ends on the contract's outstanding and committed figures", async () => {
    const h = await calculateLineHistory(rain, 'daily')
    expect(h.transactedVolume).toEqual([])
    expect(h.assetsFinanced).toHaveLength(231)
    expect(h.assetsFinanced[0]).toEqual({ date: '2026-02-12', value: 52713.705714 })
    expect(h.lenderRepayments).toHaveLength(232)
    expect(h.committedCapital).toEqual([{ date: '2026-02-12', value: 100000 }, { date: '2026-09-03', value: 250000 }])
    expect(h.netCapitalPosition.slice(0, 2)).toEqual([{ date: '2026-02-12', value: 2159.802888 }, { date: '2026-02-13', value: 0 }])
    expect(h.netCapitalPosition.at(-1)).toEqual({ date: '2026-10-26', value: 203533.489689 })
    expect(h.capitalUtilization).toHaveLength(233)
    expect(h.capitalUtilization[0].value).toBeCloseTo(2.159802888, 9)
    expect(h.capitalUtilization.at(-1)?.value).toBeCloseTo(81.4133958756, 9)
  })

  it("buckets Rain's history by UTC week and month", async () => {
    const weeks = await calculateLineHistory(rain, 'weekly')
    expect(weeks.assetsFinanced).toHaveLength(36)
    expect(weeks.assetsFinanced[0].date).toBe('2026-02-09')
    expect(weeks.assetsFinanced.every((p) => new Date(`${p.date}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
    expect(weeks.assetsFinanced.reduce((s, p) => s + p.value, 0)).toBeCloseTo(17224206.832469, 4)
    expect(weeks.netCapitalPosition.at(-1)).toEqual({ date: '2026-10-26', value: 203533.489689 })
    const months = await calculateLineHistory(rain, 'monthly')
    expect(months.assetsFinanced.map((p) => p.date)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'])
  })

  it("cuts Rain's history to a window of whole UTC days", async () => {
    const september = { from: new Date('2026-09-01T00:00:00.000Z'), to: new Date('2026-09-30T23:59:59.999Z') }

    const h = await calculateLineHistory(rain, 'daily', september)
    const points = Object.values(h).flat()

    expect(points.length).toBeGreaterThan(0)
    expect(points.every((p) => p.date.startsWith('2026-09'))).toBe(true)
    expect(h.committedCapital).toEqual([{ date: '2026-09-03', value: 250000 }])
    // the window's last day is kept whole: the line has days on 09-30 and 10-01
    expect(h.netCapitalPosition.at(-1)?.date).toBe('2026-09-30')

    // and its first: a window of one day keeps that day
    const oneDay = { from: new Date('2026-09-03T00:00:00.000Z'), to: new Date('2026-09-03T23:59:59.999Z') }
    const third = await calculateLineHistory(rain, 'daily', oneDay)
    expect(third.committedCapital).toEqual([{ date: '2026-09-03', value: 250000 }])
    expect(third.netCapitalPosition.map((p) => p.date)).toEqual(['2026-09-03'])
  })
})

describe("Rain's ledger", () => {
  it("lists Rain's line events as ledger rows, each repayment one amount", async () => {
    expect(await listLineTransactions(rain)).toEqual(RECORDS)
  })

  it('labels a draw to an address the facility does not name with that address, and a draw with no recipient goes to the borrower', async () => {
    const outside = '0x00000000000000000000000000000000000000ee'
    vi.mocked(runQuery).mockResolvedValue(result([
      { ...LEDGER[1], recipient: outside },
      { ...LEDGER[1], tx_hash: `0x${'1'.repeat(64)}`, recipient: '' },
    ]))

    const [elsewhere, unnamed] = await listLineTransactions(rain)

    expect(elsewhere).toMatchObject({ from: line, to: outside, toLabel: outside, kind: 'draw' })
    expect(unnamed).toMatchObject({ from: line, to: '0xae51564961886aee70941d69a4f5968c96007200', toLabel: 'Rain', kind: 'draw' })
  })

  it("Rain's transactions route cuts by type", async () => {
    const all = await (await ask(transactionsGET, 'transactions?pageSize=100')).json()
    expect(all.total).toBe(5)
    // newest first, each row the record as served, its labels and type included
    expect(all.transactions).toEqual([...RECORDS].reverse().map(served))

    const repayments = await (await ask(transactionsGET, 'transactions?pageSize=100&kind=repayment')).json()
    expect(repayments.total).toBe(2)
    expect(repayments.transactions).toEqual([RECORDS[4], RECORDS[2]].map(served))

    const draws = await (await ask(transactionsGET, 'transactions?pageSize=100&kind=draw')).json()
    expect(draws.total).toBe(1)
    expect(draws.transactions).toEqual([served(RECORDS[1])])

    // a type the line has no events of is a bad request, not an empty page
    expect((await ask(transactionsGET, 'transactions?kind=interest')).status).toBe(400)
  })
})

describe("what Rain's routes leave out", () => {
  it('serves no interest, principal-only, rate, fee or deadline field for Rain', async () => {
    const responses = await Promise.all([
      ask(metricsGET, 'metrics'),
      ask(historicalGET, 'historical?metric=all'),
      ask(transactionsGET, 'transactions?pageSize=100'),
    ])
    const keys = new Set<string>()
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(collect)
      } else if (value !== null && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key)
          collect(inner)
        }
      }
    }

    for (const res of responses) {
      expect(res.status).toBe(200)
      collect(await res.json())
    }

    // the scan reached the line's figures, the history's series and the ledger's rows
    expect([...keys]).toEqual(expect.arrayContaining(['capitalOutstanding', 'netCapitalPosition', 'kind']))
    expect([...keys].filter((key) => /interest|principal|rate|fee|deadline/i.test(key))).toEqual([])
  })
})

describe("Rain's figures at their edges", () => {
  it('gives zeros, not NaN, before the first draw', async () => {
    vi.mocked(runQuery).mockResolvedValue(result([]))
    vi.mocked(readCreditPosition).mockResolvedValue({ deposit: 0n, principal: 0n })

    const metrics = await calculateLineMetrics(rain)

    expect(metrics.general).toEqual({
      assetsFinanced: 0n,
      lenderRepayments: 0n,
      idleCapital: 0n,
      committedCapital: 0n,
      capitalTurnover: 0,
      lifeSinceInception: 0,
      avgCapitalRecycling: 0,
      averageCapitalUtilization: 0,
    })
    expect(metrics.line).toEqual({ capitalOutstanding: 0n, draws: 0 })
    expect(await calculateLineHistory(rain)).toEqual({
      transactedVolume: [],
      assetsFinanced: [],
      lenderRepayments: [],
      capitalUtilization: [],
      committedCapital: [],
      netCapitalPosition: [],
    })
  })

  it('answers a failed read with nothing kept as an error, never as zeros', async () => {
    // beforeEach cleared the line's reads and the metrics entry, so nothing is cached to fall back on
    vi.mocked(runQuery).mockRejectedValue(new Error('the query service is busy'))

    const res = await ask(metricsGET, 'metrics')

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to fetch metrics' })
  })

  it('keeps utilization between 0 and 100, and idle capital at 0, whatever outstanding and committed read', async () => {
    // states the line does not allow, each still in range: a draw before any commitment, more outstanding than
    // committed, and less than nothing outstanding
    vi.mocked(runQuery).mockResolvedValue(result([
      { day: '2026-02-11', draws: 1, financed: '50000000', repaid: '0', outstanding: '50000000', committed: '0', first_draw: 1770800000 },
      { day: '2026-02-12', draws: 1, financed: '100000000', repaid: '0', outstanding: '100000000', committed: '100000000', first_draw: 1770925925 },
      { day: '2026-02-13', draws: 0, financed: '0', repaid: '200000000', outstanding: '-200000000', committed: '0', first_draw: 0 },
    ]))
    vi.mocked(readCreditPosition).mockResolvedValue({ deposit: 100000000n, principal: 150000000n })

    expect((await calculateLineMetrics(rain)).general.idleCapital).toBe(0n)
    expect((await calculateLineHistory(rain)).capitalUtilization).toEqual([
      { date: '2026-02-11', value: 0 },
      { date: '2026-02-12', value: 100 },
      { date: '2026-02-13', value: 0 },
    ])
  })
})
