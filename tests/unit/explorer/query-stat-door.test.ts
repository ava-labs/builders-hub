import { describe, expect, it } from 'vitest';

import { statDoor } from '@/components/explorer-v2/evm/stat-door';

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

  it('opens nothing for a sum, a figure the totals gave, a row with no hash, or a page with no base', () => {
    expect(statDoor({ agg: 'sum', column: 'max_fee_avax' }, rows, 0.84, base)).toBeNull();
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows, 0.91, base)).toBeNull();
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows.map((r) => ({ t: r.t, max_fee_avax: r.max_fee_avax })), 0.59, base)).toBeNull();
    expect(statDoor({ agg: 'max', column: 'max_fee_avax' }, rows, 0.59, undefined)).toBeNull();
  });
});
