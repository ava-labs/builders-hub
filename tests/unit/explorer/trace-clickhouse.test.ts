import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encodeAbiParameters } from 'viem';
import { balanceChanges, flatten, revertReason, traceFromRows, type TraceRow } from '@/lib/trace';
import { ERC20_TRANSFER_TOPIC } from '@/lib/token-list';

/* The tx page's trace comes from the ingestion pipeline's rows (raw_traces,
   raw_logs), never from a node. The builder turns the rows into the call
   tree the page reads; the route answers it, or a fixed miss. The rows here
   are made up; fetch is stubbed, so no test reaches the query service or a
   node. */

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn(async (run: () => unknown) => run()) }));

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const HASH = `0x${'ab'.repeat(32)}`;
const NODE = 'https://debug-node.invalid/ext/bc/C/rpc';
const SETTLED = 60_000;

/** a frame row at a trace address */
const frame = (pos: string, over: Partial<TraceRow> = {}): TraceRow & { age: number } => ({
  kind: 0,
  pos,
  type: 'CALL',
  src: A,
  dst: B,
  no_to: 0,
  value: '0',
  gas: 100_000,
  gas_used: 50_000,
  input: 'a9059cbb',
  output: '',
  ok: true,
  age: SETTLED,
  ...over,
});

/** a log row at a log index */
const log = (index: number, address: string, topics: string[], data: string): TraceRow & { age: number } => ({
  kind: 1,
  pos: String(index),
  type: '',
  src: address,
  dst: '',
  no_to: 0,
  value: '',
  gas: 0,
  gas_used: 0,
  input: data,
  output: topics.join(','),
  ok: true,
  age: SETTLED,
});

const word = (hex: string) => hex.padStart(64, '0');
const transfer = (index: number, token: string, from: string, to: string, amount: bigint) =>
  log(index, token, [ERC20_TRANSFER_TOPIC.slice(2), word(from), word(to)], word(amount.toString(16)));

describe('the call tree from trace rows', () => {
  it('nests frames by trace address, whatever order the rows come in', () => {
    const rows = [frame('1', { dst: C, gas_used: 7_000 }), frame('0.0', { type: 'STATICCALL', gas_used: 2_000 }), frame(''), frame('0', { gas_used: 30_000 }), frame('0.1', { type: 'DELEGATECALL' }), frame('0.10'), frame('0.2')];
    const t = traceFromRows(rows)!;
    expect(t.call.calls).toHaveLength(2);
    expect(t.call.calls![0].calls!.map((f) => f.type)).toEqual(['STATICCALL', 'DELEGATECALL', 'CALL', 'CALL']);
    expect(t.call.calls![1].to).toBe(`0x${C}`);
    // 0.10 comes after 0.2: the addresses compare as numbers, not text
    expect(flatten(t.call).map((f) => f.id)).toEqual(['0', '0.0', '0.0.0', '0.0.1', '0.0.2', '0.0.3', '0.1']);
    expect(t.call.calls![0].calls![3]).toBe(t.call.calls![0].calls![3]);
  });

  it('writes the numbers as the callTracer does: hex quantities, 0x bytes', () => {
    const t = traceFromRows([frame('', { value: '1000000000000000000', gas: 21_000, gas_used: 21_000, input: '', output: 'ff' })])!;
    expect(t.call).toMatchObject({ from: `0x${A}`, to: `0x${B}`, value: '0xde0b6b3a7640000', gas: '0x5208', gasUsed: '0x5208', input: '0x', output: '0xff' });
    expect(t.call.error).toBeUndefined();
  });

  it('gives a creation with no target no to', () => {
    const t = traceFromRows([frame('', { type: 'CREATE', no_to: 1, dst: '0'.repeat(40) })])!;
    expect(t.call.to).toBeUndefined();
  });

  it('hangs a frame whose parent is missing under its nearest ancestor', () => {
    const t = traceFromRows([frame(''), frame('0'), frame('0.3.1', { dst: C })])!;
    expect(t.call.calls![0].calls![0].to).toBe(`0x${C}`);
  });

  it('is null with no top frame', () => {
    expect(traceFromRows([])).toBeNull();
    expect(traceFromRows([frame('0')])).toBeNull();
    expect(traceFromRows([log(0, A, [], '')])).toBeNull();
  });

  it('marks the top frame of a reverted tx with the reason its output holds, and no inner frame', () => {
    const reason = encodeAbiParameters([{ type: 'string' }], ['Too little received']).slice(2);
    const t = traceFromRows([frame('', { ok: false, output: `08c379a0${reason}` }), frame('0', { ok: false })])!;
    expect(t.call.error).toBe('execution reverted');
    expect(t.call.revertReason).toBe('Too little received');
    expect(t.call.calls![0].error).toBeUndefined();
  });

  it('keeps an empty revert as a revert with no reason', () => {
    const t = traceFromRows([frame('', { ok: false, output: '' })])!;
    expect(t.call.error).toBe('execution reverted');
    expect(t.call.revertReason).toBeUndefined();
  });

  it('orders the logs by log index and splits their topics', () => {
    const t = traceFromRows([frame(''), log(12, C, ['11'.repeat(32), '22'.repeat(32)], 'beef'), log(3, A, [], '')])!;
    expect(t.logs).toEqual([
      { address: `0x${A}`, topics: [], data: '0x', logIndex: 3 },
      { address: `0x${C}`, topics: [`0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`], data: '0xbeef', logIndex: 12 },
    ]);
  });
});

describe('revert reasons', () => {
  it('reads Error(string), Panic(uint256) and a custom error', () => {
    expect(revertReason(`0x08c379a0${encodeAbiParameters([{ type: 'string' }], ['nope']).slice(2)}`)).toBe('nope');
    expect(revertReason(`0x4e487b71${word('11')}`)).toBe('panic 0x11 (arithmetic overflow)');
    expect(revertReason('0xe450d38c0000')).toBe('custom error 0xe450d38c');
    // a selector whose body does not decode is named by its selector
    expect(revertReason('0x08c379a0ff')).toBe('custom error 0x08c379a0');
    expect(revertReason('0x')).toBeNull();
    expect(revertReason(undefined)).toBeNull();
  });
});

describe('balance changes', () => {
  it('nets token Transfer logs per account and token, and derives no native change', () => {
    const t = traceFromRows([frame('', { value: '5' }), transfer(0, C, A, B, 100n), transfer(1, C, B, A, 40n), log(2, C, ['33'.repeat(32)], '')])!;
    expect(balanceChanges(t)).toEqual([
      { address: `0x${A}`, token: `0x${C}`, delta: -60n },
      { address: `0x${B}`, token: `0x${C}`, delta: 60n },
    ]);
  });
});

describe('the trace query', () => {
  it('is bounded by chain, tx hash and block, and refuses anything else', async () => {
    const { traceSql } = await import('@/lib/trace-clickhouse');
    const sql = traceSql('43114', HASH, 98_737_562);
    expect(sql).toContain(`tx_hash = unhex('${HASH.slice(2)}')`);
    expect(sql).toContain('block_number = 98737562');
    expect(sql).toContain('block_time = bt');
    expect(() => traceSql('1', HASH, 1)).toThrow();
    expect(() => traceSql('43114', `${HASH}'`, 1)).toThrow();
    expect(() => traceSql('43114', HASH, -1)).toThrow();
    expect(() => traceSql('43114', HASH, 1.5)).toThrow();
  });
});

describe('the trace route', () => {
  beforeEach(() => {
    vi.stubEnv('STATS_QUERY_KEY', 'test');
    vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
    vi.stubEnv('CCHAIN_DEBUG_RPC_URL', NODE);
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** the query service answers these rows; every URL fetched is kept */
  function stubService(rows: (TraceRow & { age: number })[], over: { status?: number; truncated?: boolean } = {}) {
    const urls: string[] = [];
    const columns = ['kind', 'pos', 'type', 'src', 'dst', 'no_to', 'value', 'gas', 'gas_used', 'input', 'output', 'ok', 'age'] as const;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (over.status) return new Response(JSON.stringify({ error: 'Bad Request', message: 'clickhouse: code: 1, message: broken' }), { status: over.status });
        const body = { columns, types: columns.map(() => 'String'), rows: rows.map((r) => columns.map((c) => r[c])), rowCount: over.truncated ? 2_000 : rows.length, truncated: over.truncated ?? false, elapsedMs: 5, complete: true };
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      }),
    );
    return urls;
  }

  const get = async (url: string, headers: Record<string, string> = {}) => {
    const { GET } = await import('@/app/api/trace/[chainId]/[txHash]/route');
    const [, , , chainId, txHash] = new URL(url).pathname.split('/');
    return GET(new NextRequest(url, { headers }), { params: Promise.resolve({ chainId, txHash }) });
  };

  it('answers the call tree and the logs from the query service, never a node, and caches them hard', async () => {
    const urls = stubService([frame(''), frame('0', { dst: C }), transfer(4, C, A, B, 1n)]);
    const res = await get(`http://localhost/api/trace/43114/${HASH}?block=98737562`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    const body = await res.json();
    expect(body.call.calls[0].to).toBe(`0x${C}`);
    expect(body.logs).toHaveLength(1);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('stats-api');
    expect(urls.some((u) => u.startsWith(NODE))).toBe(false);
  });

  it('says not indexed yet, uncached, for a tx the pipeline has not reached or has just written', async () => {
    for (const rows of [[], [frame('', { age: 1_200 }), frame('0')]]) {
      stubService(rows);
      const res = await get(`http://localhost/api/trace/43114/${HASH}?block=98737562`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_indexed' });
      expect(res.headers.get('cache-control')).toContain('no-store');
    }
  });

  // runQuery reads an answer of MAX_ROWS rows as cut
  it('says too large when the row cap cut the answer', async () => {
    stubService([frame('')], { truncated: true });
    const res = await get(`http://localhost/api/trace/43114/${HASH}?block=1`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'too_large' });
  });

  it("answers a failed query with a fixed code, not the query's text", async () => {
    stubService([], { status: 400 });
    const res = await get(`http://localhost/api/trace/43113/${HASH}?block=1`);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'error' });
  });

  it('asks nothing for an untraced chain, a missing block, a bad hash or a crawler', async () => {
    const urls = stubService([frame('')]);
    expect((await get(`http://localhost/api/trace/1/${HASH}?block=1`)).status).toBe(404);
    expect((await get(`http://localhost/api/trace/43114/${HASH}`)).status).toBe(400);
    expect((await get(`http://localhost/api/trace/43114/${HASH}?block=0x10`)).status).toBe(400);
    expect((await get(`http://localhost/api/trace/43114/0x12?block=1`)).status).toBe(400);
    expect((await get(`http://localhost/api/trace/43114/${HASH}?block=1`, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })).status).toBe(403);
    expect(urls).toHaveLength(0);
  });
});
