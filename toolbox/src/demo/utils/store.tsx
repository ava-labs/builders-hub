import { create } from 'zustand'
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { networkIDs } from "@avalabs/avalanchejs";
import { createCoreWalletClient } from '../../coreViem';
import { useMemo } from 'react';
import { createPublicClient, custom, http } from 'viem';
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
            setL1ID: (L1ID: string) => set({ L1ID }),
            setL1ConversionSignature: (L1ConversionSignature: string) => set({ L1ConversionSignature }),
            setValidatorMessagesLibAddress: (validatorMessagesLibAddress: string) => set({ validatorMessagesLibAddress }),
            setEvmChainName: (evmChainName: string) => set({ evmChainName }),
            setEvmChainRpcUrl: (evmChainRpcUrl: string) => set({ evmChainRpcUrl }),
            setEvmChainCoinName: (evmChainCoinName: string) => set({ evmChainCoinName }),
            setEvmChainIsTestnet: (evmChainIsTestnet: boolean) => set({ evmChainIsTestnet }),
            setValidatorManagerAddress: (validatorManagerAddress: string) => set({ validatorManagerAddress }),
            setProxyAddress: (proxyAddress: string) => set({ proxyAddress }),
            setProxyAdminAddress: (proxyAdminAddress: `0x${string}`) => set({ proxyAdminAddress }),
            setGenesisData: (genesisData: string) => set({ genesisData }),
            setGasLimit: (gasLimit: number) => set({ gasLimit }),
            setTargetBlockRate: (targetBlockRate: number) => set({ targetBlockRate }),
            reset: () => {
                window.localStorage.removeItem('example-storage');
                window.location.reload();
            },
            setEvmChainId: (evmChainId: number) => set({ evmChainId }),
            setTeleporterRegistryAddress: (address: string) => set({ teleporterRegistryAddress: address }),
            setIcmReceiverAddress: (address: string) => set({ icmReceiverAddress: address }),
        })),
        {
            name: 'example-storage',
            storage: createJSONStorage(() => localStorage),
        },
    ),
)


import { avalancheFuji } from 'viem/chains';

export const useWalletStore = create(
    combine({
        coreWalletClient: createCoreWalletClient(zeroAddress) as ReturnType<typeof createCoreWalletClient>,
        publicClient: createPublicClient({
            transport: window.avalanche ? custom(window.avalanche) : http(avalancheFuji.rpcUrls.default.http[0]),//just to calm typescript down
        }) as ReturnType<typeof createPublicClient>,
        walletChainId: 0,
        walletEVMAddress: "",
        avalancheNetworkID: networkIDs.FujiID as typeof networkIDs.FujiID | typeof networkIDs.MainnetID,
        pChainAddress: "",
    }, set => ({
        setCoreWalletClient: (coreWalletClient: ReturnType<typeof createCoreWalletClient>) => set({ coreWalletClient }),
        setWalletChainId: (walletChainId: number) => set({ walletChainId }),
        setWalletEVMAddress: (walletEVMAddress: string) => set({ walletEVMAddress }),
        setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => set({ avalancheNetworkID }),
        setPChainAddress: (pChainAddress: string) => set({ pChainAddress }),
    })),
)


import { useShallow } from 'zustand/react/shallow'
import { zeroAddress } from 'viem';

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

