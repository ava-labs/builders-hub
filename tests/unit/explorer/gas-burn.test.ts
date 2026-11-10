import { describe, expect, it } from 'vitest';
import { sumFeesWei } from '@/lib/evm-burn';
import {
  BURNERS_KEPT,
  burnDays,
  burnWindow,
  burnersSql,
  codeKind,
  dailyBurn,
  parseBurners,
  seriesCut,
  weiToAvax,
  type BurnerRow,
} from '@/lib/gas-burners';

// What the gas page's burn sections count: a C-Chain transaction burns its whole fee (receipt gasUsed x
// effectiveGasPrice, the tip included), each wallet's burn is the sum of its fees, and the windows are complete UTC
// days.

describe('the burn of a transaction', () => {
  // block 96,883,690 (after Helicon): its five receipts, read from the public RPC on 2026-10-06. The blackhole
  // 0x0100...0000 (the block's miner) gained 12,809,625,668,279,686 wei at this block, read on the archive node. The
  // header math (gasUsed 4,615,769 x baseFeePerGas 5,280,816,683) gives about twice that: since Helicon the header
  // counts the reserved gas at the worst-case base fee, so it is not the burn.
  const receipts = [
    { gasUsed: '0xc350', effectiveGasPrice: '0x1cea45264' },
    { gasUsed: '0xac06', effectiveGasPrice: '0x196eb976d' },
    { gasUsed: '0x1f70e', effectiveGasPrice: '0x19dd53d25' },
    { gasUsed: '0x259d6', effectiveGasPrice: '0x162abef8b' },
    { gasUsed: '0x1e8480', effectiveGasPrice: '0x13342e603' },
  ];

  it('is gasUsed times effectiveGasPrice, summed: the blackhole gain to the wei', () => {
    expect(sumFeesWei(receipts)).toBe(12_809_625_668_279_686n);
  });
});

describe('the board windows', () => {
  it('serve the smallest computed window that covers the clock, at most 90 days', () => {
    expect([0, 1, Number.NaN].map(burnDays)).toEqual([1, 1, 1]);
    expect([2, 7, 8, 30, 31, 90, 365, 3650].map(burnDays)).toEqual([7, 7, 30, 30, 90, 90, 90, 90]);
  });

  it('are complete UTC days that end before today', () => {
    expect(burnWindow(7, new Date('2026-10-06T14:30:00Z'))).toEqual({
      from: '2026-09-29',
      to: '2026-10-05',
      start: '2026-09-29 00:00:00',
      end: '2026-10-06 00:00:00',
    });
    // at midnight the day that just ended is the window
    expect(burnWindow(1, new Date('2026-10-06T00:00:00Z'))).toMatchObject({ from: '2026-10-05', to: '2026-10-05' });
    expect(burnWindow(30, new Date('2026-10-05T23:59:59Z'))).toMatchObject({ from: '2026-09-05', to: '2026-10-04' });
  });
});

describe('the board query', () => {
  const sql = burnersSql(43114, '2026-09-29 00:00:00', '2026-10-06 00:00:00');

  it('reads the window and widens the fee so it cannot overflow', () => {
    expect(sql).toContain("block_time >= toDateTime('2026-09-29 00:00:00', 'UTC')");
    expect(sql).toContain("block_time < toDateTime('2026-10-06 00:00:00', 'UTC')");
    expect(sql).toContain('toUInt256(gas_used) * gas_price');
    expect(sql).toContain('chain_id = 43114');
    expect(sql).toMatch(new RegExp(`LIMIT ${BURNERS_KEPT}$`));
  });

  it('says whether the index holds the whole last day: a transaction at or after the window end', () => {
    expect(sql).toMatch(/\(SELECT max\(block_time\) FROM evm_txs WHERE chain_id = 43114 AND block_time >= toDateTime\('2026-10-06 00:00:00', 'UTC'\) - INTERVAL 1 HOUR\) >= toDateTime\('2026-10-06 00:00:00', 'UTC'\) AS complete/);
  });

  it('passes the query service: short, no SETTINGS, none of the words it refuses', () => {
    expect(sql.length).toBeLessThan(8192);
    expect(sql).not.toMatch(/\bSETTINGS\b/i);
    expect(sql).not.toMatch(/\b(set|use|file|url|system|create)[\s(]/i);
    expect(sql.trimStart()).toMatch(/^SELECT/);
  });
});

describe('the board figures', () => {
  // two rows of the 7-day board read on 2026-10-06; the totals are larger than 2^53 wei
  const rows: BurnerRow[] = [
    {
      wallet: '0xc5f6fe56976e0a55aed6c0e08951a8a2f8980f45',
      txs: 35572,
      burned_wei: '1095710000000000000000',
      target: '0x0ac011eb02a44d3fd7ad2e837a9f5a330913af13',
      target_wei: '1095710000000000000000',
      total_wei: '10799728438000000000000',
      total_txs: '2126067',
      wallets: '183237',
      complete: 1,
    },
    {
      wallet: '0xb5caca56dbb4801f351871c75887c9a8361c7073',
      txs: '13645',
      burned_wei: '273460000000000000000',
      target: null,
      target_wei: '266473000000000000000',
      total_wei: '10799728438000000000000',
      total_txs: 2126067,
      wallets: 183237,
      complete: 1,
    },
  ];

  it('turn wei into AVAX without losing the large sums', () => {
    expect(weiToAvax('1000000000000000000')).toBe(1);
    expect(weiToAvax('10799728438000000000000')).toBe(10799.728438);
    expect(weiToAvax(12_809_625_668_279_686n)).toBe(0.012809);
  });

  it('give each wallet its share of the window and its main receiver', () => {
    const board = parseBurners(rows);
    expect(board).toMatchObject({ total: 10799.728438, txs: 2126067, wallets: 183237, complete: true });
    expect(board.burners[0]).toMatchObject({ wallet: rows[0].wallet, burned: 1095.71, txs: 35572, target: rows[0].target, targetPct: 100 });
    expect(board.burners[0].sharePct).toBeCloseTo((1095.71 / 10799.728438) * 100, 3);
    // a contract creation has no receiver
    expect(board.burners[1]).toMatchObject({ target: null, txs: 13645, targetName: null, targetKind: null });
    expect(board.burners[1].targetPct).toBeCloseTo((266.473 / 273.46) * 100, 3);
  });

  it('read an empty window as nothing burned, and not complete', () => {
    expect(parseBurners([])).toEqual({ total: 0, txs: 0, wallets: 0, complete: false, burners: [] });
  });

  it('are not complete while the index has not passed the window end', () => {
    expect(parseBurners([{ ...rows[0], complete: 0 }]).complete).toBe(false);
    expect(parseBurners([{ ...rows[0], complete: false }]).complete).toBe(false);
    expect(parseBurners([{ ...rows[0], complete: true }]).complete).toBe(true);
  });

  it('call an address with no code an account', () => {
    expect(codeKind('0x')).toBe('account');
    expect(codeKind('0x6080604052')).toBe('contract');
    expect([undefined, null, 'oops', 42].map(codeKind)).toEqual([null, null, null, null]);
  });
});

describe('the daily burn series', () => {
  // the chain-stats route sends the newest day first, today's partial day included
  const rows = [
    { date: '2026-10-06', value: 1003.48 },
    { date: '2026-10-05', value: '1041.49' },
    { date: '2026-10-04', value: 692.78 },
    { date: '2026-10-03', value: Number.NaN },
    { date: '2026-10-02', value: 1631.15 },
  ];

  it('keeps complete days only, oldest first, the last n of them', () => {
    expect(dailyBurn(rows, '2026-10-06', 2)).toEqual([
      { d: '2026-10-04', v: 692.78 },
      { d: '2026-10-05', v: 1041.49 },
    ]);
    expect(dailyBurn(rows, '2026-10-06', 30).map((r) => r.d)).toEqual(['2026-10-02', '2026-10-04', '2026-10-05']);
    expect(dailyBurn(undefined, '2026-10-06', 7)).toEqual([]);
  });

  it('keeps one row per day when the source repeats a day', () => {
    const repeated = [
      { date: '2026-10-04', value: 1 },
      { date: '2026-10-04', value: 1 },
      { date: '2026-10-05', value: 2 },
      { date: '2026-10-03', value: 3 },
    ];
    // more days asked for than the source has: a repeated day would take a second slot
    expect(dailyBurn(repeated, '2026-10-06', 3)).toEqual([
      { d: '2026-10-03', v: 3 },
      { d: '2026-10-04', v: 1 },
      { d: '2026-10-05', v: 2 },
    ]);
  });

  it('ends at the day the series was read: after midnight a series read the day before still holds a partial day', () => {
    const readAt = Date.parse('2026-10-06T14:43:09Z');
    expect(seriesCut(readAt, Date.parse('2026-10-06T15:00:00Z'))).toBe('2026-10-06');
    expect(seriesCut(readAt, Date.parse('2026-10-07T02:00:00Z'))).toBe('2026-10-06');
    expect(dailyBurn(rows, seriesCut(readAt, Date.parse('2026-10-07T02:00:00Z')), 1)).toEqual([{ d: '2026-10-05', v: 1041.49 }]);
    // a read with no time cuts at now
    expect(seriesCut(undefined, Date.parse('2026-10-07T02:00:00Z'))).toBe('2026-10-07');
  });
});
