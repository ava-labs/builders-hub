import { describe, expect, it } from 'vitest';

import registryData from '@/data/contract-registry.json';
import { registryTurn } from '@/lib/explorer-query/registry-turn';

const contracts = (registryData as { contracts: { address: string; protocol?: string }[] }).contracts;
const of = (protocol: string) => contracts.filter((c) => c.protocol === protocol).map((c) => c.address.toLowerCase());

describe('a protocol with no chapter, as its turn lists it', () => {
  it("names every Curve pool the registry holds, the pools Curve's own lists hold", () => {
    const turn = registryTurn(43114, 'How many Curve swaps this week?');
    expect(of('Curve').length).toBe(34);
    for (const a of of('Curve')) expect(turn).toContain(a);
    // the StableswapNG AVAX/USD pool, the busiest the registry lacked, and the twocrypto-ng sAVAX/WAVAX pool
    expect(turn).toContain('0xbb2a7485490eb3ec8c2f34cf798a2b2c1f17b30b (Curve AVAX/USD Pool)');
    expect(turn).toContain('0x6a1c781b7b280e3c8bf04fdfb86c112c9ac70a89 (Curve sAVAX/WAVAX Pool)');
  });

  it("counts a metapool's underlying swaps and a twocrypto-ng pool's", () => {
    const turn = registryTurn(43114, 'Curve swaps by pool this month');
    expect(turn).toContain("TokenExchangeUnderlying unhex('d013ca23e77a65003c2c659c5442c00c805371b7fc1ebd4c206c41d1536bd90b')");
    expect(turn).toContain("unhex('143f1f8e861fbdeddd5b46e844b7d3ac7b86a122f36e8c463859ee6811b1f29c') in a twocrypto-ng pool");
  });

  it('cuts no contract from any protocol it lists', () => {
    for (const p of new Set(contracts.map((c) => c.protocol).filter((p): p is string => !!p))) {
      const turn = registryTurn(43114, `${p} activity this week`);
      if (!turn.includes(` ${p} is these contracts in our registry`)) continue;
      for (const a of of(p)) expect(turn, p).toContain(a);
    }
  });
});
