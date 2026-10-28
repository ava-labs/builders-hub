import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import {
  bech32Answer,
  bech32AddressCached,
  bech32Pending,
  bech32Rows,
  holdsOf,
  xchainHit,
  xchainSearchCached,
} from '@/components/explorer-v2/chain-search';

/* A CB58 id the P-Chain search does not claim can still live on the
   X-Chain: a transaction, or a genesis asset (a CreateAssetTx id with no
   tx page). The x-api has no search endpoint, so the search probes
   tx/{id} and then asset/{id} through the /api/xchain proxy. */

const X_TX = 'UaqkkB9GVGhmyGhQSGMGodmZiMFFbdP2mJdh7JEji1BGjuJo9';

function fetchReturning(txStatus: number, assetStatus: number) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const status = url.includes('/tx/') ? txStatus : assetStatus;
    return new Response(status === 200 ? '{}' : '', { status });
  });
}

describe('xchainSearchCached', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('claims an id the tx endpoint has', async () => {
    const fetchMock = fetchReturning(200, 404);
    vi.stubGlobal('fetch', fetchMock);
    const hit = await xchainSearchCached('mainnet', X_TX);
    expect(hit).toEqual({ type: 'tx', id: X_TX });
    // a tx hit never pays for the asset probe
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/xchain/mainnet/tx/${X_TX}`);
  });

  it('falls back to the asset endpoint when the tx probe misses', async () => {
    const fetchMock = fetchReturning(404, 200);
    vi.stubGlobal('fetch', fetchMock);
    const hit = await xchainSearchCached('mainnet', 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCwN6FT');
    expect(hit.type).toBe('asset');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers none when neither endpoint claims the id', async () => {
    vi.stubGlobal('fetch', fetchReturning(404, 404));
    expect((await xchainSearchCached('mainnet', '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM')).type).toBe('none');
  });

  it('answers none when the proxy is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('down'))));
    expect((await xchainSearchCached('mainnet', '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm')).type).toBe('none');
  });

  it('probes each id once per session', async () => {
    const fetchMock = fetchReturning(200, 404);
    vi.stubGlobal('fetch', fetchMock);
    const q = 'H8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWpyX';
    await xchainSearchCached('mainnet', q);
    await xchainSearchCached('mainnet', q);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('xchainHit', () => {
  it('routes a tx hit to the X-Chain tx page', () => {
    const hit = xchainHit(X_TX, 'mainnet', { type: 'tx', id: X_TX });
    expect(hit.href).toBe(`/explorer/mainnet/x-chain/tx/${X_TX}`);
    expect(hit.detail).toBe('X-Chain');
    expect(hit.status).toBe('ready');
    expect(hit.label).toBe('Transaction');
  });

  it('routes an asset hit to the X-Chain asset page', () => {
    const id = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCwN6FT';
    const hit = xchainHit(id, 'mainnet', { type: 'asset', id });
    expect(hit.href).toBe(`/explorer/mainnet/x-chain/asset/${id}`);
    expect(hit.label).toBe('Asset');
  });

  it('keeps the network segment', () => {
    expect(xchainHit(X_TX, 'fuji', { type: 'tx', id: X_TX }).href).toBe(`/explorer/fuji/x-chain/tx/${X_TX}`);
  });

  it('renders a miss as a disabled nothing-matched row', () => {
    const hit = xchainHit(X_TX, 'mainnet', { type: 'none', id: X_TX });
    expect(hit.href).toBeNull();
    expect(hit.status).toBe('notfound');
  });
});

/* A bech32 address is one account on the P-Chain and the X-Chain. An X-/P-
   prefix selects the chain outright; a bare avax1… asks both chains whether
   they hold the account and returns a hit per claimant, P-Chain first. */

const ADDR = 'avax1xph3ysxkmj2zlhac6nz9hj9cx2av4f7xa9a245';
const P_EMPTY = { utxoCount: 0, utxos: [], balance: { total: '0' }, breakdown: { atomicMemoryUnlocked: '0', atomicMemoryLocked: '0' } };
const P_LIVE = { utxoCount: 2, utxos: [{}], balance: { total: '5' }, breakdown: { atomicMemoryUnlocked: '0', atomicMemoryLocked: '0' } };
const X_EMPTY = { balances: [], transactions: [] };
const X_LIVE = { balances: [{ balance: '10', utxoCount: 1 }], transactions: [{}] };

/* A read's answer: a body as 200, a number as that status, `soft(n)` as the
   soft answer a proxy gives a read that asks (200 with x-status n), an Error
   as a network failure. */
type Answer = object | number | Error | { soft: number };
const soft = (status: number) => ({ soft: status });
function reply(a: Answer): Response {
  if (a instanceof Error) throw a;
  if (typeof a === 'number') return new Response('', { status: a });
  if ('soft' in a) return new Response('{}', { status: 200, headers: { 'x-status': String(a.soft) } });
  return new Response(JSON.stringify(a), { status: 200 });
}

/** P-Chain address read, X-Chain address read */
function addressFetch(p: Answer, x: Answer) {
  return vi.fn(async (input: RequestInfo | URL) => reply(String(input).includes('/api/pchain/') ? p : x));
}

/* The same reads through the real /api/pchain and /api/xchain routes, whose
   upstream is the explorer API (stats-api). Its rate limit is a 429 with
   this body (apierrors.Write); Cloudflare in front of it answers 429 too.
   `answered` keeps what each route gave the browser. */
const RATE_LIMITED = { message: 'rate limit reached, retry in 2s', error: 'Too Many Requests', statusCode: 429 };
function proxiedFetch(upstream: (url: string) => Response) {
  const answered: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('/')) return upstream(url);
    const [, , proxy, network, ...path] = url.split('/');
    const { GET } =
      proxy === 'pchain'
        ? await import('@/app/api/pchain/[network]/[...path]/route')
        : await import('@/app/api/xchain/[network]/[...path]/route');
    const res = await GET(new NextRequest(`http://localhost${url}`, { headers: init?.headers }), {
      params: Promise.resolve({ network, path }),
    });
    answered.push(`${proxy} ${res.status} x-status ${res.headers.get('x-status')}`);
    return res;
  });
  return { fetchMock, answered };
}

describe('holdsOf', () => {
  const has = (d: { n: number }) => d.n > 0;

  it('reads a success through the probe', async () => {
    expect(await holdsOf(reply({ n: 1 }), has)).toBe('yes');
    expect(await holdsOf(reply({ n: 0 }), has)).toBe('no');
  });

  it('answers unknown for a timeout, a refusal or an upstream error, soft or not', async () => {
    for (const a of [soft(504), soft(429), soft(500), soft(503), 429, 502, 504]) {
      expect(await holdsOf(reply(a), has), JSON.stringify(a)).toBe('unknown');
    }
  });

  it('answers no for a miss or a bad request', async () => {
    expect(await holdsOf(reply(soft(404)), has)).toBe('no');
    expect(await holdsOf(reply(404), has)).toBe('no');
    expect(await holdsOf(reply(400), has)).toBe('no');
  });
});

describe('bech32Answer', () => {
  it('lists the chains that hold the address, p-chain first', () => {
    expect(bech32Answer(ADDR, 'yes', 'yes')).toEqual({
      hits: [
        { chain: 'p-chain', id: ADDR },
        { chain: 'x-chain', id: `X-${ADDR}` },
      ],
      unknown: [],
    });
  });

  it('keeps the p-chain default when no chain is known to hold it, and names the chain that did not answer', () => {
    expect(bech32Answer(ADDR, 'no', 'unknown')).toEqual({
      hits: [{ chain: 'p-chain', id: ADDR }],
      unknown: ['x-chain'],
    });
    expect(bech32Answer(ADDR, 'unknown', 'unknown')).toEqual({
      hits: [{ chain: 'p-chain', id: ADDR }],
      unknown: ['p-chain', 'x-chain'],
    });
  });

  it('opens a known holder when the other chain did not answer', () => {
    expect(bech32Answer(ADDR, 'unknown', 'yes')).toEqual({
      hits: [{ chain: 'x-chain', id: `X-${ADDR}` }],
      unknown: ['p-chain'],
    });
  });
});

describe('bech32AddressCached', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes an X- prefixed address to the x-chain with no probe', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await bech32AddressCached('mainnet', `X-${ADDR}`)).toEqual({
      hits: [{ chain: 'x-chain', id: `X-${ADDR}` }],
      unknown: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes a P- prefixed address to the p-chain with no probe', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(await bech32AddressCached('mainnet', `P-${ADDR}`)).toEqual({
      hits: [{ chain: 'p-chain', id: ADDR }],
      unknown: [],
    });
  });

  it('offers only the x-chain for a bare address the p-chain does not hold', async () => {
    vi.stubGlobal('fetch', addressFetch(P_EMPTY, X_LIVE));
    expect((await bech32AddressCached('mainnet', ADDR)).hits).toEqual([{ chain: 'x-chain', id: `X-${ADDR}` }]);
  });

  it('offers only the p-chain for a bare address the x-chain does not hold', async () => {
    vi.stubGlobal('fetch', addressFetch(P_LIVE, X_EMPTY));
    expect(await bech32AddressCached('mainnet', 'avax1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toEqual({
      hits: [{ chain: 'p-chain', id: 'avax1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' }],
      unknown: [],
    });
  });

  it('offers both chains, p-chain first, when both hold the account', async () => {
    vi.stubGlobal('fetch', addressFetch(P_LIVE, X_LIVE));
    const q = 'avax1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect((await bech32AddressCached('mainnet', q)).hits).toEqual([
      { chain: 'p-chain', id: q },
      { chain: 'x-chain', id: `X-${q}` },
    ]);
  });

  it('falls back to the p-chain when no chain holds the account', async () => {
    vi.stubGlobal('fetch', addressFetch(P_EMPTY, X_EMPTY));
    const q = 'avax1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(await bech32AddressCached('mainnet', q)).toEqual({ hits: [{ chain: 'p-chain', id: q }], unknown: [] });
  });

  it('counts atomic memory as p-chain activity', async () => {
    vi.stubGlobal(
      'fetch',
      addressFetch({ ...P_EMPTY, breakdown: { atomicMemoryUnlocked: '7', atomicMemoryLocked: '0' } }, X_EMPTY),
    );
    const q = 'avax1cccccccccccccccccccccccccccccccccccccc';
    expect((await bech32AddressCached('mainnet', q)).hits).toEqual([{ chain: 'p-chain', id: q }]);
  });

  it('probes each address once per session', async () => {
    const fetchMock = addressFetch(P_EMPTY, X_LIVE);
    vi.stubGlobal('fetch', fetchMock);
    const q = 'avax1dddddddddddddddddddddddddddddddddddddd';
    await bech32AddressCached('mainnet', q);
    await bech32AddressCached('mainnet', q);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a failed x-chain probe as unknown, not absent, and asks again on the next call', async () => {
    const q = 'avax1jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj';
    // the soft 504 the proxy gives at its 15 s cap
    const failing = addressFetch(P_EMPTY, soft(504));
    vi.stubGlobal('fetch', failing);
    expect(await bech32AddressCached('mainnet', q)).toEqual({
      hits: [{ chain: 'p-chain', id: q }],
      unknown: ['x-chain'],
    });
    const answering = addressFetch(P_EMPTY, X_LIVE);
    vi.stubGlobal('fetch', answering);
    expect(await bech32AddressCached('mainnet', q)).toEqual({
      hits: [{ chain: 'x-chain', id: `X-${q}` }],
      unknown: [],
    });
    // the p-chain's clean miss was kept: only the x-chain is asked again
    expect(answering.mock.calls.map(([u]) => String(u)).some((u) => u.includes('/api/pchain/'))).toBe(false);
  });

  it('reports a failed p-chain probe as unknown and keeps the p-chain default', async () => {
    const q = 'avax1kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk';
    vi.stubGlobal('fetch', addressFetch(new Error('offline'), X_EMPTY));
    expect(await bech32AddressCached('mainnet', q)).toEqual({
      hits: [{ chain: 'p-chain', id: q }],
      unknown: ['p-chain'],
    });
  });

  it('reads an explorer API rate limit through the proxies as unknown, and asks again', async () => {
    const q = 'avax1nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn';
    const limited = proxiedFetch(
      () =>
        new Response(JSON.stringify(RATE_LIMITED), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '3' },
        }),
    );
    vi.stubGlobal('fetch', limited.fetchMock);
    expect(await bech32AddressCached('mainnet', q)).toEqual({
      hits: [{ chain: 'p-chain', id: q }],
      unknown: ['p-chain', 'x-chain'],
    });
    // what reached the browser: both routes pass the 429 on as a soft answer
    expect(limited.answered.sort()).toEqual(['pchain 200 x-status 429', 'xchain 200 x-status 429']);
    const answering = proxiedFetch((url) => reply(url.includes('/x-api/') ? X_LIVE : P_EMPTY));
    vi.stubGlobal('fetch', answering.fetchMock);
    expect(await bech32AddressCached('mainnet', q)).toEqual({
      hits: [{ chain: 'x-chain', id: `X-${q}` }],
      unknown: [],
    });
  });

  it('keeps a clean miss: the next call does not read again', async () => {
    const q = 'avax1llllllllllllllllllllllllllllllllllllll';
    vi.stubGlobal('fetch', addressFetch(P_EMPTY, X_EMPTY));
    await bech32AddressCached('mainnet', q);
    const again = addressFetch(P_LIVE, X_LIVE);
    vi.stubGlobal('fetch', again);
    expect(await bech32AddressCached('mainnet', q)).toEqual({ hits: [{ chain: 'p-chain', id: q }], unknown: [] });
    expect(again).not.toHaveBeenCalled();
  });

  it('shares a probe in flight between the dropdown and Enter', async () => {
    const fetchMock = addressFetch(P_EMPTY, X_LIVE);
    vi.stubGlobal('fetch', fetchMock);
    const q = 'avax1mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm';
    const [a, b] = await Promise.all([bech32AddressCached('mainnet', q), bech32AddressCached('mainnet', q)]);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('bech32Rows', () => {
  it('gives a row per chain that holds the address', () => {
    const rows = bech32Rows(ADDR, 'mainnet', { hits: [{ chain: 'x-chain', id: `X-${ADDR}` }], unknown: [] });
    expect(rows).toEqual([
      {
        icon: 'address',
        label: 'Address',
        id: ADDR,
        href: `/explorer/mainnet/x-chain/address/X-${ADDR}`,
        detail: 'X-Chain',
        status: 'ready',
      },
    ]);
  });

  it('keeps the p-chain row first and adds one row for the chains that did not answer', () => {
    const rows = bech32Rows(ADDR, 'fuji', { hits: [{ chain: 'p-chain', id: ADDR }], unknown: ['p-chain', 'x-chain'] });
    expect(rows.map((r) => [r.href, r.detail, r.status])).toEqual([
      [`/explorer/fuji/p-chain/address/${ADDR}`, 'P-Chain', 'ready'],
      [null, 'The P-Chain and X-Chain did not answer', 'notfound'],
    ]);
  });

  it('says which chain is asked again while it is', () => {
    expect(bech32Pending(ADDR, ['x-chain'])).toMatchObject({
      href: null,
      detail: 'Asking the X-Chain again…',
      status: 'searching',
    });
  });
});
