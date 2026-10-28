import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/explorer-query/clickhouse', () => ({ runQuery: vi.fn() }))
vi.mock('@/lib/explorer-query/head', () => ({ chainRpc: () => 'https://rpc.example' }))
vi.mock('viem', async (importOriginal) => ({ ...(await importOriginal<typeof import('viem')>()), createPublicClient: vi.fn() }))

import { createPublicClient } from 'viem'
import { runQuery } from '@/lib/explorer-query/clickhouse'
import type { QueryResult } from '@/lib/explorer-query/clickhouse'
import { getFacility } from '@/lib/rwa/facilities'
import type { LineFacility } from '@/lib/rwa/facilities'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { lineDaysSql, lineLedgerSql, readLineDays, readLineLedger } from '@/lib/rwa/line/events'
import { readCreditPosition } from '@/lib/rwa/line/position'

/* The SQL both reads send, as it was checked on ClickHouse 26.2 against the line's 4,738 logs, a second copy of a
   third of them in an unmerged part, and Borrow logs of another contract and another chain. */

const DAYS_SQL = `
SELECT
  toString(toDate(block_time)) AS day,
  toUInt32(countIf(topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'))) AS draws,
  toString(sumIf(amount, topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'))) AS financed,
  toString(sumIf(amount, topic0 IN (unhex('4eb869c8550f907830288ffb6e6f9d86355a3f4020ce074106ac0a6c092a68b4'), unhex('d45a0dce68a916f445b4d3084924109a7dfd3dc8f6a6bb9ac1b1ca4cc2d45f8f')))) AS repaid,
  toString(toInt256(sumIf(amount, topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'))) - toInt256(sumIf(amount, topic0 = unhex('d45a0dce68a916f445b4d3084924109a7dfd3dc8f6a6bb9ac1b1ca4cc2d45f8f')))) AS outstanding,
  toString(toInt256(sumIf(amount, topic0 IN (unhex('63f955088d646c28b1bea94dfaa4d55e038e7c6cb652b4253ff1c4c7d7a072c7'), unhex('61e34136bfe69c88fdd1fe3680d6a945c4315c058dde04552d23beeeae8ff9c0')))) - toInt256(sumIf(amount, topic0 = unhex('6a3a3f85c3f12798237c9cb4bbb7125eb15c63f144b79a7e922e8055401b638a')))) AS committed,
  minIf(toUnixTimestamp(block_time), topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73')) AS first_draw
FROM (
  SELECT transaction_hash, log_index, block_number, block_time, topic0,
    reinterpretAsUInt256(reverse(assumeNotNull(topic2))) AS amount,
    if(topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'), lower(concat('0x', hex(substring(assumeNotNull(topic3), 13, 20)))), '') AS recipient
  FROM raw_logs
  WHERE chain_id = 43114
    AND topic0 IN (unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'), unhex('4eb869c8550f907830288ffb6e6f9d86355a3f4020ce074106ac0a6c092a68b4'), unhex('d45a0dce68a916f445b4d3084924109a7dfd3dc8f6a6bb9ac1b1ca4cc2d45f8f'), unhex('63f955088d646c28b1bea94dfaa4d55e038e7c6cb652b4253ff1c4c7d7a072c7'), unhex('61e34136bfe69c88fdd1fe3680d6a945c4315c058dde04552d23beeeae8ff9c0'), unhex('6a3a3f85c3f12798237c9cb4bbb7125eb15c63f144b79a7e922e8055401b638a'))
    AND block_number >= 74018962
    AND address = unhex('3042f180826f4d16cfd28296f6362760105b2b94')
    AND topic1 = unhex('0000000000000000000000000000000000000000000000000000000000000003')
    AND NOT removed
  LIMIT 1 BY transaction_hash, log_index
)
GROUP BY day
ORDER BY day
`

const LEDGER_SQL = `
SELECT
  block_number,
  toUnixTimestamp(min(block_time)) AS ts,
  lower(concat('0x', hex(transaction_hash))) AS tx_hash,
  multiIf(topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'), 'draw',
    topic0 IN (unhex('4eb869c8550f907830288ffb6e6f9d86355a3f4020ce074106ac0a6c092a68b4'), unhex('d45a0dce68a916f445b4d3084924109a7dfd3dc8f6a6bb9ac1b1ca4cc2d45f8f')), 'repayment',
    topic0 IN (unhex('63f955088d646c28b1bea94dfaa4d55e038e7c6cb652b4253ff1c4c7d7a072c7'), unhex('61e34136bfe69c88fdd1fe3680d6a945c4315c058dde04552d23beeeae8ff9c0')), 'commitment',
    'withdrawal') AS kind,
  recipient,
  toString(sum(amount)) AS amount,
  min(log_index) AS first_log
FROM (
  SELECT transaction_hash, log_index, block_number, block_time, topic0,
    reinterpretAsUInt256(reverse(assumeNotNull(topic2))) AS amount,
    if(topic0 = unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'), lower(concat('0x', hex(substring(assumeNotNull(topic3), 13, 20)))), '') AS recipient
  FROM raw_logs
  WHERE chain_id = 43114
    AND topic0 IN (unhex('bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'), unhex('4eb869c8550f907830288ffb6e6f9d86355a3f4020ce074106ac0a6c092a68b4'), unhex('d45a0dce68a916f445b4d3084924109a7dfd3dc8f6a6bb9ac1b1ca4cc2d45f8f'), unhex('63f955088d646c28b1bea94dfaa4d55e038e7c6cb652b4253ff1c4c7d7a072c7'), unhex('61e34136bfe69c88fdd1fe3680d6a945c4315c058dde04552d23beeeae8ff9c0'), unhex('6a3a3f85c3f12798237c9cb4bbb7125eb15c63f144b79a7e922e8055401b638a'), unhex('b8635fe5938466cc626f7c214bf818f090e2b736368828f448cd2b379cf0174e'))
    AND block_number >= 74018962
    AND address = unhex('3042f180826f4d16cfd28296f6362760105b2b94')
    AND topic1 = unhex('0000000000000000000000000000000000000000000000000000000000000003')
    AND NOT removed
  LIMIT 1 BY transaction_hash, log_index
)
GROUP BY block_number, transaction_hash, kind, recipient
ORDER BY block_number, first_log
LIMIT 2000
`

const rain = getFacility('rain') as LineFacility
/** the C-Chain client's eth_call: one for the file, since position.ts keeps the first client it makes */
const call = vi.fn()

/** what runQuery answers: the rows, cut once they reach the 2,000-row cap */
const result = (rows: Record<string, unknown>[], truncated = rows.length >= 2000): QueryResult => ({
  columns: [],
  rows,
  rowCount: rows.length,
  elapsedMs: 0,
  rowsRead: 0,
  bytesRead: 0,
  truncated,
  ranAt: '2026-10-27T00:00:00.000Z',
})

/** SQL with each run of whitespace squeezed to one space */
const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim()

/** Rain's facility with its line's address, position id or first block replaced */
const rainWith = ({ address = rain.pool.address, ...line }: { address?: string } & Partial<LineFacility['line']>): LineFacility => ({
  ...rain,
  pool: { ...rain.pool, address },
  line: { ...rain.line, ...line },
})

/** a ledger row as the query service sends it: transaction n, a repayment in block `block` */
const ledgerRow = (n: number, block: number) => ({
  block_number: block,
  ts: 1770925925 + n,
  tx_hash: `0x${n.toString(16).padStart(64, '0')}`,
  kind: 'repayment',
  recipient: '',
  amount: '1000000',
  first_log: 0,
})

/** the words of an eth_call reply, as hex */
const reply = (words: bigint[]) => ({ data: `0x${words.map((w) => w.toString(16).padStart(64, '0')).join('')}` })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(createPublicClient).mockReturnValue({ call } as unknown as ReturnType<typeof createPublicClient>)
  for (const read of ['days', 'ledger', 'position'] as const) cache.invalidate(CacheKeys.line('rain', read))
})

describe("the line's SQL", () => {
  it("asks for the position's days with the SQL checked on ClickHouse", () => {
    expect(flat(lineDaysSql(rain))).toBe(flat(DAYS_SQL))
  })

  it('asks for a ledger page from a block with the SQL checked on ClickHouse', () => {
    expect(flat(lineLedgerSql(rain, 74018962))).toBe(flat(LEDGER_SQL))
    expect(lineLedgerSql(rain, 98000000)).toContain('AND block_number >= 98000000')
  })

  it("keeps each query under the query service's 8 KB cap", () => {
    expect(lineDaysSql(rain).length).toBeLessThan(8192)
    expect(lineLedgerSql(rain, 74018962).length).toBeLessThan(8192)
  })

  // the SQL is text, so these checks are all that stand between a bad value and the query
  it('refuses to build either query from a bad address, position id or block', () => {
    const badLines = [
      rainWith({ address: '0x3042f180826f4D16cFD28296f6362760105b2b9' }), // 39 digits
      rainWith({ address: '0x3042f180826f4D16cFD28296f6362760105b2b9g' }), // not hex
      rainWith({ address: "0x3042f180826f4D16cFD28296f6362760105b2b94') OR (1 = 1" }),
      rainWith({ positionId: -1 }),
      rainWith({ positionId: 1.5 }),
    ]
    for (const facility of badLines) {
      expect(() => lineDaysSql(facility)).toThrow()
      expect(() => lineLedgerSql(facility, 74018962)).toThrow()
    }
    for (const fromBlock of [-1, 1.5, NaN]) {
      expect(() => lineDaysSql(rainWith({ fromBlock }))).toThrow()
      expect(() => lineLedgerSql(rain, fromBlock)).toThrow()
    }
  })
})

describe("the line's days", () => {
  it("reads a day in base units, keeps a negative change's sign, and has no first draw on a day without one", async () => {
    vi.mocked(runQuery).mockResolvedValue(result([
      { day: '2026-02-12', draws: 1, financed: '52713705714', repaid: '50556540000', outstanding: '2159802888', committed: '100000000000', first_draw: 1770925925 },
      { day: '2026-02-13', draws: '1', financed: '44613584286', repaid: '46791227973', outstanding: '-2159802888', committed: '0', first_draw: 1770992144 },
      { day: '2026-06-18', draws: 0, financed: '0', repaid: '49213680486', outstanding: '-49193150603', committed: '0', first_draw: 0 },
    ]))

    expect(await readLineDays(rain)).toEqual([
      { day: '2026-02-12', draws: 1, financed: 52713705714n, repaid: 50556540000n, outstanding: 2159802888n, committed: 100000000000n, firstDrawAt: 1770925925 },
      { day: '2026-02-13', draws: 1, financed: 44613584286n, repaid: 46791227973n, outstanding: -2159802888n, committed: 0n, firstDrawAt: 1770992144 },
      { day: '2026-06-18', draws: 0, financed: 0n, repaid: 49213680486n, outstanding: -49193150603n, committed: 0n, firstDrawAt: null },
    ])
    expect(runQuery).toHaveBeenCalledWith(lineDaysSql(rain))
  })

  it('reads an amount past 2^53 to the unit', async () => {
    vi.mocked(runQuery).mockResolvedValue(result([
      { day: '2026-02-12', draws: 1, financed: '9007199254740993', repaid: '0', outstanding: '9007199254740993', committed: '0', first_draw: 1770925925 },
    ]))

    const [day] = await readLineDays(rain)
    expect(day.financed).toBe(9007199254740993n)
    expect(day.outstanding).toBe(9007199254740993n)
  })

  it('refuses a day list the row cap cut', async () => {
    vi.mocked(runQuery).mockResolvedValue(result([
      { day: '2026-02-12', draws: 0, financed: '0', repaid: '0', outstanding: '0', committed: '0', first_draw: 0 },
    ], true))

    await expect(readLineDays(rain)).rejects.toThrow('row cap')
  })

  it('reads the day list once in five minutes', async () => {
    vi.mocked(runQuery).mockResolvedValue(result([]))

    await readLineDays(rain)
    await readLineDays(rain)
    expect(runQuery).toHaveBeenCalledTimes(1)
  })
})

describe("the line's ledger", () => {
  it('reads a ledger that fits one page in one query', async () => {
    vi.mocked(runQuery).mockResolvedValue(result([
      { block_number: 77914541, ts: 1770925925, tx_hash: '0x971e71a558d2a126b005977e590236b8ef02348748288b1e7435344c2b5152c2', kind: 'draw', recipient: '0xae51564961886aee70941d69a4f5968c96007200', amount: '52713705714', first_log: 380 },
      { block_number: 77920625, ts: 1770932235, tx_hash: '0x70114ca32b714f024fcb64033c79451f67227c1bae4ca11f1ab04aaf567e4d2f', kind: 'repayment', recipient: '', amount: '10000000000', first_log: 18 },
    ]))

    expect(await readLineLedger(rain)).toEqual([
      { txHash: '0x971e71a558d2a126b005977e590236b8ef02348748288b1e7435344c2b5152c2', blockNumber: 77914541, timestamp: 1770925925, kind: 'draw', amount: 52713705714n, recipient: '0xae51564961886aee70941d69a4f5968c96007200' },
      { txHash: '0x70114ca32b714f024fcb64033c79451f67227c1bae4ca11f1ab04aaf567e4d2f', blockNumber: 77920625, timestamp: 1770932235, kind: 'repayment', amount: 10000000000n, recipient: null },
    ])
    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(runQuery).toHaveBeenCalledWith(lineLedgerSql(rain, 74018962))
  })

  it('pages a full ledger from its last block and keeps each entry once', async () => {
    // page 1 ends inside block 5000, so page 2 reads that block again from its start
    const first = [...Array.from({ length: 1998 }, (_, n) => ledgerRow(n, 1000 + n)), ledgerRow(1998, 5000), ledgerRow(1999, 5000)]
    const second = [ledgerRow(1998, 5000), ledgerRow(1999, 5000), ledgerRow(2000, 5001)]
    vi.mocked(runQuery).mockResolvedValueOnce(result(first)).mockResolvedValueOnce(result(second))

    const ledger = await readLineLedger(rain)

    expect(ledger).toHaveLength(2001)
    expect(new Set(ledger.map((entry) => entry.txHash)).size).toBe(2001)
    expect(ledger.map((entry) => entry.blockNumber).slice(-4)).toEqual([2997, 5000, 5000, 5001])
    expect(runQuery).toHaveBeenCalledTimes(2)
    expect(vi.mocked(runQuery).mock.calls[0][0]).toContain('AND block_number >= 74018962')
    expect(vi.mocked(runQuery).mock.calls[1][0]).toContain('AND block_number >= 5000')
  })

  it('refuses a ledger past ten full pages', async () => {
    const page = Array.from({ length: 2000 }, (_, n) => ledgerRow(n, n < 1000 ? 1000 : 1001))
    vi.mocked(runQuery).mockResolvedValue(result(page))

    await expect(readLineLedger(rain)).rejects.toThrow('passed 10 pages')
    expect(runQuery).toHaveBeenCalledTimes(10)
  })

  it('refuses a page that is one block of 2000 entries', async () => {
    // paging could not move past that block
    vi.mocked(runQuery).mockResolvedValue(result(Array.from({ length: 2000 }, (_, n) => ledgerRow(n, 1000))))

    await expect(readLineLedger(rain)).rejects.toThrow('alone fills a page')
    expect(runQuery).toHaveBeenCalledTimes(1)
  })

  it('refuses a row of an unknown kind', async () => {
    vi.mocked(runQuery).mockResolvedValue(result([{ ...ledgerRow(0, 1000), kind: 'fee' }]))

    await expect(readLineLedger(rain)).rejects.toThrow('no known kind: fee')
  })
})

describe("the line's position", () => {
  it('asks the line for its position and reads committed and outstanding only', async () => {
    call.mockResolvedValue(reply([250000000000n, 203533489689n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]))

    expect(await readCreditPosition(rain)).toEqual({ deposit: 250000000000n, principal: 203533489689n })
    expect(call).toHaveBeenCalledWith({ to: rain.pool.address, data: `0x76c1b82f${'0'.repeat(63)}3` })
  })

  it('refuses a reply that is not the 11-word Credit struct', async () => {
    call.mockResolvedValueOnce(reply([250000000000n, 203533489689n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]))
    await expect(readCreditPosition(rain)).rejects.toThrow('Credit struct')

    cache.invalidate(CacheKeys.line('rain', 'position'))
    call.mockResolvedValueOnce({})
    await expect(readCreditPosition(rain)).rejects.toThrow('Credit struct')
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('reads the position once in five minutes', async () => {
    call.mockResolvedValue(reply([250000000000n, 203533489689n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]))

    await readCreditPosition(rain)
    await readCreditPosition(rain)
    expect(call).toHaveBeenCalledTimes(1)
  })
})
