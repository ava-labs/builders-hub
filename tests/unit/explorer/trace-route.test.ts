import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { SOFT_READ, statusOf } from '@/lib/explorer-soft-status';
import { BREAKER_ERRORS, IP_PER_MINUTE, LEASE_MS, SLOTS } from '@/lib/trace-gate';
import { RedisFake } from './redis-fake';

/* /api/trace and its /gas in front of the shared C-Chain debug node:
   crawlers get no trace or gas profile, a refused or failed read never
   reaches or names the node, and the per-IP budget keys on the IP the edge
   sets. The node URL, the token and the hashes are made up; fetch is
   stubbed, so no test reaches a node. */

const SECRET = 'tok_made_up_for_this_test';
const NODE = `https://debug-node.invalid/ext/bc/C/rpc?token=${SECRET}`;
const hashOf = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const ROOT = { type: 'CALL', from: '0x1', to: '0x2', input: '0x', gas: '0x5208', gasUsed: '0x5208', calls: [] };
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

const fake = { client: null as RedisFake | null };
vi.mock('@/lib/redis', () => ({ redis: async () => fake.client }));

let fetches = 0;
function stubNode(answer: () => Response | Promise<Response>) {
  fetches = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      fetches++;
      return answer();
    }),
  );
}
const rpcResult = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
const MUX = { callTracer: ROOT, prestateTracer: { pre: {}, post: {} } };

async function get(hash: string, headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/trace/[chainId]/[txHash]/route');
  const req = new NextRequest(`http://localhost/api/trace/43114/${hash}`, { headers: { 'user-agent': BROWSER, ...headers } });
  return GET(req, { params: Promise.resolve({ chainId: '43114', txHash: hash }) });
}

/** the gas tracer's answer for a plain transfer */
const GAS_RAW = { limit: 21000, used: 21000, steps: 0, ops: [], top: null, create: false, error: null, out: 0, plain: true };

async function getGas(hash: string, headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/trace/[chainId]/[txHash]/gas/route');
  const req = new NextRequest(`http://localhost/api/trace/43114/${hash}/gas`, { headers: { 'user-agent': BROWSER, ...headers } });
  return GET(req, { params: Promise.resolve({ chainId: '43114', txHash: hash }) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T21:00:05Z'));
  vi.resetModules();
  vi.stubEnv('CCHAIN_DEBUG_RPC_URL', NODE);
  vi.stubEnv('REDIS_URL', 'redis://redis.invalid:6379');
  fake.client = new RedisFake();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('crawlers', () => {
  it('get a 403 and the node is never asked', async () => {
    stubNode(() => rpcResult(MUX));
    for (const ua of [
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; GoogleOther)',
      'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
      'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
    ]) {
      const res = await get(hashOf(1), { 'user-agent': ua });
      expect(res.status, ua).toBe(403);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(fetches).toBe(0);
  });

  it('do not include a person in a browser, an in-app browser, or a headless test browser', async () => {
    stubNode(() => rpcResult(MUX));
    for (const ua of [
      BROWSER,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Instagram 350.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/145.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 SogouMobileBrowser/5.28.4',
      'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 YaBrowser/23.9 YandexSearch/8.10 Mobile Safari/537.36',
    ]) {
      expect((await get(hashOf(2), { 'user-agent': ua })).status, ua).toBe(200);
    }
  });
});

describe('a failed trace', () => {
  it('answers a fixed code and never the fetch error, which can hold the node URL', async () => {
    stubNode(() => {
      throw new TypeError(`fetch failed: could not reach ${NODE}`);
    });
    const res = await get(hashOf(3));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).toBe('{"error":"node_error"}');
    expect(text).not.toContain(SECRET);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it("answers a fixed code for the node's own error text", async () => {
    stubNode(() => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: `upstream ${NODE} failed` } })));
    const text = await (await get(hashOf(4))).text();
    expect(text).toBe('{"error":"node_error"}');
    stubNode(() => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'transaction 0xabc not found' } })));
    const res = await get(hashOf(5), SOFT_READ.headers);
    expect(statusOf(res)).toBe(404);
  });
});

describe('the node budget', () => {
  it('answers a soft 503 when Redis is down, and the node is never asked', async () => {
    stubNode(() => rpcResult(MUX));
    fake.client!.down = true;
    const res = await get(hashOf(6), SOFT_READ.headers);
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
    expect(fetches).toBe(0);
  });

  it('keys the per-IP limit on the IP the edge sets, not on x-forwarded-for', async () => {
    stubNode(() => rpcResult(MUX));
    const from = (i: number) => ({ 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': `203.0.113.${i}`, ...SOFT_READ.headers });
    for (let i = 0; i < IP_PER_MINUTE.open; i++) expect((await get(hashOf(100 + i), from(i))).status).toBe(200);
    const res = await get(hashOf(200), from(99));
    expect(statusOf(res)).toBe(429);
    expect(fetches).toBe(IP_PER_MINUTE.open);
  });

  it(`trips the breaker after ${BREAKER_ERRORS} node failures, but not after error answers from the node`, async () => {
    stubNode(() => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'execution timeout' } })));
    // a new client IP each request, so the per-IP limit stays out of the way
    const as = (i: number) => ({ 'cf-connecting-ip': `198.51.100.${i}`, ...SOFT_READ.headers });
    for (let i = 0; i < BREAKER_ERRORS + 1; i++) expect(statusOf(await get(hashOf(300 + i), as(i)))).toBe(504);
    stubNode(() => new Response('bad gateway', { status: 502 }));
    for (let i = 0; i < BREAKER_ERRORS; i++) expect(statusOf(await get(hashOf(400 + i), as(50 + i)))).toBe(502);
    stubNode(() => rpcResult(MUX));
    const res = await get(hashOf(500), as(99));
    expect(statusOf(res)).toBe(503);
    expect(await res.json()).toEqual({ error: 'breaker' });
    expect(fetches).toBe(0);
  });

  it('keeps the slot of a trace whose fetch gave up, until the lease runs out', async () => {
    stubNode(() => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    const gesture = { 'x-trace-lane': 'gesture', ...SOFT_READ.headers };
    for (let i = 0; i < SLOTS; i++) expect(statusOf(await get(hashOf(600 + i), gesture))).toBe(504);
    stubNode(() => rpcResult(MUX));
    expect(statusOf(await get(hashOf(700), gesture))).toBe(503);
    expect(fetches).toBe(0);
    vi.setSystemTime(Date.now() + LEASE_MS);
    expect((await get(hashOf(701), gesture)).status).toBe(200);
  });

  it('caches a trace without its state diff for minutes only', async () => {
    stubNode(() => rpcResult(MUX));
    expect((await get(hashOf(800))).headers.get('cache-control')).toContain('immutable');
    stubNode(() => rpcResult({ ...MUX, prestateTracer: null }));
    const partial = await get(hashOf(801));
    expect(partial.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300');
  });

  it('serves a trace this instance already has without asking the gate or the node', async () => {
    stubNode(() => rpcResult(MUX));
    expect((await get(hashOf(7))).status).toBe(200);
    fake.client!.down = true;
    const again = await get(hashOf(7));
    expect(again.status).toBe(200);
    expect(again.headers.get('cache-control')).toContain('immutable');
    expect(fetches).toBe(1);
  });
});

describe('the gas route', () => {
  it('gives a crawler a 403, and the node is never asked', async () => {
    stubNode(() => rpcResult(GAS_RAW));
    for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; GoogleOther)']) {
      const res = await getGas(hashOf(300), { 'user-agent': ua });
      expect(res.status, ua).toBe(403);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(fetches).toBe(0);
  });

  it('answers the gas profile, cached hard', async () => {
    stubNode(() => rpcResult(GAS_RAW));
    const res = await getGas(hashOf(301));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.json()).toEqual({ opcodes: [], steps: 0, gas: { limit: 21000, intrinsic: 21000, execution: 0, refund: 0, used: 21000 } });
    expect(fetches).toBe(1);
  });

  it('answers a fixed code, never the node error, and a soft status for a read that asks', async () => {
    stubNode(() => {
      throw new TypeError(`fetch failed: could not reach ${NODE}`);
    });
    const res = await getGas(hashOf(302), SOFT_READ.headers);
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(502);
    const text = await res.text();
    expect(text).toBe('{"error":"node_error"}');
    expect(text).not.toContain(SECRET);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses a bad hash before the node', async () => {
    stubNode(() => rpcResult(GAS_RAW));
    expect((await getGas('0x1234')).status).toBe(400);
    expect(fetches).toBe(0);
  });
});

describe('robots.txt', () => {
  it('keeps crawlers off the routes that run work on the debug node, and off nothing else', async () => {
    const { default: robots } = await import('@/app/robots');
    const { rules } = robots();
    expect(rules).toEqual({ userAgent: '*', disallow: ['/api/trace/', '/api/debug-rpc'] });
    // social previews fetch the OG images; pages stay crawlable
    const disallow = ['/api/trace/', '/api/debug-rpc'];
    for (const path of ['/api/og/tx', '/explorer/mainnet/c-chain/tx/0xabc', '/']) {
      expect(disallow.some((d) => path.startsWith(d)), path).toBe(false);
    }
  });
});
