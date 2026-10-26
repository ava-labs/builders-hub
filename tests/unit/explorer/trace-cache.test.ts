import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TRACE_TIMEOUT } from '@/lib/debug-trace';
import { RedisFake } from './redis-fake';

/* The debug node traces each tx once: one muxTracer replay per miss, the
   answer kept in this instance and in the Redis all instances share, one
   caller per instance and one instance at a time asking the node. Each
   import() after vi.resetModules() is a new Vercel instance; they share one
   RedisFake. The node URL and hashes are made up; fetch is stubbed. */

const NODE = 'https://debug-node.invalid/ext/bc/C/rpc';
const HASH = `0x${'ab'.repeat(32)}`;
const ROOT = { type: 'CALL', from: '0x1', to: '0x2', input: '0x', gas: '0x5208', gasUsed: '0x5208', calls: [] };
const CODE = `0x${'60'.repeat(4000)}`;
const PRESTATE = {
  pre: { '0x2': { balance: '0x10', nonce: 7, code: CODE, storage: { '0x01': '0x02' } } },
  post: { '0x2': { balance: '0x11', nonce: 8, storage: { '0x01': '0x03' } } },
};

const fake = { client: null as RedisFake | null };
vi.mock('@/lib/redis', () => ({ redis: async () => fake.client }));

type Body = { method: string; params: [string, { tracer?: string; tracerConfig?: Record<string, unknown>; timeout?: string }] };
let bodies: Body[] = [];
function stubNode(answer: (b: Body) => Response | Promise<Response>) {
  bodies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)) as Body;
      bodies.push(b);
      return answer(b);
    }),
  );
}
const result = (r: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: r }));
const rpcError = (message: string) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message } }));
const mux = () => result({ callTracer: ROOT, prestateTracer: PRESTATE });

/** a new Vercel instance: fresh module state, the same Redis */
async function instance() {
  vi.resetModules();
  return (await import('@/lib/trace-node')).getTrace;
}
const from = { lane: 'gesture' as const, ip: '203.0.113.1' };

beforeEach(() => {
  fake.client = new RedisFake();
  vi.stubEnv('CCHAIN_DEBUG_RPC_URL', NODE);
  vi.stubEnv('REDIS_URL', 'redis://redis.invalid:6379');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('one replay', () => {
  it('asks the node once per miss, with both tracers in one muxTracer call and the timeout', async () => {
    stubNode(mux);
    const out = await (await instance())('43114', HASH, from);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].params[1]).toEqual({
      tracer: 'muxTracer',
      tracerConfig: { callTracer: { withLog: true, onlyTopCall: false }, prestateTracer: { diffMode: true } },
      timeout: TRACE_TIMEOUT,
    });
    expect(out).toEqual({
      trace: {
        call: ROOT,
        // no code and no nonce: the page never reads them
        prestate: { pre: { '0x2': { balance: '0x10', storage: { '0x01': '0x02' } } }, post: { '0x2': { balance: '0x11', storage: { '0x01': '0x03' } } } },
        opcodes: null,
        steps: null,
        gas: null,
      },
    });
  });

  it('falls back to the call tree alone when the node rejects or stops the pair, never after a transport failure', async () => {
    stubNode((b) => (b.params[1].tracer === 'muxTracer' ? rpcError('prestate tracer failed') : result(ROOT)));
    const out = await (await instance())('43114', HASH, from);
    expect(bodies.map((b) => b.params[1].tracer)).toEqual(['muxTracer', 'callTracer']);
    expect(bodies[1].params[1].timeout).toBe(TRACE_TIMEOUT);
    expect(out).toMatchObject({ trace: { call: ROOT, prestate: null } });

    // a timeout of the pair: the call tree alone is lighter, so it gets one try
    stubNode((b) => (b.params[1].tracer === 'muxTracer' ? rpcError('execution timeout') : result(ROOT)));
    expect(await (await instance())('43114', `0x${'cd'.repeat(32)}`, from)).toMatchObject({ trace: { call: ROOT, prestate: null } });
    expect(bodies.map((b) => b.params[1].tracer)).toEqual(['muxTracer', 'callTracer']);
    stubNode(() => rpcError('execution timeout'));
    expect(await (await instance())('43114', `0x${'cc'.repeat(32)}`, from)).toEqual({ miss: 'timeout' });
    expect(bodies).toHaveLength(2);

    stubNode(() => new Response('bad gateway', { status: 502 }));
    expect(await (await instance())('43114', `0x${'ef'.repeat(32)}`, from)).toEqual({ miss: 'node_error' });
    expect(bodies).toHaveLength(1);
  });
});

describe('size caps', () => {
  it('stops reading a node answer over 16 MB and keeps the verdict', async () => {
    stubNode(() => result({ callTracer: { ...ROOT, output: `0x${'00'.repeat(8_500_000)}` }, prestateTracer: PRESTATE }));
    const getTrace = await instance();
    expect(await getTrace('43114', HASH, from)).toEqual({ miss: 'too_large' });
    expect(await (await instance())('43114', HASH, from)).toEqual({ miss: 'too_large' });
    expect(bodies).toHaveLength(1);
  });

  it('does not send a trace over 4 MB', async () => {
    stubNode(() => result({ callTracer: { ...ROOT, output: `0x${'00'.repeat(2_200_000)}` }, prestateTracer: PRESTATE }));
    expect(await (await instance())('43114', HASH, from)).toEqual({ miss: 'too_large' });
  });
});

describe('the cache', () => {
  it('serves another instance from Redis without asking the node', async () => {
    stubNode(mux);
    const a = await instance();
    const first = await a('43114', HASH, from);
    const b = await instance();
    expect(await b('43114', HASH, from)).toEqual(first);
    expect(bodies).toHaveLength(1);
  });

  it('asks the node once for many callers of one tx in one instance', async () => {
    stubNode(mux);
    const getTrace = await instance();
    const outs = await Promise.all(Array.from({ length: 10 }, () => getTrace('43114', HASH, from)));
    expect(new Set(outs.map((o) => JSON.stringify(o))).size).toBe(1);
    expect(bodies).toHaveLength(1);
  });

  it('lets one instance trace a tx while another waits for its answer', async () => {
    let answer!: () => void;
    const answered = new Promise<void>((r) => (answer = r));
    stubNode(async () => {
      await answered;
      return mux();
    });
    const a = await instance();
    const b = await instance();
    const first = a('43114', HASH, from);
    await new Promise((r) => setTimeout(r, 50));
    const second = b('43114', HASH, from);
    await new Promise((r) => setTimeout(r, 50));
    answer();
    const [x, y] = await Promise.all([first, second]);
    expect(y).toEqual(x);
    expect(bodies).toHaveLength(1);
  });

  it('keeps a tx the node does not know for a few seconds only: it may be pending', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubNode(() => rpcError('transaction not found'));
    expect(await (await instance())('43114', HASH, from)).toEqual({ miss: 'not_found' });
    expect(await (await instance())('43114', HASH, from)).toEqual({ miss: 'not_found' });
    expect(bodies).toHaveLength(1);
    vi.setSystemTime(Date.now() + 6_000);
    await (await instance())('43114', HASH, from);
    expect(bodies).toHaveLength(2);
  });

  it('keeps a trace without its state diff for minutes, not a day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubNode((b) => (b.params[1].tracer === 'muxTracer' ? rpcError('prestate tracer failed') : result(ROOT)));
    await (await instance())('43114', HASH, from);
    await (await instance())('43114', HASH, from);
    expect(bodies).toHaveLength(2);
    vi.setSystemTime(Date.now() + 301_000);
    stubNode(mux);
    expect(await (await instance())('43114', HASH, from)).toMatchObject({ trace: { prestate: { pre: {}, post: {} } } });
    expect(bodies).toHaveLength(1);
  });

  it('stops waiting when the instance that held the tx gave up, and traces it here', async () => {
    let fail!: () => void;
    const failed = new Promise<void>((r) => (fail = r));
    let n = 0;
    stubNode(async () => {
      if (n++ === 0) {
        await failed;
        return new Response('bad gateway', { status: 502 });
      }
      return mux();
    });
    const a = await instance();
    const b = await instance();
    const first = a('43114', HASH, from);
    await new Promise((r) => setTimeout(r, 50));
    const second = b('43114', HASH, { lane: 'gesture', ip: '203.0.113.2' });
    await new Promise((r) => setTimeout(r, 50));
    const started = Date.now();
    fail();
    expect(await first).toEqual({ miss: 'node_error' });
    expect(await second).toMatchObject({ trace: { call: ROOT } });
    // it learned within a poll or two, not after the full 20 s wait
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(bodies).toHaveLength(2);
  });

  it('keeps no error and no refusal, and asks the node nothing when Redis is down', async () => {
    stubNode(() => new Response('bad gateway', { status: 502 }));
    await (await instance())('43114', HASH, from);
    await (await instance())('43114', HASH, from);
    expect(bodies).toHaveLength(2);
    fake.client!.down = true;
    stubNode(mux);
    expect(await (await instance())('43114', `0x${'12'.repeat(32)}`, from)).toEqual({ miss: 'unavailable' });
    expect(bodies).toHaveLength(0);
  });
});
