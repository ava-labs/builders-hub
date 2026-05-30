import { describe, expect, it } from 'vitest';
import {
  parseGenesisEvmChainId,
  resolveCreateL1RequiredChain,
  type CreateL1ChainStateLike,
} from '@/lib/console/create-l1-chain';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

const makeL1 = (overrides: Partial<L1ListItem> = {}): L1ListItem => ({
  id: 'blockchain-89184',
  name: 'Sudden Catastrophe Chain',
  rpcUrl: 'https://example.test/rpc',
  evmChainId: 89_184,
  coinName: 'TEST',
  isTestnet: true,
  subnetId: 'subnet-1',
  wrappedTokenAddress: '',
  validatorManagerAddress: '',
  logoUrl: '',
  ...overrides,
});

const makeCreateChain = (overrides: Partial<CreateL1ChainStateLike> = {}): CreateL1ChainStateLike => ({
  chainID: 'blockchain-89184',
  chainName: 'Sudden Catastrophe Chain',
  genesisData: '{"config":{"chainId":89184}}',
  evmChainId: 797_666,
  ...overrides,
});

describe('parseGenesisEvmChainId', () => {
  it('reads numeric and hex chain IDs from genesis config', () => {
    expect(parseGenesisEvmChainId('{"config":{"chainId":89184}}')).toBe(89_184);
    expect(parseGenesisEvmChainId('{"config":{"chainId":"0x15c60"}}')).toBe(89_184);
  });

  it('returns null for invalid or missing genesis chain IDs', () => {
    expect(parseGenesisEvmChainId('{"config":{}}')).toBeNull();
    expect(parseGenesisEvmChainId('Error: invalid genesis')).toBeNull();
    expect(parseGenesisEvmChainId('not json')).toBeNull();
  });
});

describe('resolveCreateL1RequiredChain', () => {
  it('prefers an exact created blockchain ID match from the L1 list', () => {
    const resolved = resolveCreateL1RequiredChain({
      createChain: makeCreateChain({ genesisData: '{"config":{"chainId":12345}}' }),
      l1List: [makeL1()],
    });

    expect(resolved.chainId).toBe(89_184);
    expect(resolved.chainLabel).toBe('Sudden Catastrophe Chain');
    expect(resolved.source).toBe('l1-list');
  });

  it('uses genesis chainId when the L1 list does not have the created chain yet', () => {
    const resolved = resolveCreateL1RequiredChain({
      createChain: makeCreateChain(),
      l1List: [],
    });

    expect(resolved.chainId).toBe(89_184);
    expect(resolved.chainLabel).toBe('Sudden Catastrophe Chain');
    expect(resolved.source).toBe('genesis');
  });

  it('falls back to createChainStore evmChainId for legacy or custom-VM flows', () => {
    const resolved = resolveCreateL1RequiredChain({
      createChain: makeCreateChain({ chainID: 'unknown-blockchain', genesisData: '{"config":{}}' }),
      l1List: [makeL1()],
    });

    expect(resolved.chainId).toBe(797_666);
    expect(resolved.source).toBe('create-store');
  });

  it('returns a missing result when no source can provide a chain ID', () => {
    const resolved = resolveCreateL1RequiredChain({
      createChain: { chainName: 'Untitled L1' },
      l1List: [],
    });

    expect(resolved.chainId).toBeNull();
    expect(resolved.chainLabel).toBe('Untitled L1');
    expect(resolved.source).toBe('missing');
  });
});
