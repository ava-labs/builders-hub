import { describe, expect, it } from 'vitest';
import { patchL1ByEvmChainId } from './l1ListPatch';
import type { L1ListItem } from './l1ListStore';

function item(evmChainId: number, rpcUrl: string): L1ListItem {
  return {
    id: `chain-${evmChainId}`,
    name: `Chain ${evmChainId}`,
    rpcUrl,
    evmChainId,
    coinName: 'AVAX',
    isTestnet: true,
    subnetId: 'subnet',
    wrappedTokenAddress: '0xwrapped',
    validatorManagerAddress: '0xmanager',
    logoUrl: '',
  };
}

describe('patchL1ByEvmChainId', () => {
  it('patches only the target entry and preserves enrichment fields', () => {
    const list = [item(1, 'http://localhost:9650/a'), item(2, 'http://localhost:9650/b')];
    const result = patchL1ByEvmChainId(list, 2, { rpcUrl: 'https://ip.nip.io/b' });

    expect(result[0]).toBe(list[0]);
    expect(result[1].rpcUrl).toBe('https://ip.nip.io/b');
    expect(result[1].wrappedTokenAddress).toBe('0xwrapped');
    expect(result[1].validatorManagerAddress).toBe('0xmanager');
  });

  it('does not mutate the input', () => {
    const list = [item(1, 'http://localhost:9650/a')];
    const snapshot = JSON.parse(JSON.stringify(list));
    patchL1ByEvmChainId(list, 1, { rpcUrl: 'https://ip.nip.io/a' });
    expect(list).toEqual(snapshot);
  });

  it('returns the original array when the chain is absent', () => {
    const list = [item(1, 'http://localhost:9650/a')];
    expect(patchL1ByEvmChainId(list, 99, { rpcUrl: 'x' })).toBe(list);
  });

  it('cannot change identity keys even if they sneak into the patch', () => {
    const list = [item(1, 'http://localhost:9650/a')];
    const result = patchL1ByEvmChainId(list, 1, {
      rpcUrl: 'https://ip.nip.io/a',
      evmChainId: 999,
      id: 'hijacked',
      isTestnet: false,
    } as never);
    expect(result[0].evmChainId).toBe(1);
    expect(result[0].id).toBe('chain-1');
    expect(result[0].isTestnet).toBe(true);
  });
});
