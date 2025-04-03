import { create } from 'zustand'
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useMemo } from 'react';

export const initialState = {
    subnetID: "",
    chainName: "My Chain",
    vmId: "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy",
    chainID: "",
    nodePopJsons: [""] as string[],
    validatorWeights: Array(100).fill(100) as number[],
    managerAddress: "0xfacade0000000000000000000000000000000000",
    L1ID: "",
    L1ConversionSignature: "",
    validatorMessagesLibAddress: "",
    evmChainName: "My L1",
    evmChainRpcUrl: "",
    nodeRpcUrl: "",
    evmChainId: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
    evmChainCoinName: "COIN",
    evmChainIsTestnet: true,
    validatorManagerAddress: "",
    proxyAddress: "0xfacade0000000000000000000000000000000000",
    proxyAdminAddress: "0xdad0000000000000000000000000000000000000" as `0x${string}`,
    genesisData: "",
    teleporterRegistryAddress: "",
    gasLimit: 12000000,
    targetBlockRate: 2,
    icmReceiverAddress: "",
    stakingManagerAddress: "",
    rewardCalculatorAddress: "",
}

export const useToolboxStore = create(
    persist(
        combine(initialState, (set) => ({
            setSubnetID: (subnetID: string) => set({ subnetID }),
            setChainName: (chainName: string) => set({ chainName }),
            setVmId: (vmId: string) => set({ vmId }),
            setChainID: (chainID: string) => set({ chainID }),
            setNodePopJsons: (nodePopJsons: string[]) => set({ nodePopJsons }),
            setValidatorWeights: (validatorWeights: number[]) => set({ validatorWeights }),
            setManagerAddress: (managerAddress: string) => set({ managerAddress }),
            setStakingManagerAddress: (stakingManagerAddress: string) => set({ stakingManagerAddress }),
            setRewardCalculatorAddress: (rewardCalculatorAddress: string) => set({ rewardCalculatorAddress }),
            setL1ID: (L1ID: string) => set({ L1ID }),
            setL1ConversionSignature: (L1ConversionSignature: string) => set({ L1ConversionSignature }),
            setValidatorMessagesLibAddress: (validatorMessagesLibAddress: string) => set({ validatorMessagesLibAddress }),
            setEvmChainName: (evmChainName: string) => set({ evmChainName }),
            setEvmChainRpcUrl: (evmChainRpcUrl: string) => set({ evmChainRpcUrl }),
            setNodeRpcUrl: (nodeRpcUrl: string) => set({ nodeRpcUrl }),
            setEvmChainCoinName: (evmChainCoinName: string) => set({ evmChainCoinName }),
            setEvmChainIsTestnet: (evmChainIsTestnet: boolean) => set({ evmChainIsTestnet }),
            setValidatorManagerAddress: (validatorManagerAddress: string) => set({ validatorManagerAddress }),
            setProxyAddress: (proxyAddress: string) => set({ proxyAddress }),
            setProxyAdminAddress: (proxyAdminAddress: `0x${string}`) => set({ proxyAdminAddress }),
            setGenesisData: (genesisData: string) => set({ genesisData }),
            setGasLimit: (gasLimit: number) => set({ gasLimit }),
            setTargetBlockRate: (targetBlockRate: number) => set({ targetBlockRate }),
            reset: () => {
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem('example-storage');
                    window.location.reload();
                }
            },
            setEvmChainId: (evmChainId: number) => set({ evmChainId }),
            setTeleporterRegistryAddress: (address: string) => set({ teleporterRegistryAddress: address }),
            setIcmReceiverAddress: (address: string) => set({ icmReceiverAddress: address }),
        })),
        {
            name: 'toolbox-storage',
            storage: createJSONStorage(() => typeof window !== 'undefined' ? localStorage : {
                getItem: () => null,
                setItem: () => { },
                removeItem: () => { }
            }),
        },
    ),
)

import { useShallow } from 'zustand/react/shallow'

export function useViemChainStore() {
    // Use useShallow to select the primitive state values we need
    const chainData = useToolboxStore(
        useShallow((state) => ({
            evmChainId: state.evmChainId,
            evmChainName: state.evmChainName,
            evmChainRpcUrl: state.evmChainRpcUrl,
            evmChainCoinName: state.evmChainCoinName,
            evmChainIsTestnet: state.evmChainIsTestnet
        }))
    );

    // Create the viemChain object with useMemo to prevent unnecessary recreation
    const viemChain = useMemo(() => {
        const { evmChainId, evmChainName, evmChainRpcUrl, evmChainCoinName, evmChainIsTestnet } = chainData;

        if (!evmChainId || !evmChainRpcUrl) {
            return null;
        }

        return {
            id: evmChainId,
            name: evmChainName || `Chain #${evmChainId}`,
            rpcUrls: {
                default: { http: [evmChainRpcUrl] },
            },
            nativeCurrency: {
                name: evmChainCoinName || evmChainName + " Coin",
                symbol: evmChainCoinName || evmChainName + " Coin",
                decimals: 18
            },
            isTestnet: evmChainIsTestnet,
        };
    }, [chainData]);

    return viemChain;
}

