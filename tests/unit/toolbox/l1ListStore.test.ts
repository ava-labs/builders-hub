import { afterEach, describe, expect, it } from 'vitest';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';

const seed: L1ListItem = {
  id: 'test-blockchain-id',
  name: 'Test L1',
  rpcUrl: 'https://example.test/rpc',
  evmChainId: 999_999,
  coinName: 'TEST',
  // Wrong on purpose — exercises the consistency guard.
  isTestnet: false,
  subnetId: 'test-subnet-id',
  wrappedTokenAddress: '',
  validatorManagerAddress: '',
  logoUrl: '',
};

describe('l1ListStore.addL1 isTestnet invariant', () => {
  afterEach(() => {
    // Drop entries we appended so suite re-runs are clean.
    const testnet = getL1ListStore(true);
    testnet.setState((s: { l1List: L1ListItem[] }) => ({
      l1List: s.l1List.filter((l) => l.id !== seed.id),
    }));
    const mainnet = getL1ListStore(false);
    mainnet.setState((s: { l1List: L1ListItem[] }) => ({
      l1List: s.l1List.filter((l) => l.id !== seed.id),
    }));
  });

  it('forces isTestnet=true when adding to the testnet store, even if caller passed false', () => {
    const store = getL1ListStore(true);
    store.getState().addL1(seed);
    const added = store.getState().l1List.find((l: L1ListItem) => l.id === seed.id);
    expect(added).toBeDefined();
    expect(added!.isTestnet).toBe(true);
  });

  it('forces isTestnet=false when adding to the mainnet store, even if caller passed true', () => {
    const store = getL1ListStore(false);
    store.getState().addL1({ ...seed, isTestnet: true });
    const added = store.getState().l1List.find((l: L1ListItem) => l.id === seed.id);
    expect(added).toBeDefined();
    expect(added!.isTestnet).toBe(false);
  });
});

describe('l1ListStore — genesisData field', () => {
  const genesisSeedWith: L1ListItem = {
    id: 'genesis-test-id-1',
    name: 'Test L1 With Genesis',
    rpcUrl: 'https://example/rpc',
    evmChainId: 9_999_011,
    coinName: 'TST',
    isTestnet: true,
    subnetId: 'sub-genesis-1',
    wrappedTokenAddress: '',
    validatorManagerAddress: '',
    logoUrl: '',
    genesisData: '{"config":{"chainId":9999011}}',
  };
  const genesisSeedWithout: L1ListItem = {
    id: 'genesis-test-id-2',
    name: 'Older L1 No Genesis',
    rpcUrl: 'https://example/rpc2',
    evmChainId: 9_999_012,
    coinName: 'TST2',
    isTestnet: true,
    subnetId: 'sub-genesis-2',
    wrappedTokenAddress: '',
    validatorManagerAddress: '',
    logoUrl: '',
  };

  afterEach(() => {
    const testnet = getL1ListStore(true);
    testnet.setState((s: { l1List: L1ListItem[] }) => ({
      l1List: s.l1List.filter((l) => l.id !== genesisSeedWith.id && l.id !== genesisSeedWithout.id),
    }));
  });

  it('persists genesisData when an L1 is added', () => {
    const store = getL1ListStore(true);
    store.getState().addL1(genesisSeedWith);
    const persisted = store
      .getState()
      .l1List.find((l: L1ListItem) => l.id === genesisSeedWith.id);
    expect(persisted?.genesisData).toBe('{"config":{"chainId":9999011}}');
  });

  it('treats missing genesisData as undefined (back-compat)', () => {
    const store = getL1ListStore(true);
    store.getState().addL1(genesisSeedWithout);
    const persisted = store
      .getState()
      .l1List.find((l: L1ListItem) => l.id === genesisSeedWithout.id);
    expect(persisted?.genesisData).toBeUndefined();
  });
});
