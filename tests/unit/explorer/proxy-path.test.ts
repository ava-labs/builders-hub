import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { upstreamPath } from '@/lib/explorer-proxy-path';
import { GET as catomic } from '@/app/api/catomic/[network]/[...path]/route';
import { GET as evm } from '@/app/api/evm/[chainId]/[...path]/route';
import { GET as pchain } from '@/app/api/pchain/[network]/[...path]/route';
import { GET as xchain } from '@/app/api/xchain/[network]/[...path]/route';

/* The Explorer's proxies forward the rest of a path under a fixed prefix of the upstream. A segment that could name a
   place outside the prefix is refused before any fetch: Next.js hands a route each segment decoded, so a %2F in the
   request is a slash inside one segment here. */

const HASH = `0x${'ab'.repeat(32)}`;
const ADDRESS = `0x${'cd'.repeat(20)}`;

describe('upstreamPath', () => {
  it('keeps the paths the Explorer asks for', () => {
    expect(upstreamPath(undefined)).toBe('');
    expect(upstreamPath(['txs'])).toBe('txs');
    expect(upstreamPath(['tx', HASH, 'trace'])).toBe(`tx/${HASH}/trace`);
    expect(upstreamPath(['address', ADDRESS, 'erc20-balance'])).toBe(`address/${ADDRESS}/erc20-balance`);
    expect(upstreamPath(['address', 'P-avax1exampleexampleexampleexampleexample'])).toBe('address/P-avax1exampleexampleexampleexampleexample');
    expect(upstreamPath(['validator', 'NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'])).toBe('validator/NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    // a segment's other characters go as text of that one segment
    expect(upstreamPath(['search', 'a b?c#d%2e'])).toBe('search/a%20b%3Fc%23d%252e');
  });

  it('refuses a segment that could leave its place', () => {
    for (const path of [['..'], ['.'], ['tx', '..', 'x'], ['../../api'], ['..\\x'], ['a/b'], ['tx', ''], ['a\nb'], ['a\u0000']]) expect(upstreamPath(path), JSON.stringify(path)).toBeNull();
  });
});

describe('the Explorer proxies', () => {
  const fetchMock = vi.fn();
  const request = (url: string) => new NextRequest(`http://localhost${url}`);
  const routes = [
    { name: 'evm', call: (path: string[]) => evm(request('/api/evm/43114/x'), { params: Promise.resolve({ chainId: '43114', path }) }), prefix: '/evm-api/43114/' },
    { name: 'catomic', call: (path: string[]) => catomic(request('/api/catomic/mainnet/x'), { params: Promise.resolve({ network: 'mainnet', path }) }), prefix: '/evm-api/43114/' },
    { name: 'pchain', call: (path: string[]) => pchain(request('/api/pchain/mainnet/x'), { params: Promise.resolve({ network: 'mainnet', path }) }), prefix: '/api/mainnet/' },
    { name: 'xchain', call: (path: string[]) => xchain(request('/api/xchain/mainnet/x'), { params: Promise.resolve({ network: 'mainnet', path }) }), prefix: '/x-api/mainnet/' },
  ];

  beforeEach(() => {
    fetchMock.mockReset().mockImplementation(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(routes)('$name answers 400 to a path outside its prefix, and asks the upstream nothing', async ({ call }) => {
    for (const path of [['../../api', 'mainnet', 'validators'], ['..', '..', 'openapi.json'], ['tx', '..\\..', 'docs']]) {
      const res = await call(path);
      expect(res.status, JSON.stringify(path)).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid path' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(routes)('$name forwards a path under its prefix', async ({ call, prefix }) => {
    const res = await call(['tx', HASH]);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(`${prefix}tx/${HASH}`);
  });
});

describe('routes that put one request value into an upstream path', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockImplementation(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const STEERED = '43114/../../evm-api/chains?';

  it('refuse a value that is not of its format, before any fetch', async () => {
    const { GET: validators } = await import('@/app/api/validators/[nodeId]/route');
    const { GET: activity } = await import('@/app/api/pchain-activity/[network]/route');
    const { GET: trace } = await import('@/app/api/trace/[chainId]/[txHash]/route');
    const { GET: icm } = await import('@/app/api/explorer/[chainId]/icm/route');
    const { GET: stats } = await import('@/app/api/chain-stats/[chainId]/route');
    const req = (url: string) => new NextRequest(`http://localhost${url}`);

    expect((await validators(req('/api/validators/x'), { params: Promise.resolve({ nodeId: 'NodeID-/../../../evm-api/chains' }) })).status).toBe(400);
    expect((await activity(req('/api/pchain-activity/x'), { params: Promise.resolve({ network: STEERED }) })).status).toBe(404);
    expect((await trace(req(`/api/trace/x/${HASH}?block=1`), { params: Promise.resolve({ chainId: STEERED, txHash: HASH }) })).status).toBe(400);
    expect((await icm(req('/api/explorer/x/icm'), { params: Promise.resolve({ chainId: STEERED }) })).status).toBe(400);
    expect((await stats(req('/api/chain-stats/x'), { params: Promise.resolve({ chainId: STEERED }) })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
