import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { SOFT_READ, isOk, softStatus, statusOf } from '@/lib/explorer-soft-status';

/* The browser logs every HTTP error to the console, an expected one too.
   A read that asks gets an expected error as 200 with the status in a
   header; any other read gets the real status. Hosts and hashes here are
   made up. */

const HASH = `0x${'ab'.repeat(32)}`;
const soft = (url: string) => new NextRequest(url, SOFT_READ);
const plain = (url: string) => new NextRequest(url);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('softStatus', () => {
  it('answers a miss, a refusal or an upstream error as 200 to a read that asks', () => {
    for (const status of [404, 429, 500, 502, 503, 504]) {
      const out = softStatus(soft('http://localhost/api/x'), status, { 'content-type': 'application/json' });
      expect(out.status, String(status)).toBe(200);
      expect(out.headers['x-status']).toBe(String(status));
      // a cache must never hand the soft answer to a read that did not ask
      expect(out.headers['cache-control']).toBe('no-store');
      expect(out.headers['content-type']).toBe('application/json');
    }
  });

  it('keeps the real status for a read that does not ask, for a bad request and for a success', () => {
    expect(softStatus(plain('http://localhost/api/x'), 404)).toEqual({ status: 404, headers: {} });
    expect(softStatus(soft('http://localhost/api/x'), 400)).toEqual({ status: 400, headers: {} });
    expect(softStatus(soft('http://localhost/api/x'), 200, { a: 'b' })).toEqual({ status: 200, headers: { a: 'b' } });
  });

  it('reads back as the status it stands for', () => {
    const miss = new Response('{}', { status: 200, headers: { 'x-status': '404' } });
    expect(statusOf(miss)).toBe(404);
    expect(isOk(miss)).toBe(false);
    expect(statusOf(json({}))).toBe(200);
    expect(isOk(json({}))).toBe(true);
    expect(statusOf(json({}, 502))).toBe(502);
    expect(isOk(json({}, 502))).toBe(false);
  });
});

describe('the explorer proxies', () => {
  const upstream = vi.fn();
  beforeEach(() => {
    upstream.mockReset();
    vi.stubGlobal('fetch', upstream);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function evm(path: string, req: NextRequest) {
    const { GET } = await import('@/app/api/evm/[chainId]/[...path]/route');
    return GET(req, { params: Promise.resolve({ chainId: '43114', path: path.split('/') }) });
  }

  it('passes a tx the indexer has not reached as a soft 404, and a plain 404 to a read that does not ask', async () => {
    upstream.mockImplementation(async () => json({ error: 'not found' }, 404));
    const s = await evm(`tx/${HASH}`, soft(`http://localhost/api/evm/43114/tx/${HASH}`));
    expect(s.status).toBe(200);
    expect(s.headers.get('x-status')).toBe('404');
    expect(await s.json()).toEqual({ error: 'not found' });
    const p = await evm(`tx/${HASH}`, plain(`http://localhost/api/evm/43114/tx/${HASH}`));
    expect(p.status).toBe(404);
    expect(p.headers.get('x-status')).toBeNull();
  });

  it('answers an upstream that does not answer as a soft 504', async () => {
    upstream.mockImplementation(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const s = await evm('address/0x0000000000000000000000000000000000000001/txs', soft('http://localhost/api/evm/43114/address/0x0000000000000000000000000000000000000001/txs?limit=50'));
    expect(s.status).toBe(200);
    expect(statusOf(s)).toBe(504);
    expect(await s.json()).toEqual({ error: 'explorer API timeout' });
  });

  it('keeps a success as it was, cache headers and all', async () => {
    upstream.mockImplementation(async () => json({ hash: HASH }));
    const s = await evm(`tx/${HASH}`, soft(`http://localhost/api/evm/43114/tx/${HASH}`));
    expect(s.status).toBe(200);
    expect(isOk(s)).toBe(true);
    expect(s.headers.get('cache-control')).toContain('s-maxage=86400');
  });

  it('answers a P-Chain upstream that does not answer as a soft 504', async () => {
    const { GET } = await import('@/app/api/pchain/[network]/[...path]/route');
    upstream.mockImplementation(async () => {
      throw new TypeError('fetch failed');
    });
    const res = await GET(soft('http://localhost/api/pchain/mainnet/txs?limit=8'), { params: Promise.resolve({ network: 'mainnet', path: ['txs'] }) });
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(504);
    expect(await res.json()).toEqual({ error: 'explorer API unreachable' });
  });

  it('answers an ICM message the index does not hold as a soft 404', async () => {
    const { GET } = await import('@/app/api/icm/message/[messageId]/route');
    upstream.mockImplementation(async () => json({}, 404));
    const res = await GET(soft(`http://localhost/api/icm/message/${HASH}`), { params: Promise.resolve({ messageId: HASH }) });
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('answers a market history CoinGecko refuses as a soft 502', async () => {
    const { GET } = await import('@/app/api/market-history/[chainId]/route');
    upstream.mockImplementation(async () => json({}, 429));
    const res = await GET(soft('http://localhost/api/market-history/43114?days=7'), { params: Promise.resolve({ chainId: '43114' }) });
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(502);
  });

  it('does not keep an X-Chain miss: the tx is asked again', async () => {
    const { GET } = await import('@/app/api/xchain/[network]/[...path]/route');
    upstream.mockImplementation(async () => json({ error: 'not found' }, 404));
    const params = { params: Promise.resolve({ network: 'mainnet', path: ['tx', 'TxIdExampleExampleExampleExampleExampleExample1'] }) };
    const p = await GET(plain('http://localhost/api/xchain/mainnet/tx/TxIdExampleExampleExampleExampleExampleExample1'), params);
    expect(p.status).toBe(404);
    expect(p.headers.get('cache-control') ?? '').not.toContain('s-maxage');
    const s = await GET(soft('http://localhost/api/xchain/mainnet/tx/TxIdExampleExampleExampleExampleExampleExample1'), { params: Promise.resolve({ network: 'mainnet', path: ['tx', 'TxIdExampleExampleExampleExampleExampleExample1'] }) });
    expect(s.status).toBe(200);
    expect(statusOf(s)).toBe(404);
  });
});

describe('a node this deployment does not have', () => {
  it('leaves the tx page without a trace, softly', async () => {
    vi.stubEnv('FUJI_DEBUG_RPC_URL', '');
    vi.resetModules();
    const { GET } = await import('@/app/api/trace/[chainId]/[txHash]/route');
    const res = await GET(soft(`http://localhost/api/trace/43113/${HASH}`), { params: Promise.resolve({ chainId: '43113', txHash: HASH }) });
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(404);
    vi.unstubAllEnvs();
  });

  it('answers the burn as a soft 503, which stops the blocks list asking', async () => {
    vi.stubEnv('FUJI_DEBUG_RPC_URL', '');
    vi.resetModules();
    const { GET } = await import('@/app/api/explorer/[chainId]/burn/route');
    const res = await GET(soft('http://localhost/api/explorer/43113/burn?blocks=1,2'), { params: Promise.resolve({ chainId: '43113' }) });
    expect(res.status).toBe(200);
    expect(statusOf(res)).toBe(503);
    vi.unstubAllEnvs();
  });
});
