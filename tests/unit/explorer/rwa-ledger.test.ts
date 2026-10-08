import { afterEach, describe, expect, it, vi } from 'vitest';

import { cutOf, readAll } from '@/components/explorer-v2/defi/RwaTransactions';
import type { TransactionRecord } from '@/lib/rwa/types';

const transfer = (txHash: string, over: Partial<TransactionRecord> = {}): TransactionRecord => ({
  txHash,
  timestamp: '2026-10-01T12:00:00.000Z',
  from: '0xa',
  fromLabel: '0xa',
  to: '0xb',
  toLabel: '0xb',
  amount: 1n,
  direction: 'internal',
  ...over,
});

describe('a cut of the whole ledger, made in the browser', () => {
  const rows = [
    transfer('0x1', { direction: 'inbound', amount: 5n, timestamp: '2026-09-01T00:00:00.000Z' }),
    transfer('0x2', { direction: 'outbound', amount: 9n, timestamp: '2026-09-03T00:00:00.000Z' }),
    transfer('0x3', { direction: 'inbound', amount: 7n, timestamp: '2026-09-02T00:00:00.000Z' }),
  ];
  const hashes = (cut: TransactionRecord[]) => cut.map((t) => t.txHash);

  it('keeps one direction, or every row for all', () => {
    expect(hashes(cutOf(rows, 'inbound', 'date', 'desc'))).toEqual(['0x3', '0x1']);
    expect(hashes(cutOf(rows, 'all', 'date', 'desc'))).toEqual(['0x2', '0x3', '0x1']);
  });

  it('sorts by date or by amount, either way', () => {
    expect(hashes(cutOf(rows, 'all', 'date', 'asc'))).toEqual(['0x1', '0x3', '0x2']);
    expect(hashes(cutOf(rows, 'all', 'amount', 'desc'))).toEqual(['0x2', '0x3', '0x1']);
    expect(hashes(cutOf(rows, 'all', 'amount', 'asc'))).toEqual(['0x1', '0x3', '0x2']);
  });

  it('leaves the rows it was given as they were', () => {
    cutOf(rows, 'all', 'amount', 'asc');
    expect(hashes(rows)).toEqual(['0x1', '0x2', '0x3']);
  });
});

/** the transactions route's answer for one page: amounts travel as strings */
const page = (rows: TransactionRecord[], total: number) => ({ transactions: rows.map((t) => ({ ...t, amount: String(t.amount) })), total });

describe('reading every transfer of a cut', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const serve = (pages: Record<number, ReturnType<typeof page>>) => {
    const asked: URLSearchParams[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const q = new URL(url, 'http://localhost').searchParams;
        asked.push(q);
        return { ok: true, json: async () => pages[Number(q.get('page'))] } as Response;
      }),
    );
    return asked;
  };

  it('reads once when the ledger fits one page', async () => {
    const asked = serve({ 1: page([], 0) });
    expect(await readAll('oatfi', 'all', 'date', 'desc')).toEqual([]);
    expect(asked).toHaveLength(1);
  });

  it('reads the remaining pages, a hundred rows each', async () => {
    const asked = serve({ 1: page([transfer('0x1')], 250), 2: page([transfer('0x2')], 250), 3: page([transfer('0x3')], 250) });
    expect((await readAll('oatfi', 'inbound', 'amount', 'asc')).map((t) => t.txHash)).toEqual(['0x1', '0x2', '0x3']);
    expect(asked.map((q) => q.get('page'))).toEqual(['1', '2', '3']);
    expect(asked.every((q) => q.get('pageSize') === '100' && q.get('direction') === 'inbound' && q.get('sortField') === 'amount' && q.get('sortDirection') === 'asc')).toBe(true);
  });

  it('keeps a transfer that slid onto the next page once', async () => {
    serve({ 1: page([transfer('0x1'), transfer('0x2')], 102), 2: page([transfer('0x2'), transfer('0x3')], 102) });
    expect((await readAll('oatfi', 'all', 'date', 'desc')).map((t) => t.txHash)).toEqual(['0x1', '0x2', '0x3']);
  });

  it('keeps two transfers of one transaction', async () => {
    serve({ 1: page([transfer('0x1', { from: '0xa', to: '0xb' }), transfer('0x1', { from: '0xb', to: '0xc' })], 2) });
    expect(await readAll('oatfi', 'all', 'date', 'desc')).toHaveLength(2);
  });

  it('turns the amounts back into exact base units', async () => {
    serve({ 1: page([transfer('0x1', { amount: 136_310_930_000n })], 1) });
    expect((await readAll('oatfi', 'all', 'date', 'desc'))[0].amount).toBe(136_310_930_000n);
  });
});
