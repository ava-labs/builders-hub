import { afterEach, describe, expect, it, vi } from 'vitest';

import l1ChainsData from '@/constants/l1-chains.json';
import { lookupTransactionAcrossChains } from '@/lib/cross-chain-lookup';
import { isPublicRpcUrl } from '@/lib/explorer-rpc';
import type { L1Chain } from '@/types/stats';

/* A browser request to a local-network address from a public page makes
   Chrome ask the reader for local-network access. The explorer calls
   catalog RPCs unasked (a pasted hash races every chain), so the catalog
   and the race hold only public RPCs. Every host and address here is made
   up: example.com names, private ranges, and 203.0.113.0/24, which is
   reserved for documentation. */

const PUBLIC = 'https://rpc.example.com/ext/bc/C/rpc';
const INTERNAL = 'http://node.example.svc.cluster.local:9650/ext/bc/x/rpc';

describe('isPublicRpcUrl', () => {
  it('takes an https RPC on a public name or address', () => {
    expect(isPublicRpcUrl(PUBLIC)).toBe(true);
    expect(isPublicRpcUrl('https://api.example.org/ext/bc/C/rpc')).toBe(true);
    expect(isPublicRpcUrl('https://203.0.113.10:9650/ext/bc/C/rpc')).toBe(true);
  });

  it('refuses a cluster-internal name, a local host and plain http', () => {
    expect(isPublicRpcUrl(INTERNAL)).toBe(false);
    expect(isPublicRpcUrl(INTERNAL.replace('http://', 'https://'))).toBe(false);
    expect(isPublicRpcUrl('https://localhost:9650/ext/bc/C/rpc')).toBe(false);
    expect(isPublicRpcUrl('https://node.localhost/rpc')).toBe(false);
    expect(isPublicRpcUrl('https://rpc.internal/rpc')).toBe(false);
    expect(isPublicRpcUrl('https://l1-rpc:9650/ext/bc/x/rpc')).toBe(false);
    expect(isPublicRpcUrl('http://rpc.example.com/rpc')).toBe(false);
  });

  it('refuses private, loopback, link-local and shared addresses', () => {
    for (const host of ['10.0.0.5', '127.0.0.1', '0.0.0.0', '169.254.1.1', '172.16.0.1', '172.31.255.1', '192.168.1.10', '100.64.0.1', '[::1]', '[fd00::1]']) {
      expect(isPublicRpcUrl(`https://${host}:9650/ext/bc/C/rpc`), host).toBe(false);
    }
    // just past the edge of 172.16.0.0/12
    expect(isPublicRpcUrl('https://172.32.0.1:9650/ext/bc/C/rpc')).toBe(true);
  });

  it('refuses nothing and nonsense', () => {
    expect(isPublicRpcUrl(undefined)).toBe(false);
    expect(isPublicRpcUrl('')).toBe(false);
    expect(isPublicRpcUrl('not a url')).toBe(false);
  });
});

describe('the catalog', () => {
  it('lists only public RPCs', () => {
    const bad = (l1ChainsData as L1Chain[]).filter((c) => c.rpcUrl && !isPublicRpcUrl(c.rpcUrl)).map((c) => `${c.chainName}: ${c.rpcUrl}`);
    expect(bad).toEqual([]);
  });
});

describe('lookupTransactionAcrossChains', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks only the public RPCs', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null })));
    vi.stubGlobal('fetch', fetch);
    const chains = [
      { chainId: '1', chainName: 'Public', rpcUrl: PUBLIC },
      { chainId: '2', chainName: 'Internal', rpcUrl: INTERNAL },
      { chainId: '3', chainName: 'Home', rpcUrl: 'http://192.168.1.10:9650/ext/bc/x/rpc' },
      { chainId: '4', chainName: 'No RPC' },
    ] as L1Chain[];
    await expect(lookupTransactionAcrossChains(`0x${'ab'.repeat(32)}`, chains)).resolves.toEqual({ found: false });
    expect(fetch.mock.calls.map((call) => (call as unknown[])[0])).toEqual([PUBLIC]);
  });
});
