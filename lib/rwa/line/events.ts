import 'server-only'
import { runQuery } from '@/lib/explorer-query/clickhouse'
import { MAX_ROWS } from '@/lib/explorer-query/guard'
import type { LineFacility } from '../facilities'
import { CacheKeys, readThrough } from '../glacier/cache'
import type { LineEventKind } from '../types'

/* A line of credit's events on one position, read from raw_logs through the Stats API's /v2/query: summed by UTC
   day for the figures, and by transaction for the ledger. Every amount is an indexed topic of the event: the
   position id is topic1, the amount topic2, a draw's recipient topic3. Amounts and hashes come back as text, so no
   value passes through a float and runQuery re-reads no byte column; the day is text too, so neither runQuery path
   rewrites it as a time. */

/** one UTC day of the position's events; amounts in USDC base units */
export interface LineDay {
  day: string                  // YYYY-MM-DD
  draws: number
  financed: bigint             // the day's draws, summed
  repaid: bigint               // the day's repayments, interest included: one amount
  outstanding: bigint          // the day's change of outstanding principal: draws minus the principal repaid; can be negative
  committed: bigint            // the day's change of committed capital: credit added or increased, minus deposit withdrawn
  firstDrawAt: number | null   // unix seconds of the day's first draw; null on a day without one
}

/** one transaction's events of one kind on the position */
export interface LineEntry {
  txHash: string
  blockNumber: number
  timestamp: number            // unix seconds
  kind: LineEventKind
  amount: bigint               // the kind's amounts in the transaction, summed: a repayment's principal and interest together
  recipient: string | null     // a draw's `to`, lower case; null for every other kind
}

// each event's topic0, without 0x
const BORROW = 'bec1750eb40c00e8dc2e1c84babbddd5779eaa06c951ab2c66416d05910e7a73'
const REPAY_INTEREST = '4eb869c8550f907830288ffb6e6f9d86355a3f4020ce074106ac0a6c092a68b4'
const REPAY_PRINCIPAL = 'd45a0dce68a916f445b4d3084924109a7dfd3dc8f6a6bb9ac1b1ca4cc2d45f8f'
const ADD_CREDIT = '63f955088d646c28b1bea94dfaa4d55e038e7c6cb652b4253ff1c4c7d7a072c7'
const INCREASE_CREDIT = '61e34136bfe69c88fdd1fe3680d6a945c4315c058dde04552d23beeeae8ff9c0'
const WITHDRAW_DEPOSIT = '6a3a3f85c3f12798237c9cb4bbb7125eb15c63f144b79a7e922e8055401b638a'
const WITHDRAW_PROFIT = 'b8635fe5938466cc626f7c214bf818f090e2b736368828f448cd2b379cf0174e'

/** the events the day figures sum: all but WithdrawProfit, the lender taking out repaid interest, which moves none of them */
const DAY_TOPICS = [BORROW, REPAY_INTEREST, REPAY_PRINCIPAL, ADD_CREDIT, INCREASE_CREDIT, WITHDRAW_DEPOSIT]
/** the events the ledger lists */
const LEDGER_TOPICS = [...DAY_TOPICS, WITHDRAW_PROFIT]

const KINDS: readonly LineEventKind[] = ['draw', 'repayment', 'commitment', 'withdrawal']
/** the most pages one ledger read takes: 20,000 rows, where the line has about 900 today and adds about 100 a month */
const MAX_PAGES = 10

const unhex = (hex: string) => `unhex('${hex}')`
const isEvent = (topic: string) => `topic0 = ${unhex(topic)}`
const isEither = (a: string, b: string) => `topic0 IN (${unhex(a)}, ${unhex(b)})`
const isWholeNumber = (n: number) => Number.isSafeInteger(n) && n >= 0

/**
 * The position's logs from a block on, each once: the subquery both reads share. The read is keyed on raw_logs'
 * sort key (chain_id, topic0, block_number) and leaves out reorged-out rows. The SQL is text, so its hex is built
 * only from values checked here.
 */
function positionLogs(facility: LineFacility, topics: readonly string[], fromBlock: number): string {
  const { address } = facility.pool
  const { positionId } = facility.line
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(`${facility.slug}: the line's address is not 20 bytes of hex`)
  if (!isWholeNumber(positionId)) throw new Error(`${facility.slug}: the position id is not a whole number`)
  if (!isWholeNumber(fromBlock)) throw new Error(`${facility.slug}: the block to read from is not a whole number`)
  return `  SELECT transaction_hash, log_index, block_number, block_time, topic0,
    reinterpretAsUInt256(reverse(assumeNotNull(topic2))) AS amount,
    if(${isEvent(BORROW)}, lower(concat('0x', hex(substring(assumeNotNull(topic3), 13, 20)))), '') AS recipient
  FROM raw_logs
  WHERE chain_id = 43114
    AND topic0 IN (${topics.map(unhex).join(', ')})
    AND block_number >= ${fromBlock}
    AND address = ${unhex(address.slice(2).toLowerCase())}
    AND topic1 = ${unhex(positionId.toString(16).padStart(64, '0'))}
    AND NOT removed
  LIMIT 1 BY transaction_hash, log_index`
}

/** the position's events summed by UTC day since the line was created; the changes subtract in Int256, so they keep their sign */
export function lineDaysSql(facility: LineFacility): string {
  return `SELECT
  toString(toDate(block_time)) AS day,
  toUInt32(countIf(${isEvent(BORROW)})) AS draws,
  toString(sumIf(amount, ${isEvent(BORROW)})) AS financed,
  toString(sumIf(amount, ${isEither(REPAY_INTEREST, REPAY_PRINCIPAL)})) AS repaid,
  toString(toInt256(sumIf(amount, ${isEvent(BORROW)})) - toInt256(sumIf(amount, ${isEvent(REPAY_PRINCIPAL)}))) AS outstanding,
  toString(toInt256(sumIf(amount, ${isEither(ADD_CREDIT, INCREASE_CREDIT)})) - toInt256(sumIf(amount, ${isEvent(WITHDRAW_DEPOSIT)}))) AS committed,
  minIf(toUnixTimestamp(block_time), ${isEvent(BORROW)}) AS first_draw
FROM (
${positionLogs(facility, DAY_TOPICS, facility.line.fromBlock)}
)
GROUP BY day
ORDER BY day`
}

/** one page of the position's ledger from a block on: a row per transaction and kind, in chain order */
export function lineLedgerSql(facility: LineFacility, fromBlock: number): string {
  return `SELECT
  block_number,
  toUnixTimestamp(min(block_time)) AS ts,
  lower(concat('0x', hex(transaction_hash))) AS tx_hash,
  multiIf(${isEvent(BORROW)}, 'draw',
    ${isEither(REPAY_INTEREST, REPAY_PRINCIPAL)}, 'repayment',
    ${isEither(ADD_CREDIT, INCREASE_CREDIT)}, 'commitment',
    'withdrawal') AS kind,
  recipient,
  toString(sum(amount)) AS amount,
  min(log_index) AS first_log
FROM (
${positionLogs(facility, LEDGER_TOPICS, fromBlock)}
)
GROUP BY block_number, transaction_hash, kind, recipient
ORDER BY block_number, first_log
LIMIT ${MAX_ROWS}`
}

type Row = Record<string, unknown>

/** a count, a block number or a time: the query service sends each as a number or as its text */
function numberOf(row: Row, column: string): number {
  const value = Number(row[column])
  if (!Number.isFinite(value)) throw new Error(`the line's ${column} is not a number: ${String(row[column])}`)
  return value
}

/** an amount in base units, read from its text, so no float ever holds it */
function amountOf(row: Row, column: string): bigint {
  return BigInt(String(row[column]))
}

function textOf(row: Row, column: string): string {
  const value = row[column]
  if (typeof value !== 'string') throw new Error(`the line's ${column} is not text: ${String(value)}`)
  return value
}

function toDay(row: Row): LineDay {
  const day = textOf(row, 'day')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`the line's day is not a date: ${day}`)
  const draws = numberOf(row, 'draws')
  return {
    day,
    draws,
    financed: amountOf(row, 'financed'),
    repaid: amountOf(row, 'repaid'),
    outstanding: amountOf(row, 'outstanding'),
    committed: amountOf(row, 'committed'),
    // minIf answers 0 on a day without a draw
    firstDrawAt: draws === 0 ? null : numberOf(row, 'first_draw'),
  }
}

function toEntry(row: Row): LineEntry {
  const kind = KINDS.find((k) => k === row.kind)
  if (!kind) throw new Error(`the line's ledger has a row of no known kind: ${String(row.kind)}`)
  return {
    txHash: textOf(row, 'tx_hash'),
    blockNumber: numberOf(row, 'block_number'),
    timestamp: numberOf(row, 'ts'),
    kind,
    amount: amountOf(row, 'amount'),
    // the SQL writes '' for every kind but a draw
    recipient: textOf(row, 'recipient') || null,
  }
}

/** the position's days, oldest first; refused whole when the row cap cut them */
export function readLineDays(facility: LineFacility): Promise<LineDay[]> {
  return readThrough(CacheKeys.line(facility.slug, 'days'), async () => {
    const result = await runQuery(lineDaysSql(facility))
    if (result.truncated) throw new Error(`${facility.slug}: the line's days passed the ${MAX_ROWS}-row cap`)
    return result.rows.map(toDay)
  })
}

/** the position's ledger in chain order, each transaction's events of each kind once */
export function readLineLedger(facility: LineFacility): Promise<LineEntry[]> {
  return readThrough(CacheKeys.line(facility.slug, 'ledger'), () => ledgerFrom(facility, facility.line.fromBlock, 1))
}

/**
 * The ledger from a block on, a page a query. A page under the row cap is the last. A full page may stop inside its
 * last block, so it keeps the blocks before that one, and the next page reads that block again from its start.
 */
async function ledgerFrom(facility: LineFacility, fromBlock: number, page: number): Promise<LineEntry[]> {
  const entries = (await runQuery(lineLedgerSql(facility, fromBlock))).rows.map(toEntry)
  if (entries.length < MAX_ROWS) return entries
  const lastBlock = entries[entries.length - 1].blockNumber
  if (entries[0].blockNumber === lastBlock) {
    throw new Error(`${facility.slug}: block ${lastBlock} alone fills a page of the line's ledger`)
  }
  if (page === MAX_PAGES) throw new Error(`${facility.slug}: the line's ledger passed ${MAX_PAGES} pages`)
  return [...entries.filter((entry) => entry.blockNumber < lastBlock), ...(await ledgerFrom(facility, lastBlock, page + 1))]
}
