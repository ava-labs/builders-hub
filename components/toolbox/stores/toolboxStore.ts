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

export const getToolboxStore = (chainId: string) =>
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

export const useToolboxStore = () => {
  const selectedL1 = useSelectedL1();
  const chainId = selectedL1?.id;
  // During bootstrap (no L1 selected), return an inert default state
  // so we never create a store keyed by "".
  if (!chainId) return emptyToolboxState;
  return getToolboxStore(chainId)();
};

export function useViemChainStore() {
  const { walletChainId, isTestnet } = useWalletStore();
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
