import { describe, expect, it } from 'vitest';

import { extremeOf, rowWords, statDoor } from '@/components/explorer-v2/evm/stat-door';

describe('statDoor', () => {
  const hash = (c: string) => `0x${c.repeat(64)}`;
  const base = '/explorer/mainnet/c-chain';
  const rows = [
    { t: '2026-09-27 00:00:00', max_fee_avax: 0.2, max_fee_tx: hash('a') },
    { t: '2026-09-27 00:05:00', max_fee_avax: 0.59, max_fee_tx: hash('b') },
    { t: '2026-09-27 00:10:00', max_fee_avax: 0.05, max_fee_tx: hash('c') },
  ];

  it('opens the transaction of the row that holds a max or a min', () => {
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows, 0.59, base)).toEqual({ href: `${base}/tx/${hash('b')}`, hash: hash('b'), short: '0xbbbb…bbbb' });
    expect(statDoor({ agg: 'min', column: 'max_fee_avax' }, rows, 0.05, base)?.hash).toBe(hash('c'));
  });

  it('reads tx_hash when the row has no stem column', () => {
    const plain = rows.map((r) => ({ t: r.t, max_fee_avax: r.max_fee_avax, tx_hash: r.max_fee_tx }));
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, plain, 0.59, base)?.hash).toBe(hash('b'));
  });

  it('finds the row a max or a min is, and none for another figure or one the totals gave', () => {
    expect(extremeOf({ agg: 'max', column: 'max_fee_avax' }, rows, 0.59)).toBe(rows[1]);
    expect(extremeOf({ agg: 'min', column: 'max_fee_avax' }, rows, 0.05)).toBe(rows[2]);
    expect(extremeOf({ agg: 'max', column: 'max_fee_avax' }, rows, 0.91)).toBeNull();
    expect(extremeOf({ agg: 'sum', column: 'max_fee_avax' }, rows, 0.84)).toBeNull();
  });

  it('opens nothing for a sum, a figure the totals gave, a row with no hash, or a page with no base', () => {
    expect(statDoor({ agg: 'sum', column: 'max_fee_avax' }, rows, 0.84, base)).toBeNull();
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows, 0.91, base)).toBeNull();
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows.map((r) => ({ t: r.t, max_fee_avax: r.max_fee_avax })), 0.59, base)).toBeNull();
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows, 0.59, undefined)).toBeNull();
  });
});

describe('rowWords', () => {
  const at = (hm: string, day = '2026-09-28') => `${day} ${hm}:00`;

  it("names a bucket in the words of its series' step", () => {
    expect(rowWords(at('10:05'), 't', [{ t: at('10:00') }, { t: at('10:05') }, { t: at('10:10') }], {})).toBe('at 10:05 UTC');
    // a series across days gives the day too
    expect(rowWords(at('23:55', '2026-09-27'), 't', [{ t: at('23:55', '2026-09-27') }, { t: at('00:00') }], {})).toBe('Sep 27, 23:55 UTC');
    // an hourly bucket at midnight is a time of day, not a day
    expect(rowWords(at('00:00'), 't', [{ t: at('00:00') }, { t: at('01:00') }], {})).toBe('at 00:00 UTC');
    expect(rowWords('2026-09-21', 't', [{ t: '2026-09-20' }, { t: '2026-09-21' }], {})).toBe('on Sep 21');
    expect(rowWords('2026-09-21', 't', [{ t: '2026-09-14' }, { t: '2026-09-21' }], {})).toBe('week of Sep 21');
    expect(rowWords('2026-09-01', 't', [{ t: '2026-08-01' }, { t: '2026-09-01' }], {})).toBe('Sep 2026');
  });

  it('names a leader by its name, else by its ends, and a number not at all', () => {
    const contract = `0x${'ab'.repeat(20)}`;
    expect(rowWords(contract, 'contract', [], { contract: { [contract]: 'Trader Joe: LB Router' } })).toBe('Trader Joe: LB Router');
    expect(rowWords(contract, 'contract', [], {})).toBe('0xabab…abab');
    expect(rowWords('transfer', 'method', [], {})).toBe('transfer');
    expect(rowWords(12, 'n', [], {})).toBeUndefined();
  });
});
