import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { TRACE_TIMEOUT, callTracer, clientCallTracer } from '@/lib/debug-trace';

/* No call to a debug node may run the struct logger: it keeps every opcode
   step in node memory and OOM-killed the shared C-Chain node. Every trace
   names a native tracer and a node-side timeout. The node URL and the
   hashes here are made up; fetch is stubbed, so no test reaches a node. */

const NODE = 'https://debug-node.invalid/ext/bc/C/rpc';
const HASH = `0x${'ab'.repeat(32)}`;

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { email: 'dev@example.com' } })) }));
vi.mock('@/lib/auth/authOptions', () => ({ AuthOptions: {} }));

/** the JSON-RPC bodies a stubbed fetch received */
function stubNode(answer: (body: { method: string; params: unknown[] }) => unknown) {
  const bodies: { method: string; params: unknown[] }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: answer(body) }), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return bodies;
}

/** a trace config from a node request: a struct logger names no tracer */
const configOf = (body: { method: string; params: unknown[] }) =>
  body.params[body.method === 'debug_traceCall' ? 2 : 1] as { tracer?: string; timeout?: string };

const ROOT = { type: 'CALL', from: '0x1', to: '0x2', input: '0x', gas: '0x5208', gasUsed: '0x5208', calls: [] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('trace configs', () => {
  it('name a native tracer and the node-side timeout', () => {
    expect(callTracer({ withLog: true })).toEqual({
      tracer: 'callTracer',
      tracerConfig: { withLog: true, onlyTopCall: false },
      timeout: TRACE_TIMEOUT,
    });
    expect(TRACE_TIMEOUT).toBe('5s');
  });

  it("turn a client's config into a callTracer config, or refuse it", () => {
    // no tracer named: the node would run the struct logger
    expect(clientCallTracer({})).toBeNull();
    expect(clientCallTracer({ disableStack: true, disableMemory: true })).toBeNull();
    expect(clientCallTracer(undefined)).toBeNull();
    expect(clientCallTracer({ tracer: 'prestateTracer' })).toBeNull();
    // a JS tracer runs code on the node
    expect(clientCallTracer({ tracer: '{step: function() {}, result: function() {}}' })).toBeNull();
    // only the two callTracer options pass: no timeout or reexec of the client's
    expect(
      clientCallTracer({ tracer: 'callTracer', tracerConfig: { onlyTopCall: true, extra: 1 }, timeout: '10m', reexec: 1e6 }),
    ).toEqual({ tracer: 'callTracer', tracerConfig: { withLog: false, onlyTopCall: true }, timeout: TRACE_TIMEOUT });
  });
});

describe('the tx trace route', () => {
  it('asks the node for a call tree and a state diff in one replay, never a struct log, once per tx', async () => {
    vi.stubEnv('CCHAIN_DEBUG_RPC_URL', NODE);
    vi.resetModules();
    const bodies = stubNode(() => ({ callTracer: ROOT, prestateTracer: { pre: {}, post: {} } }));
    const { GET } = await import('@/app/api/trace/[chainId]/[txHash]/route');
    const req = () => new NextRequest(`http://localhost/api/trace/43114/${HASH}`);
    const params = () => ({ params: Promise.resolve({ chainId: '43114', txHash: HASH }) });

    const res = await GET(req(), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.call).toEqual(ROOT);
    expect(body.prestate).toEqual({ pre: {}, post: {} });
    expect(body).toMatchObject({ opcodes: null, steps: null, gas: null });

    expect(bodies).toHaveLength(1);
    expect(bodies[0].method).toBe('debug_traceTransaction');
    expect(configOf(bodies[0]).tracer).toBe('muxTracer');
    expect(configOf(bodies[0]).timeout).toBe(TRACE_TIMEOUT);

    // the same tx again is served from memory: the node is not asked twice
    expect((await GET(req(), params())).status).toBe(200);
    expect(bodies).toHaveLength(1);
  });
});

describe('the debug RPC proxy', () => {
  const post = async (body: unknown) => {
    vi.stubEnv('FUJI_DEBUG_RPC_URL', NODE);
    vi.resetModules();
    const { POST } = await import('@/app/api/debug-rpc/route');
    return POST(
      new NextRequest('http://localhost/api/debug-rpc', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'x-forwarded-for': '203.0.113.7' },
      }),
    );
  };

  it('refuses a trace with no tracer or another tracer, and asks the node nothing', async () => {
    const bodies = stubNode(() => ROOT);
    for (const cfg of [undefined, {}, { disableStack: true }, { tracer: 'prestateTracer' }]) {
      expect((await post({ method: 'debug_traceTransaction', params: [HASH, cfg] })).status).toBe(400);
    }
    const call = { from: '0x1', to: '0x2', data: '0x' };
    expect((await post({ method: 'debug_traceCall', params: [call, 'latest', {}] })).status).toBe(400);
    // an old block would make the node replay old state
    expect((await post({ method: 'debug_traceCall', params: [call, '0x1', { tracer: 'callTracer' }] })).status).toBe(400);
    expect(bodies).toHaveLength(0);
  });

  it("forwards a callTracer trace with the node-side timeout, not the client's", async () => {
    const bodies = stubNode(() => ROOT);
    const res = await post({
      method: 'debug_traceTransaction',
      params: [HASH, { tracer: 'callTracer', tracerConfig: { onlyTopCall: false }, timeout: '10m', reexec: 1e6 }],
    });
    expect(res.status).toBe(200);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].params).toEqual([HASH, callTracer()]);

    const call = { from: '0x1', to: '0x2', data: '0x' };
    expect((await post({ method: 'debug_traceCall', params: [call, 'latest', { tracer: 'callTracer' }] })).status).toBe(200);
    expect(bodies[1].params).toEqual([call, 'latest', callTracer()]);
  });
});
