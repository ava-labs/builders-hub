import { afterEach, describe, expect, it, vi } from 'vitest';

import { readNewBlocks } from '@/app/api/explorer/[chainId]/new-blocks';

type Call = { id: number; method: string; params: unknown[] };

const hex = (n: number) => `0x${n.toString(16)}`;

// a chain at height 100: block n holds n % 3 transactions, `t<n>-<i>`, each made at n seconds
const header = (n: number) => ({
  number: hex(n),
  hash: `0xb${n}`,
  timestamp: hex(n),
  timestampMilliseconds: hex(n * 1000 + 250),
  transactions: Array.from({ length: n % 3 }, (_, i) => `t${n}-${i}`),
  gasUsed: hex(21_000),
  gasLimit: hex(15_000_000),
});
const body = (hash: string) => {
  const i = Number(hash.split('-')[1]);
  return {
    hash,
    from: '0xf',
    to: i === 1 ? null : '0xa',
    value: hex(10 ** 18),
    input: i === 0 ? '0xa9059cbbffff' : '0x',
    transactionIndex: hex(i),
  };
};

// the RPC: a batch of calls in, a result for each out; `tx` answers the transaction batch
function stubRpc(tx: (calls: Call[]) => unknown = (calls) => calls.map(answer)) {
  const batches: string[][] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const calls = JSON.parse(String(init.body)) as Call[];
      batches.push(calls.map((c) => c.method));
      const out = calls[0].method.startsWith('eth_getTransaction') ? tx(calls) : calls.map(answer);
      return new Response(JSON.stringify(out), { status: 200 });
    }),
  );
  return batches;
}
function answer({ id, method, params }: Call) {
  const [arg] = params as string[];
  if (method === 'eth_blockNumber') return { id, result: hex(100) };
  if (method === 'eth_getBlockByNumber') return { id, result: header(parseInt(arg, 16)) };
  if (method === 'eth_getTransactionByHash') return { id, result: body(arg) };
  // t98-0 reverted
  return { id, result: { status: arg === 't98-0' ? '0x0' : '0x1' } };
}

describe('readNewBlocks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the blocks after the last one in one batch, newest first', async () => {
    const batches = stubRpc();
    const read = await readNewBlocks('https://rpc', 97, 0);
    expect(read.blocks.map((b) => b.number)).toEqual(['100', '99', '98']);
    expect(read.blocks[0]).toMatchObject({ transactionCount: 1, gasUsed: '21,000', timestampMilliseconds: 100_250 });
    expect(read.latestBlock).toBe(100);
    expect(read.txs).toBeUndefined();
    expect(batches).toEqual([
      ['eth_blockNumber'],
      ['eth_getBlockByNumber', 'eth_getBlockByNumber', 'eth_getBlockByNumber'],
    ]);
  });

  it('adds the newest transactions of those blocks, newest first, each with its status', async () => {
    stubRpc();
    const { txs } = await readNewBlocks('https://rpc', 95, 3);
    // block 100 holds t100-0, block 99 none, block 98 t98-0 and t98-1
    expect(txs?.map((t) => t.hash)).toEqual(['t100-0', 't98-1', 't98-0']);
    expect(txs?.[0]).toEqual({
      hash: 't100-0',
      blockNumber: 100,
      txIndex: 0,
      timestampMs: 100_250,
      from: '0xf',
      to: '0xa',
      value: '1000000000000000000',
      methodId: '0xa9059cbb',
      success: true,
    });
    // a plain transfer has no method; a contract creation has no `to`
    expect(txs?.[1]).toMatchObject({ methodId: '', to: '' });
    expect(txs?.[2].success).toBe(false);
  });

  it('leaves out a transaction whose receipt does not come back', async () => {
    stubRpc((calls) =>
      calls.map((c) =>
        c.method === 'eth_getTransactionReceipt' && c.params[0] === 't98-1' ? { id: c.id, result: null } : answer(c),
      ),
    );
    const { txs } = await readNewBlocks('https://rpc', 95, 3);
    expect(txs?.map((t) => t.hash)).toEqual(['t100-0', 't98-0']);
  });

  it('still gives the blocks when the transaction batch fails', async () => {
    stubRpc(() => ({ error: { code: -32600, message: 'batch too large' } }));
    const read = await readNewBlocks('https://rpc', 95, 3);
    expect(read.blocks).toHaveLength(5);
    expect(read.txs).toEqual([]);
  });

  it('asks for nothing more when no block is new, and for five transactions at most', async () => {
    const batches = stubRpc();
    expect(await readNewBlocks('https://rpc', 100, 3)).toEqual({ blocks: [], latestBlock: 100 });
    expect(batches).toEqual([['eth_blockNumber']]);
    const { txs } = await readNewBlocks('https://rpc', undefined, 50);
    expect(txs).toHaveLength(5);
  });
});
