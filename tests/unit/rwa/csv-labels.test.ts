import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exportHistoricalToCSV, exportMetricsToCSV, exportTransactionsToCSV } from '@/lib/rwa/export/csv'
import { getFacility } from '@/lib/rwa/facilities'
import type { RWAFacility } from '@/lib/rwa/facilities'
import type { TransactionRecord } from '@/lib/rwa/types'
import { HISTORY, METRICS, RAIN_HISTORY, RAIN_METRICS } from '../explorer/rwa-fixtures'

// OatFi's addresses, lower-cased as the transactions route lists them. Written out, not imported,
// so each label stays pinned to its address whatever the config says.
const POOL = '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a'
const BORROWER = '0x41d9569610dae2b6696797382fb26b5156db426f'
const VALINOR = '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f'
const AVALANCHE = '0x7a75539cd0647625217ef93302855ddeb02f7093'
/** an address outside the facility */
const OUTSIDE = '0x00000000000000000000000000000000000000ee'

/** a second facility, made up for this test: its own addresses and its own names */
const SECOND: RWAFacility = {
  slug: 'second',
  pool: { address: '0x000000000000000000000000000000000000A001', label: 'Second Pool' },
  borrower: { address: '0x000000000000000000000000000000000000B001', label: 'Second Borrower', partner: 'Borrower Two' },
  lenders: [{ address: '0x000000000000000000000000000000000000C001', partner: 'Lender Two' }],
  usdcTokens: ['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'],
  features: { fence: false },
}

/** one ledger row, named by its raw addresses, so a label in the CSV can only come from the export */
const row = (txHash: string, from: string, to: string, direction: TransactionRecord['direction']): TransactionRecord => ({
  txHash,
  timestamp: '2026-10-01T12:00:00.000Z',
  from,
  fromLabel: from,
  to,
  toLabel: to,
  amount: 1_000_000n,
  direction,
})

// Rain's line of credit, its borrower, its lender of record (the holder of Valinor's position token) and its Spigot,
// lower-cased as the transactions route lists them, written out like OatFi's
const LINE = '0x3042f180826f4d16cfd28296f6362760105b2b94'
const RAIN = '0xae51564961886aee70941d69a4f5968c96007200'
const LENDER = '0x41640a4a2ec0caa60ab1f57cd4c614485057af4d'
const SPIGOT = '0x0ae1d18e2f23d32a7e44c45984f3505f9f81d04c'

/** Rain's first draw, repayment and commitment as the transactions route serves them (Task 2's ledger records),
 *  with the ledger's own names, which the export replaces with its own */
const RAIN_ROWS: TransactionRecord[] = [
  { txHash: '0x971e71a558d2a126b005977e590236b8ef02348748288b1e7435344c2b5152c2', timestamp: '2026-02-12T19:52:05.000Z', from: LINE, fromLabel: 'Line of credit', to: RAIN, toLabel: 'Rain', amount: 52713705714n, direction: 'outbound', kind: 'draw' },
  { txHash: '0x70114ca32b714f024fcb64033c79451f67227c1bae4ca11f1ab04aaf567e4d2f', timestamp: '2026-02-12T21:37:15.000Z', from: SPIGOT, fromLabel: 'Spigot', to: LINE, toLabel: 'Line of credit', amount: 10000000000n, direction: 'inbound', kind: 'repayment' },
  { txHash: '0xbf4b90cb50828870adbcd143dca808e2ebcb92b85e383675de35c278fe4b1d60', timestamp: '2026-02-12T19:12:23.000Z', from: LENDER, fromLabel: 'Valinor', to: LINE, toLabel: 'Line of credit', amount: 100000000000n, direction: 'inbound', kind: 'commitment' },
]

/** each CSV the export hands the browser to save */
let saved: Blob[] = []
/** each link the export clicks to save a CSV; its download is the file's name */
let links: { click: () => void; download?: string }[] = []

beforeEach(() => {
  saved = []
  links = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    saved.push(blob as Blob)
    return 'blob:rwa-transactions'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  // the node environment has no DOM: a stand-in for the link the export clicks
  vi.stubGlobal('document', {
    createElement: () => {
      const link = { click: () => {} }
      links.push(link)
      return link
    },
    body: { appendChild: () => {}, removeChild: () => {} },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** the whole text of each CSV saved, in order */
const texts = () => Promise.all(saved.map((blob) => blob.text()))

/** the file name of each CSV saved, in order */
const names = () => links.map((link) => link.download)

/** the From Label and To Label of each row of the one CSV saved */
async function labels(): Promise<string[][]> {
  expect(saved).toHaveLength(1)
  const [header, ...rows] = (await saved[0].text()).split('\n').map((line) => line.split(','))
  const from = header.indexOf('From Label')
  const to = header.indexOf('To Label')
  return rows.map((cells) => [cells[from], cells[to]])
}

describe('the transaction CSV', () => {
  it("names OatFi's four addresses as it always has", async () => {
    exportTransactionsToCSV(
      [
        row('0x01', VALINOR, POOL, 'inbound'),
        row('0x02', AVALANCHE, POOL, 'inbound'),
        row('0x03', POOL, BORROWER, 'internal'),
        row('0x04', BORROWER, OUTSIDE, 'outbound'),
      ],
      getFacility('oatfi')!,
    )

    expect(await labels()).toEqual([
      ['Lender (Valinor)', 'Tranche Pool'],
      ['Lender (Avalanche)', 'Tranche Pool'],
      ['Tranche Pool', 'Borrower (OatFi)'],
      ['Borrower (OatFi)', OUTSIDE],
    ])
  })

  it("names another facility's addresses from that facility's entry", async () => {
    const [pool, borrower, lender] = [SECOND.pool.address, SECOND.borrower.address, SECOND.lenders[0].address].map((a) => a.toLowerCase())
    exportTransactionsToCSV([row('0x11', lender, pool, 'inbound'), row('0x12', pool, borrower, 'internal')], SECOND)

    expect(await labels()).toEqual([
      ['Lender (Lender Two)', 'Second Pool'],
      ['Second Pool', 'Borrower (Borrower Two)'],
    ])
  })

  // OatFi's ledger CSV byte for byte, as it was before Rain's came in: its header and its Direction column do not move
  it("writes OatFi's header and each row's direction as it always has", async () => {
    exportTransactionsToCSV(
      [
        row('0x01', VALINOR, POOL, 'inbound'),
        row('0x02', AVALANCHE, POOL, 'inbound'),
        row('0x03', POOL, BORROWER, 'internal'),
        row('0x04', BORROWER, OUTSIDE, 'outbound'),
      ],
      getFacility('oatfi')!,
    )

    expect(await texts()).toEqual([
      [
        'Date,From Address,From Label,To Address,To Label,Amount (USD),Direction,Tx Hash',
        `2026-10-01T12:00:00.000Z,${VALINOR},Lender (Valinor),${POOL},Tranche Pool,1,inbound,0x01`,
        `2026-10-01T12:00:00.000Z,${AVALANCHE},Lender (Avalanche),${POOL},Tranche Pool,1,inbound,0x02`,
        `2026-10-01T12:00:00.000Z,${POOL},Tranche Pool,${BORROWER},Borrower (OatFi),1,internal,0x03`,
        `2026-10-01T12:00:00.000Z,${BORROWER},Borrower (OatFi),${OUTSIDE},${OUTSIDE},1,outbound,0x04`,
      ].join('\n'),
    ])
  })
})

// OatFi's two CSVs byte for byte, as they were before Rain's came in: the figures and the history do not move
describe("OatFi's figures and history CSVs", () => {
  it('write the figures as they always have', async () => {
    exportMetricsToCSV(METRICS, getFacility('oatfi')!)

    expect(await texts()).toEqual([
      [
        'Metric,Value,Category',
        'Transacted Volume,124154992.423166,General',
        'Assets Financed,61542595.899,General',
        'Lender Repayments,58542596.780686,General',
        'Idle Capital,0.881686,General',
        'Lender Invested Capital,3000000,General',
        'Capital Turnover,20.5141,General',
        'Life Since Inception (Days),359,General',
        'Avg Capital Recycling (Days),17.5,General',
        'Avg Capital Utilization (%),89.41,General',
        'Capital Outstanding,2999999.118314,OatFi',
        'Principal Repayments,58542596.780686,OatFi',
        'Converted USDC,62075897.412054,OatFi',
      ].join('\n'),
    ])
  })

  it('write the history as it always has', async () => {
    exportHistoricalToCSV(HISTORY, getFacility('oatfi')!)

    expect(await texts()).toEqual([
      [
        'Date,Transacted Volume,Assets Financed,Lender Repayments,Capital Utilization (%),Committed Capital,Net Capital Position',
        '2026-02-11,,,,,3000000,',
        '2026-09-28,300000,136000,,99.9,,2999000',
        '2026-09-30,280000,,136000,,,',
      ].join('\n'),
    ])
  })
})

// a figure that is a rate, a term, interest alone or principal repaid alone has no place in Rain's exports
const TERMS = /interest|principal|rate|fee|deadline/i

describe("Rain's figures and history CSVs", () => {
  it("write Rain's figures without transacted volume, the lender split or the OatFi rows", async () => {
    exportMetricsToCSV(RAIN_METRICS, getFacility('rain')!)

    const [csv] = await texts()
    expect(csv).toBe(
      [
        'Metric,Value,Category',
        'Assets Financed,17224206.832469,General',
        'Lender Repayments,17028947.463693,General',
        'Idle Capital,46466.510311,General',
        'Lender Invested Capital,250000,General',
        'Capital Turnover,68.8968,General',
        'Life Since Inception (Days),255,General',
        'Avg Capital Recycling (Days),3.7012,General',
        'Avg Capital Utilization (%),28.68,General',
        'Capital Outstanding,203533.489689,Line of credit',
        'Draws,233,Line of credit',
      ].join('\n'),
    )
    expect(csv).not.toMatch(TERMS)
  })

  it("write Rain's history without a Transacted Volume column, and OatFi's with one", async () => {
    exportHistoricalToCSV(RAIN_HISTORY, getFacility('rain')!)
    exportHistoricalToCSV(HISTORY, getFacility('oatfi')!)

    const [rain, oatfi] = await texts()
    expect(rain.split('\n')[0]).toBe('Date,Assets Financed,Lender Repayments,Capital Utilization (%),Committed Capital,Net Capital Position')
    expect(oatfi.split('\n')[0]).toBe(
      'Date,Transacted Volume,Assets Financed,Lender Repayments,Capital Utilization (%),Committed Capital,Net Capital Position',
    )
    // each of Rain's values under its own column, a day without one left empty
    expect(rain.split('\n').slice(1)).toEqual([
      '2026-02-12,52713.705714,50556.54,2.16,100000,2159.802888',
      '2026-09-03,,,,250000,',
      '2026-10-26,82340.914286,97072.208769,81.41,,203533.489689',
    ])
    expect(rain).not.toMatch(TERMS)
  })
})

describe("Rain's ledger CSV", () => {
  it("writes Rain's ledger with each row's type and the line's parties named", async () => {
    exportTransactionsToCSV(RAIN_ROWS, getFacility('rain')!)

    const [csv] = await texts()
    expect(csv).toBe(
      [
        'Date,From Address,From Label,To Address,To Label,Amount (USD),Type,Tx Hash',
        `2026-02-12T19:52:05.000Z,${LINE},Line of credit,${RAIN},Borrower (Rain),52713.705714,Draw,${RAIN_ROWS[0].txHash}`,
        `2026-02-12T21:37:15.000Z,${SPIGOT},Spigot,${LINE},Line of credit,10000,Repayment,${RAIN_ROWS[1].txHash}`,
        `2026-02-12T19:12:23.000Z,${LENDER},Lender (Valinor),${LINE},Line of credit,100000,Commitment,${RAIN_ROWS[2].txHash}`,
      ].join('\n'),
    )
    // each repayment one amount, interest included: no rate, term, interest or principal column
    expect(csv).not.toMatch(TERMS)
  })
})

// each CSV is named for the day it was saved: OatFi's names stay as they were, and another facility's carry its
// slug, so a day's OatFi and Rain exports never share a name in a downloads folder
describe('the CSV file names', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keep OatFi's names as they always were", () => {
    const oatfi = getFacility('oatfi')!
    exportMetricsToCSV(METRICS, oatfi)
    exportHistoricalToCSV(HISTORY, oatfi)
    exportTransactionsToCSV([row('0x01', VALINOR, POOL, 'inbound')], oatfi)

    expect(names()).toEqual(['rwa-metrics-2026-10-27.csv', 'rwa-historical-2026-10-27.csv', 'rwa-transactions-2026-10-27.csv'])
  })

  it("name Rain's slug, so a day's OatFi and Rain exports never collide", () => {
    const rain = getFacility('rain')!
    exportMetricsToCSV(RAIN_METRICS, rain)
    exportHistoricalToCSV(RAIN_HISTORY, rain)
    exportTransactionsToCSV(RAIN_ROWS, rain)

    expect(names()).toEqual(['rwa-rain-metrics-2026-10-27.csv', 'rwa-rain-historical-2026-10-27.csv', 'rwa-rain-transactions-2026-10-27.csv'])
  })
})
