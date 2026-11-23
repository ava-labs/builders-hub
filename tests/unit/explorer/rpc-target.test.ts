/* The explorer API routes read a chain's RPC from l1-chains.json only. An
   `rpcUrl` query parameter is ignored: the server makes no request to a URL
   that the caller supplies, whatever the URL is. */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import l1ChainsData from '@/constants/l1-chains.json';
import { GET as explorerGet } from '@/app/api/explorer/[chainId]/route';
import { GET as blockGet } from '@/app/api/explorer/[chainId]/block/[blockNumber]/route';
import { GET as blockTxsGet } from '@/app/api/explorer/[chainId]/block/[blockNumber]/transactions/route';
import { GET as txGet } from '@/app/api/explorer/[chainId]/tx/[txHash]/route';

vi.mock('@/lib/explorer-clickhouse', () => ({
  getCumulativeTxs: vi.fn(async () => new Map()),
  getDailyTxsByChain: vi.fn(async () => new Map()),
}));

const fetchMock = vi.fn();

/* A JSON-RPC answer for any method: a small block, a receipt, a tx, a height. */
function rpcAnswer(method: string): unknown {
  switch (method) {
    case 'eth_blockNumber':
      return '0x10';
    case 'eth_getBlockByNumber':
      return { number: '0x10', hash: '0xb', timestamp: '0x1', gasUsed: '0x0', gasLimit: '0x1', transactions: [] };
    case 'eth_getTransactionReceipt':
      return { blockNumber: '0x10', status: '0x1', gasUsed: '0x0', logs: [] };
    case 'eth_getTransactionByHash':
      return { hash: '0xa', blockNumber: '0x10', from: '0x0', to: null, value: '0x0', input: '0x' };
    default:
      return null;
  }
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const reply = Array.isArray(body)
      ? body.map((b: { id: number; method: string }) => ({ jsonrpc: '2.0', id: b.id, result: rpcAnswer(b.method) }))
      : { jsonrpc: '2.0', id: body.id ?? 1, result: rpcAnswer(body.method) };
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const C_CHAIN = '43114';
const C_CHAIN_RPC = (l1ChainsData as { chainId: string; rpcUrl?: string }[]).find((c) => c.chainId === C_CHAIN)!.rpcUrl!;
const UNKNOWN_CHAIN = '987654321';

/* Targets a caller could name. A public URL is refused too: only the chain
   list names RPCs. The redirecting and private-resolving hosts are
   documentation names; the route must not contact them at all. */
const TARGETS = [
  'https://localhost/rpc',
  'https://127.0.0.1/rpc',
  'http://169.254.169.254/latest/meta-data/',
  'https://10.0.0.1/rpc',
  'https://[::ffff:169.254.169.254]/rpc',
  'https://resolves-private.example/rpc',
  'https://redirects-to-metadata.example/abc',
  'https://public-rpc.example/ext/bc/C/rpc',
];

type Handler = (chainId: string, rpcUrl: string) => Promise<Response>;

const req = (path: string, rpcUrl: string) =>
  new NextRequest(`https://build.example${path}?rpcUrl=${encodeURIComponent(rpcUrl)}`);

const ROUTES: Record<string, Handler> = {
  'explorer data': (chainId, rpcUrl) =>
    explorerGet(req(`/api/explorer/${chainId}`, rpcUrl), { params: Promise.resolve({ chainId }) }),
  'explorer new blocks': (chainId, rpcUrl) =>
    explorerGet(
      new NextRequest(`https://build.example/api/explorer/${chainId}?blocksOnly=true&rpcUrl=${encodeURIComponent(rpcUrl)}`),
      { params: Promise.resolve({ chainId }) },
    ),
  block: (chainId, rpcUrl) =>
    blockGet(req(`/api/explorer/${chainId}/block/16`, rpcUrl), {
      params: Promise.resolve({ chainId, blockNumber: '16' }),
    }),
  'block transactions': (chainId, rpcUrl) =>
    blockTxsGet(req(`/api/explorer/${chainId}/block/16/transactions`, rpcUrl), {
      params: Promise.resolve({ chainId, blockNumber: '16' }),
    }),
  tx: (chainId, rpcUrl) =>
    txGet(req(`/api/explorer/${chainId}/tx/0xa`, rpcUrl), {
      params: Promise.resolve({ chainId, txHash: '0xa' }),
    }),
};

const fetchedUrls = () => fetchMock.mock.calls.map(([url]) => String(url));

describe.each(Object.entries(ROUTES))('%s route', (_name, call) => {
  it.each(TARGETS)('refuses a chain outside the list and does not fetch %s', async (target) => {
    const res = await call(UNKNOWN_CHAIN, target);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(TARGETS)('reads a listed chain from its list RPC, not from %s', async (target) => {
    await call(C_CHAIN, target);
    const urls = fetchedUrls();
    expect(urls).toContain(C_CHAIN_RPC);
    const host = new URL(target).host;
    expect(urls.filter((u) => u.includes(host))).toEqual([]);
  });
});

describe('price call for a chain outside the list', () => {
  it('answers with the given token symbol and makes no request', async () => {
    const res = await explorerGet(
      new NextRequest(
        `https://build.example/api/explorer/${UNKNOWN_CHAIN}?priceOnly=true&tokenSymbol=TEST&rpcUrl=${encodeURIComponent('http://169.254.169.254/')}`,
      ),
      { params: Promise.resolve({ chainId: UNKNOWN_CHAIN }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tokenSymbol: 'TEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
