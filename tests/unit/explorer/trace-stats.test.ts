import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { balanceChanges, type TraceLog, type TraceResponse } from '@/lib/trace';
import { ERC20_TRANSFER_TOPIC } from '@/lib/token-list';

/* The tx page's trace comes from stats-api (/evm-api/{chain}/tx/{hash}/trace),
   never from a node. The route answers it, or a fixed miss. fetch is
   stubbed, so no test reaches stats-api or a node. */

const A = `0x${'a'.repeat(40)}`;
const B = `0x${'b'.repeat(40)}`;
const C = `0x${'c'.repeat(40)}`;
const HASH = `0x${'ab'.repeat(32)}`;
const NODE = 'https://debug-node.invalid/ext/bc/C/rpc';

const word = (hex: string) => hex.padStart(64, '0');
const transfer = (logIndex: number, token: string, from: string, to: string, amount: bigint): TraceLog => ({
  address: token,
  topics: [ERC20_TRANSFER_TOPIC, `0x${word(from.slice(2))}`, `0x${word(to.slice(2))}`],
  data: `0x${word(amount.toString(16))}`,
  logIndex,
});

const TRACE: TraceResponse = {
  call: {
    type: 'CALL',
    from: A,
    to: B,
    value: '0x0',
    gas: '0x186a0',
    gasUsed: '0xc350',
    input: '0xa9059cbb',
    output: '0x',
    calls: [{ type: 'CALL', from: B, to: C, value: '0x0', gas: '0x1', gasUsed: '0x1', input: '0x', output: '0x' }],
  },
  logs: [transfer(4, C, A, B, 1n)],
};

describe('balance changes', () => {
  it('nets token Transfer logs per account and token, and derives no native change', () => {
    const logs = [transfer(0, C, A, B, 100n), transfer(1, C, B, A, 40n), { address: C, topics: [`0x${'33'.repeat(32)}`], data: '0x', logIndex: 2 }];
    expect(balanceChanges({ logs })).toEqual([
      { address: A, token: C, delta: -60n },
      { address: B, token: C, delta: 60n },
    ]);
  });
});

describe('the trace route', () => {
  beforeEach(() => {
    vi.stubEnv('CCHAIN_DEBUG_RPC_URL', NODE);
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** stats-api answers this; every URL fetched is kept */
  function stubStats(status: number, body: unknown) {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      }),
    );
    return urls;
  }

  const get = async (url: string, headers: Record<string, string> = {}) => {
    const { GET } = await import('@/app/api/trace/[chainId]/[txHash]/route');
    const [, , , chainId, txHash] = new URL(url).pathname.split('/');
    return GET(new NextRequest(url, { headers }), { params: Promise.resolve({ chainId, txHash }) });
  };

  it("answers stats-api's trace, never a node's, and caches it hard", async () => {
    const urls = stubStats(200, { txHash: HASH, blockNumber: 98737562, ...TRACE });
    const res = await get(`http://localhost/api/trace/43114/${HASH}?block=98737562`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.json()).toEqual(TRACE);
    expect(urls).toEqual([`https://stats-api.avax.network/evm-api/43114/tx/${HASH}/trace`]);
  });

  it('says not indexed yet, uncached, for a tx above what stats-api has indexed', async () => {
    stubStats(404, { error: 'not_indexed', indexedThrough: 98737561 });
    const res = await get(`http://localhost/api/trace/43114/${HASH}?block=98737562`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_indexed' });
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('says no index for a tx at or under what stats-api has indexed, an untraced chain or tx, or a chain it does not serve', async () => {
    for (const [status, body] of [
      [404, { error: 'not_indexed', indexedThrough: 98737562 }],
      [404, { error: 'no_trace', indexedThrough: 98737562 }],
      [404, { error: 'no_index', indexedThrough: 0 }],
      [400, { error: 'invalid chainId "1"' }],
    ] as const) {
      stubStats(status, body);
      const res = await get(`http://localhost/api/trace/43114/${HASH}?block=98737562`);
      expect(await res.json()).toEqual({ error: 'no_index' });
    }
  });

  it('maps too large, busy and a failure to fixed codes', async () => {
    for (const [status, body, code, want] of [
      [413, { error: 'too_large' }, 'too_large', 404],
      [503, { error: 'busy' }, 'busy', 503],
      [500, { error: 'traces: code: 60, message: secret' }, 'error', 502],
      [200, 'not json', 'error', 502],
    ] as const) {
      stubStats(status, body);
      const res = await get(`http://localhost/api/trace/43113/${HASH}?block=1`);
      expect(res.status).toBe(want);
      expect(await res.json()).toEqual({ error: code });
    }
  });

  it('asks nothing for a missing block, a bad hash or a crawler', async () => {
    const urls = stubStats(200, TRACE);
    expect((await get(`http://localhost/api/trace/43114/${HASH}`)).status).toBe(400);
    expect((await get(`http://localhost/api/trace/43114/${HASH}?block=0x10`)).status).toBe(400);
    expect((await get(`http://localhost/api/trace/43114/0x12?block=1`)).status).toBe(400);
    expect((await get(`http://localhost/api/trace/43114/${HASH}?block=1`, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })).status).toBe(403);
    expect(urls).toHaveLength(0);
  });
});

describe("the Console's revert reason", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** the trace route answers these, one per ask; every URL asked is kept */
  function stubRoute(answers: { status: number; body: unknown }[]) {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        const a = answers[Math.min(urls.length, answers.length) - 1];
        // the route answers a miss soft: 200, with the status in a header
        return a.status === 200
          ? new Response(JSON.stringify(a.body))
          : new Response(JSON.stringify(a.body), { headers: { 'x-status': String(a.status) } });
      }),
    );
    return urls;
  }

  const reverted: TraceResponse = { call: { ...TRACE.call, calls: undefined, error: 'execution reverted', revertReason: 'Ownable: caller is not the owner' }, logs: [] };

  it('waits for a tx the pipeline has not indexed yet, then names the reason', async () => {
    vi.useFakeTimers();
    const urls = stubRoute([{ status: 404, body: { error: 'not_indexed' } }, { status: 404, body: { error: 'not_indexed' } }, { status: 200, body: reverted }]);
    const { revertReasonOf } = await import('@/lib/trace-revert');
    const reason = revertReasonOf(43113, HASH, 123n);
    await vi.runAllTimersAsync();
    expect(await reason).toBe('Ownable: caller is not the owner');
    expect(urls).toEqual(Array(3).fill(`/api/trace/43113/${HASH}?block=123`));
  });

  it('gives up with null on a tx the pipeline does not index, without asking again', async () => {
    const urls = stubRoute([{ status: 404, body: { error: 'no_index' } }]);
    const { revertReasonOf } = await import('@/lib/trace-revert');
    expect(await revertReasonOf(99999, HASH, 1)).toBeNull();
    expect(urls).toHaveLength(1);
  });

  it('gives up with null after its waits', async () => {
    vi.useFakeTimers();
    const urls = stubRoute([{ status: 404, body: { error: 'not_indexed' } }]);
    const { revertReasonOf } = await import('@/lib/trace-revert');
    const reason = revertReasonOf(43114, HASH, 1);
    await vi.runAllTimersAsync();
    expect(await reason).toBeNull();
    expect(urls).toHaveLength(4);
  });
});
