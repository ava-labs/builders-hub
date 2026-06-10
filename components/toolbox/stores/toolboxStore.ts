import { create } from 'zustand';
import { persist, createJSONStorage, combine } from 'zustand/middleware';
import { useMemo } from 'react';
import { useWalletStore } from './walletStore';
import { L1ListItem, useSelectedL1 } from './l1ListStore';
import { localStorageComp, STORE_VERSION } from './utils';
import { getL1ListStore } from './l1ListStore';
import { findL1ByEvmChainId } from '@/lib/console/l1-dashboard';

const toolboxInitialState = {
  validatorMessagesLibAddress: '',
  validatorManagerAddress: '',
  rewardCalculatorAddress: '',
  nativeStakingManagerAddress: '',
  erc20StakingManagerAddress: '',
  teleporterRegistryAddress: '',
  icmReceiverAddress: '',
  exampleErc20Address: '',
  erc20TokenHomeAddress: '',
  erc20TokenRemoteAddress: '',
  nativeTokenHomeAddress: '',
  nativeTokenRemoteAddress: '',
  poaManagerAddress: '',
};

// In-memory storage for the bootstrap ('' chainId) store so nothing is
// persisted under an empty key while no L1 is selected.
const noopStateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const createToolboxStore = (chainId: string) =>
  create(
    persist(
      combine(toolboxInitialState, (set, _get) => ({
        setValidatorMessagesLibAddress: (validatorMessagesLibAddress: string) => set({ validatorMessagesLibAddress }),
        setValidatorManagerAddress: (validatorManagerAddress: string) => set({ validatorManagerAddress }),
        setRewardCalculatorAddress: (rewardCalculatorAddress: string) => set({ rewardCalculatorAddress }),
        setNativeStakingManagerAddress: (nativeStakingManagerAddress: string) => set({ nativeStakingManagerAddress }),
        setErc20StakingManagerAddress: (erc20StakingManagerAddress: string) => set({ erc20StakingManagerAddress }),
        setTeleporterRegistryAddress: (address: string) => set({ teleporterRegistryAddress: address }),
        setIcmReceiverAddress: (address: string) => set({ icmReceiverAddress: address }),
        setExampleErc20Address: (address: string) => set({ exampleErc20Address: address }),
        setErc20TokenHomeAddress: (address: string) => set({ erc20TokenHomeAddress: address }),
        setNativeTokenHomeAddress: (address: string) => set({ nativeTokenHomeAddress: address }),
        setErc20TokenRemoteAddress: (address: string) => set({ erc20TokenRemoteAddress: address }),
        setNativeTokenRemoteAddress: (address: string) => set({ nativeTokenRemoteAddress: address }),
        setPoaManagerAddress: (address: string) => set({ poaManagerAddress: address }),

        reset: () => {
          set(toolboxInitialState);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(`${STORE_VERSION}-toolbox-storage-${chainId}`);
          }
        },
      })),
      {
        name: `${STORE_VERSION}-toolbox-storage-${chainId}`,
        storage: createJSONStorage(chainId ? localStorageComp : () => noopStateStorage),
      },
    ),
  );

// One store instance per chain id. getToolboxStore used to call zustand's
// create() on EVERY invocation, so components calling it during render
// subscribed to a brand-new store (and re-ran persist rehydration) each
// render, and imperative callers (e.g. stores/reset.ts) mutated throwaway
// instances that live components never observed.
const toolboxStores = new Map<string, ReturnType<typeof createToolboxStore>>();

export const getToolboxStore = (chainId: string) => {
  let store = toolboxStores.get(chainId);
  if (!store) {
    store = createToolboxStore(chainId);
    toolboxStores.set(chainId, store);
  }
  return store;
};

export const useToolboxStore = () => {
  const selectedL1 = useSelectedL1();
  // Rules of Hooks: always subscribe to a store. During bootstrap (no L1
  // selected yet) this is an inert, non-persisted store keyed by ''.
  // The previous version returned early without calling the store hook,
  // so the hook count changed when selectedL1 resolved mid-hydration and
  // React crashed with a hook-order error (#4284).
  return getToolboxStore(selectedL1?.id ?? '')();
};

export function useViemChainStore() {
  // Granular selectors keep this derived chain stable across unrelated
  // wallet-store writes. A full-store destructure re-fired this hook on
  // every wallet field mutation (including the mid-`switchChainOrAdd`
  // bookkeeping writes), which propagated through `useContractDeployer`
  // and other consumers and created transient inconsistent-chain renders.
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const testnetL1List = getL1ListStore(true)(({ l1List }: { l1List: L1ListItem[] }) => l1List);
  const mainnetL1List = getL1ListStore(false)(({ l1List }: { l1List: L1ListItem[] }) => l1List);
  const selectedL1 = useMemo(() => {
    const activeFirstLists = isTestnet ? [testnetL1List, mainnetL1List] : [mainnetL1List, testnetL1List];
    return findL1ByEvmChainId(walletChainId, activeFirstLists);
  }, [isTestnet, mainnetL1List, testnetL1List, walletChainId]);

  const viemChain = useMemo(() => {
    if (!selectedL1) {
      return null;
    }

    const nameToUse = selectedL1.name || `Chain #${selectedL1.evmChainId}`;

    return {
      id: selectedL1.evmChainId,
      name: nameToUse,
      rpcUrls: {
        default: { http: [selectedL1.rpcUrl] },
      },
      nativeCurrency: {
        name: selectedL1.coinName,
        symbol: selectedL1.coinName,
        decimals: 18,
      },
      isTestnet: selectedL1.isTestnet,
    };
  }, [selectedL1]);

  return viemChain;
}
