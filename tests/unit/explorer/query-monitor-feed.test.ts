import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/explorer-query/enrich', () => ({ tokenList: vi.fn(async () => new Map()) }));

import { TRANSFER_TOPIC, type MonitorSpec } from '@/lib/explorer-query/monitor';
import { checkedSpec, readMonitor, unitsOf } from '@/lib/explorer-query/monitor-feed';

/* A made-up chain state: the head is block 5000, one second a block. Addresses are made up. */
const USDT = '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7';
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const HEAD = 5000;
const T0 = 1_790_000_000;
const pad = (a: string) => `0x${'0'.repeat(24)}${a.slice(2)}`;
const hex = (n: number | bigint) => `0x${n.toString(16)}`;
const log = (block: number, index: number, amount: bigint, extra: Record<string, unknown> = {}) => ({
  address: USDT,
  topics: [TRANSFER_TOPIC, pad(A), pad(B)],
  data: hex(amount),
  blockNumber: hex(block),
  transactionHash: `0x${String(block).padStart(4, '0')}${'ab'.repeat(30)}`,
  logIndex: hex(index),
  ...extra,
});
const LOGS = [
  log(4999, 3, 1_500_000n),
  log(5000, 1, 25_000_000_000n),
  // an ERC-721 Transfer: its token id is a fourth topic
  { ...log(5000, 2, 0n), topics: [TRANSFER_TOPIC, pad(A), pad(B), hex(7n)] },
  log(4998, 0, 9n, { removed: true }),
];
const block = (n: number, full = false) => ({
  number: hex(n),
  timestamp: hex(T0 + n),
  transactions: full
    ? [
        { hash: `0xa${n}`, from: A, to: B, value: hex(2n * 10n ** 18n), transactionIndex: '0x0' },
        { hash: `0xb${n}`, from: A, to: B, value: '0x0', transactionIndex: '0x1' },
        { hash: `0xc${n}`, from: B, to: null, value: hex(10n ** 18n), transactionIndex: '0x2' },
      ]
    : [],
});

type Req = { id: number; method: string; params: unknown[] };
const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
  const body = JSON.parse(init.body) as Req | Req[];
  const answer = (r: Req) => {
    if (r.method === 'eth_blockNumber') return { id: r.id, result: hex(HEAD) };
    if (r.method === 'eth_getLogs') {
      const f = r.params[0] as { fromBlock: string; toBlock: string };
      return { id: r.id, result: LOGS.filter((l) => parseInt(l.blockNumber, 16) >= parseInt(f.fromBlock, 16) && parseInt(l.blockNumber, 16) <= parseInt(f.toBlock, 16)) };
    }
    if (r.method === 'eth_getBlockByNumber') return { id: r.id, result: block(parseInt(r.params[0] as string, 16), r.params[1] as boolean) };
    return { id: r.id, error: { message: 'no such method' } };
  };
  return new Response(JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)));
});

const spec = (over: Partial<MonitorSpec> = {}): MonitorSpec => ({ chainId: 43114, kind: 'transfers', title: 'USDT transfers', token: { address: USDT, symbol: 'USDT', decimals: 6 }, ...over });
const calls = (method: string) =>
  fetchMock.mock.calls.flatMap((c) => {
    const b = JSON.parse((c[1] as { body: string }).body) as Req | Req[];
    return (Array.isArray(b) ? b : [b]).filter((r) => r.method === method);
  }).length;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

describe('readMonitor', () => {
  it('opens on the last few minutes: ERC-20 moves only, newest first, at their block times', async () => {
    const read = await readMonitor(spec({ title: 'a' }), null);
    expect(read).toMatchObject({ head: HEAD, headAt: (T0 + HEAD) * 1000, from: HEAD - 449, fromAt: (T0 + HEAD - 449) * 1000, gap: false });
    expect(read.items.map((i) => [i.block, i.amount, i.at])).toEqual([
      [5000, 25_000, (T0 + 5000) * 1000],
      [4999, 1.5, (T0 + 4999) * 1000],
    ]);
    expect(read.items[0]).toMatchObject({ from: A, to: B, index: 1 });
  });

  it('keeps only moves of the smallest amount, and reads on from the block it is given', async () => {
    const read = await readMonitor(spec({ title: 'b', minAmount: 100 }), 5000);
    expect(read.from).toBe(5000);
    expect(read.items.map((i) => i.amount)).toEqual([25_000]);
  });

  it('starts again at the head after a gap longer than one read covers', async () => {
    const read = await readMonitor(spec({ title: 'c', minAmount: 1 }), 1);
    expect(read).toMatchObject({ from: HEAD - 449, gap: true });
  });

  it('shares one read between readers of the same monitor', async () => {
    const s = spec({ involving: A });
    await Promise.all([readMonitor(s, 4990), readMonitor({ ...s, title: 'another name' }, 4990)]);
    expect(calls('eth_blockNumber')).toBe(1);
    // an address both ways is two log filters
    expect(calls('eth_getLogs')).toBe(2);
  });

  it('reads a coin from the value its transactions carry', async () => {
    const read = await readMonitor({ chainId: 43114, kind: 'native', coin: 'AVAX', title: 'AVAX transfers' }, 4999);
    expect(read.items.map((i) => [i.tx, i.amount])).toEqual([
      ['0xa5000', 2],
      ['0xa4999', 2],
    ]);
  });
});

describe('checkedSpec', () => {
  it('holds a spec from the page to what a monitor may read', () => {
    expect(checkedSpec(spec())).toEqual(spec());
    // every token on the whole chain is too much to read
    expect(checkedSpec({ chainId: 43114, kind: 'transfers', title: 'x' })).toBeNull();
    expect(checkedSpec({ ...spec(), from: 'not an address' })).toBeNull();
    expect(checkedSpec({ ...spec(), token: { address: USDT, symbol: 'USDT', decimals: 99 } })).toBeNull();
    // the P-Chain has no logs, and a chain with no RPC cannot be read
    expect(checkedSpec({ ...spec(), chainId: 1 })).toBeNull();
    expect(checkedSpec({ ...spec(), chainId: 999999999 })).toBeNull();
  });

  it('scales a raw amount to whole units, to six places', () => {
    expect(unitsOf(25_000_000_000n, 6)).toBe(25_000);
    expect(unitsOf(1_234_567_891_234_567_891n, 18)).toBe(1.234567);
  });
});
