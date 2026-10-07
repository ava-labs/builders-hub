import { describe, expect, it } from 'vitest';
import l1ChainsData from '@/constants/l1-chains.json';

import { targetsOf } from '@/app/api/chain-pulse/route';

/* The chains the pulse reads per network. Today's filter: the network's
   catalog chains with an rpcUrl, less the ones marked non-EVM, plus the
   network's C-Chain. On mainnet that is 31 chains today. */
type Entry = { chainId: string; rpcUrl?: string | null; isTestnet?: boolean; isEvm?: boolean };
const catalog = l1ChainsData as Entry[];
const idsOf = (keep: (c: Entry) => boolean) => new Set(catalog.filter(keep).map((c) => String(c.chainId)));
const reachable = (testnet: boolean) => idsOf((c) => (c.isTestnet === true) === testnet && c.isEvm !== false && !!c.rpcUrl);

describe('targetsOf', () => {
  it("reads today's mainnet chains, the C-Chain's public RPC first, and no testnet chain", () => {
    const targets = targetsOf('mainnet');
    const ids = targets.map((t) => t.chainId);
    expect(new Set(ids)).toEqual(new Set([...reachable(false), '43114']));
    expect(ids).toHaveLength(new Set(ids).size);
    expect(targets.find((t) => t.chainId === '43114')?.urls[0]).toBe('https://api.avax.network/ext/bc/C/rpc');
    const testnet = idsOf((c) => c.isTestnet === true);
    expect(ids.filter((id) => testnet.has(id))).toEqual([]);
  });

  it('reads only the Fuji EVM chains with an rpcUrl, and the Fuji C-Chain', () => {
    const targets = targetsOf('fuji');
    const ids = targets.map((t) => t.chainId);
    expect(new Set(ids)).toEqual(new Set([...reachable(true), '43113']));
    expect(ids).toHaveLength(new Set(ids).size);
    expect(targets.find((t) => t.chainId === '43113')?.urls[0]).toBe('https://api.avax-test.network/ext/bc/C/rpc');
    const testnet = idsOf((c) => c.isTestnet === true);
    expect(ids.every((id) => testnet.has(id))).toBe(true);
  });

  it('asks each L1 at its own catalog rpcUrl alone', () => {
    for (const [network, cChain] of [['mainnet', '43114'], ['fuji', '43113']] as const) {
      const rpcOf = new Map(
        catalog.filter((c) => (c.isTestnet === true) === (network === 'fuji')).map((c) => [String(c.chainId), c.rpcUrl]),
      );
      for (const t of targetsOf(network)) {
        if (t.chainId !== cChain) expect(t.urls).toEqual([rpcOf.get(t.chainId)]);
      }
    }
  });
});
