import { create } from 'zustand'
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useMemo } from 'react';
import { useWalletStore } from './walletStore';
import { useSelectedL1 } from './l1ListStore';
import { localStorageComp, STORE_VERSION } from './utils';
import { useL1ListStore } from './l1ListStore';


const toolboxInitialState = {
    validatorMessagesLibAddress: "",
    validatorManagerAddress: "",
    rewardCalculatorAddress: "",
    stakingManagerAddress: "",
    teleporterRegistryAddress: "",
    icmReceiverAddress: "",
    exampleErc20Address: "",
    erc20TokenHomeAddress: "",
    erc20TokenRemoteAddress: "",
    nativeTokenHomeAddress: "",
    nativeTokenRemoteAddress: "",
    poaManagerAddress: "",
}


export const getToolboxStore = (chainId: string) => create(
    persist(
        combine(toolboxInitialState, (set) => ({
            setValidatorMessagesLibAddress: (validatorMessagesLibAddress: string) => set({ validatorMessagesLibAddress }),
            setValidatorManagerAddress: (validatorManagerAddress: string) => set({ validatorManagerAddress }),
            setRewardCalculatorAddress: (rewardCalculatorAddress: string) => set({ rewardCalculatorAddress }),
            setStakingManagerAddress: (stakingManagerAddress: string) => set({ stakingManagerAddress }),
            setTeleporterRegistryAddress: (address: string) => set({ teleporterRegistryAddress: address }),
            setIcmReceiverAddress: (address: string) => set({ icmReceiverAddress: address }),
            setExampleErc20Address: (address: string) => set({ exampleErc20Address: address }),
            setErc20TokenHomeAddress: (address: string) => set({ erc20TokenHomeAddress: address }),
            setNativeTokenHomeAddress: (address: string) => set({ nativeTokenHomeAddress: address }),
            setErc20TokenRemoteAddress: (address: string) => set({ erc20TokenRemoteAddress: address }),
            setNativeTokenRemoteAddress: (address: string) => set({ nativeTokenRemoteAddress: address }),
            setPoaManagerAddress: (address: string) => set({ poaManagerAddress: address }),

            reset: () => {
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
)

export const useToolboxStore = () => {
    const selectedL1 = useSelectedL1()();
    return getToolboxStore(selectedL1?.id || "")();
}

export function useViemChainStore() {
    const { walletChainId } = useWalletStore();
    const l1List = useL1ListStore()(state => state.l1List);
    const selectedL1 = useMemo(() => l1List.find(l1 => l1.evmChainId === walletChainId), [l1List, walletChainId]);

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
                decimals: 18
            },
            isTestnet: selectedL1.isTestnet,
        };
    }, [selectedL1]);

    return viemChain;
}
