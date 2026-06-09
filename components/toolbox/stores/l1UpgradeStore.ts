import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

const l1UpgradeInitialState = {
  subnetId: '',
  blockchainId: '',
  rpcUrl: '',
  chainName: '',
  isManaged: false,
  managedNodeCount: 0,
};

type L1UpgradeState = typeof l1UpgradeInitialState & {
  setSelection: (selection: Partial<typeof l1UpgradeInitialState>) => void;
  reset: () => void;
};

const { getStore: getL1UpgradeStore, useStoreApi: useL1UpgradeStore } = createFlowStore<L1UpgradeState>({
  name: 'l1-upgrade-store',
  storeCreator: (set, isTestnet) => ({
    ...l1UpgradeInitialState,
    setSelection: (selection) =>
      set((state) => {
        const hasChanges = Object.entries(selection).some(
          ([key, value]) => state[key as keyof typeof l1UpgradeInitialState] !== value,
        );
        return hasChanges ? { ...state, ...selection } : state;
      }),
    reset: () => {
      set(l1UpgradeInitialState);
      window?.localStorage.removeItem(`${STORE_VERSION}-l1-upgrade-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
});

export { getL1UpgradeStore, useL1UpgradeStore };
