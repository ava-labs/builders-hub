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
        storage: createJSONStorage(localStorageComp),
      },
    ),
  );

// Singleton store per chain, mirroring getL1ListStore. Creating a fresh
// store (and persist subscription) on every call re-subscribed components
// each render and made hook identity unstable for anything keyed off it.
const toolboxStoreSingletons = new Map<string, ReturnType<typeof createToolboxStore>>();

export const getToolboxStore = (chainId: string) => {
  let store = toolboxStoreSingletons.get(chainId);
  if (!store) {
    store = createToolboxStore(chainId);
    toolboxStoreSingletons.set(chainId, store);
  }
  return store;
};

const noopSetter = () => {};

const emptyToolboxState = {
  ...toolboxInitialState,
  setValidatorMessagesLibAddress: noopSetter,
  setValidatorManagerAddress: noopSetter,
  setRewardCalculatorAddress: noopSetter,
  setNativeStakingManagerAddress: noopSetter,
  setErc20StakingManagerAddress: noopSetter,
  setTeleporterRegistryAddress: noopSetter,
  setIcmReceiverAddress: noopSetter,
  setExampleErc20Address: noopSetter,
  setErc20TokenHomeAddress: noopSetter,
  setNativeTokenHomeAddress: noopSetter,
  setErc20TokenRemoteAddress: noopSetter,
  setNativeTokenRemoteAddress: noopSetter,
  setPoaManagerAddress: noopSetter,
  reset: noopSetter,
};

// Sentinel store key for "no chain selected (yet)". The store hook must be
// called unconditionally — an early return that skips it means that when
// the wallet connects (or a selection is made) while a component is
// mounted, the extra subscription shifts React's hook order and crashes
// the component (Rules of Hooks). The sentinel store is never written to,
// so it never touches localStorage. Callers selecting from a maybe-empty
// chain id should use `getToolboxStore(id || NO_CHAIN_SELECTED)` and
// discard the result when the id is empty.
export const NO_CHAIN_SELECTED = '__no-chain-selected__';

export const useToolboxStore = () => {
  const selectedL1 = useSelectedL1();
  const chainId = selectedL1?.id;
  const state = getToolboxStore(chainId ?? NO_CHAIN_SELECTED)();
  // During bootstrap, expose inert state (noop setters) instead.
  if (!chainId) return emptyToolboxState;
  return state;
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
