import { afterEach, describe, expect, it, vi } from 'vitest';

import l1ChainsData from '@/constants/l1-chains.json';
import { lookupTransactionAcrossChains } from '@/lib/cross-chain-lookup';
import { matchChains, raceChains } from '@/components/explorer-v2/chain-search';
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

describe('raceChains', () => {
  const chains = [
    { chainId: '1', chainName: 'Indexed', rpcUrl: PUBLIC },
    { chainId: '2', chainName: 'Not indexed', rpcUrl: PUBLIC },
    { chainId: '3', chainName: 'Testnet', rpcUrl: PUBLIC, isTestnet: true },
    { chainId: '4', chainName: 'Flagged off', rpcUrl: PUBLIC, isIndexed: false },
    { chainId: '5', slug: 'c-chain', chainName: 'Fuji C-Chain', rpcUrl: PUBLIC, isTestnet: true },
    { chainId: '6', chainName: 'Fuji flagged on', rpcUrl: PUBLIC, isTestnet: true, isIndexed: true },
  ] as L1Chain[];

  it('races only the mainnet chains the explorer indexes', () => {
    expect(raceChains(new Set(['1', '3']), 'mainnet', chains).map((c) => c.chainName)).toEqual(['Indexed']);
  });

  it('falls back to the catalog flag on mainnet without the indexed set', () => {
    expect(raceChains(null, 'mainnet', chains).map((c) => c.chainName)).toEqual(['Indexed', 'Not indexed']);
  });

  it('races only the Fuji chains the explorer indexes, and the Fuji C-Chain', () => {
    expect(raceChains(new Set(['1', '3']), 'fuji', chains).map((c) => c.chainName)).toEqual(['Testnet', 'Fuji C-Chain']);
  });

  it('races only the Fuji C-Chain without the indexed set, because the flag is wrong for Fuji', () => {
    expect(raceChains(null, 'fuji', chains).map((c) => c.chainName)).toEqual(['Fuji C-Chain']);
  });
});

/* The search box of one network suggests and races that network's chains
   only. The indexed set is the stats API's answer on 2026-10-07, cut down to
   the chains these checks name. */
describe("a search box's network", () => {
  const indexed = new Set(['4337', '43114', '432204', '43113', '13337', '432201']);
  const QUERIES = ['beam', 'dexalot', 'c-chain', 'p-chain', 'avax', 'chain', 'l1', '43113', '43114', '4337', '13337'];

  it('never races a mainnet chain on Fuji', () => {
    const fuji = raceChains(indexed, 'fuji');
    expect(fuji.map((c) => c.chainId).sort()).toEqual(['13337', '43113', '432201']);
    expect(fuji.every((c) => c.isTestnet === true)).toBe(true);
  });

  it('races the same mainnet chains as before', () => {
    expect(raceChains(indexed).map((c) => c.chainId).sort()).toEqual(['43114', '432204', '4337']);
  });

  it('never suggests a mainnet chain on Fuji', () => {
    for (const q of QUERIES) {
      for (const { chain } of matchChains(q, null, 'fuji', indexed)) {
        expect(chain.isTestnet, `${q}: ${chain.href}`).toBe(true);
        expect(chain.href, q).toMatch(/^\/explorer\/fuji\//);
      }
    }
    expect(matchChains('beam', null, 'fuji', indexed).map((m) => m.chain.href)).toEqual(['/explorer/fuji/beam-l1']);
    expect(matchChains('p-chain', null, 'fuji', indexed)[0].chain.href).toBe('/explorer/fuji/p-chain');
    expect(matchChains('43113', null, 'fuji', indexed)[0].chain.href).toBe('/explorer/fuji/c-chain');
  });

  it('suggests only the Fuji P-Chain and C-Chain while the indexed set loads', () => {
    expect(matchChains('beam', null, 'fuji', null)).toEqual([]);
    expect(matchChains('chain', null, 'fuji', null).map((m) => m.chain.href).sort()).toEqual([
      '/explorer/fuji/c-chain',
      '/explorer/fuji/p-chain',
    ]);
  });

  it('keeps mainnet suggestions as before', () => {
    for (const q of QUERIES) {
      const rows = matchChains(q, null);
      // the indexed set narrows Fuji only
      expect(matchChains(q, null, 'mainnet', indexed), q).toEqual(rows);
      for (const { chain } of rows) {
        expect(chain.isTestnet, `${q}: ${chain.href}`).toBe(false);
        expect(chain.href, q).toMatch(/^\/explorer\/mainnet\//);
      }
    }
    expect(matchChains('beam', null)[0].chain.href).toBe('/explorer/mainnet/beam');
    expect(matchChains('p-chain', null)[0].chain.href).toBe('/explorer/mainnet/p-chain');
  });
});
