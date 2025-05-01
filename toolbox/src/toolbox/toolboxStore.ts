import { create } from 'zustand'
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useMemo } from 'react';
import { useWalletStore } from '../lib/walletStore';

export type DeployOn = "L1" | "C-Chain";

const localStorageComp = () => typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => { }, removeItem: () => { } }

export const EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"

const createChainInitialState = {
    subnetId: "",
    vmId: EVM_VM_ID,
    chainID: "",
    chainName: "My Chain",
    managerAddress: "0xfacade0000000000000000000000000000000000",
    genesisData: "",
    targetBlockRate: 2,
    gasLimit: 12000000,
    evmChainId: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
    convertToL1TxId: "",
    validatorWeights: Array(100).fill(100) as number[],
    nodePopJsons: [""] as string[],
}

const getCreateChainStore = (isTestnet: boolean) => create(
    persist(
        combine(createChainInitialState, (set) => ({
            setSubnetID: (subnetId: string) => set({ subnetId }),
            setChainName: (chainName: string) => set({ chainName }),
            setVmId: (vmId: string) => set({ vmId }),
            setChainID: (chainID: string) => set({ chainID }),
            setManagerAddress: (managerAddress: string) => set({ managerAddress }),
            setGenesisData: (genesisData: string) => set({ genesisData }),
            setTargetBlockRate: (targetBlockRate: number) => set({ targetBlockRate }),
            setGasLimit: (gasLimit: number) => set({ gasLimit }),
            setEvmChainId: (evmChainId: number) => set({ evmChainId }),
            setConvertToL1TxId: (convertToL1TxId: string) => set({ convertToL1TxId }),
            setValidatorWeights: (validatorWeights: number[]) => set({ validatorWeights }),
            setNodePopJsons: (nodePopJsons: string[]) => set({ nodePopJsons }),

            reset: () => {
                window?.localStorage.removeItem(`create-chain-store-${isTestnet ? 'testnet' : 'mainnet'}`);
            },
        })),
        {
            name: `create-chain-store-${isTestnet ? 'testnet' : 'mainnet'}`,
            storage: createJSONStorage(localStorageComp),
        },
    ),
)

export const useCreateChainStore = () => {
    const { isTestnet } = useWalletStore();
    return getCreateChainStore(Boolean(isTestnet))
}

type L1ListItem = {
    id: string;
    name: string;
    rpcUrl: string;
    evmChainId: number;
    coinName: string;
    isTestnet: boolean;
    subnetId: string;
    validatorManagerAddress: string;
};

const l1ListInitialState = {
    l1List: [] as L1ListItem[],
}

const getL1ListStore = (isTestnet: boolean) => create(
    persist(
        combine(l1ListInitialState, (set) => ({
            addL1: (l1: L1ListItem) => set((state) => ({ l1List: [...state.l1List, l1] })),
            removeL1: (l1Id: string) => set((state) => ({ l1List: state.l1List.filter((l) => l.id !== l1Id) })),
            reset: () => {
                window?.localStorage.removeItem(`l1-list-store-${isTestnet ? 'testnet' : 'mainnet'}`);
            },
        })),
        {
            name: `l1-list-store-${isTestnet ? 'testnet' : 'mainnet'}`,
            storage: createJSONStorage(localStorageComp),
        },
    ),
)

export const useL1ListStore = () => {
    const { isTestnet } = useWalletStore();
    return getL1ListStore(Boolean(isTestnet));
}

const toolboxInitialState = {
    //verified state
    validatorMessagesLibAddress: "",
    validatorManagerAddress: "",
    rewardCalculatorAddress: "",
    stakingManagerAddress: "",
    teleporterRegistryAddress: "",
    icmReceiverAddress: "",
    exampleErc20Address: { "L1": "", "C-Chain": "" } as { L1: string, "C-Chain": string },
    erc20TokenHomeAddress: { "L1": "", "C-Chain": "" } as { L1: string, "C-Chain": string },
    erc20TokenRemoteAddress: { "L1": "", "C-Chain": "" } as { L1: string, "C-Chain": string },
    nativeTokenRemoteAddress: { "L1": "", "C-Chain": "" } as { L1: string, "C-Chain": string },

    //unverifyed state - remove after testing
    // nodeRpcUrl: "",
    // evmChainCoinName: "COIN",
    // evmChainIsTestnet: true,
}

export const getToolboxStore = (chainId: string) => create(
    persist(
        combine(toolboxInitialState, (set) => ({
            //verified methods
            setValidatorMessagesLibAddress: (validatorMessagesLibAddress: string) => set({ validatorMessagesLibAddress }),
            setValidatorManagerAddress: (validatorManagerAddress: string) => set({ validatorManagerAddress }),
            setRewardCalculatorAddress: (rewardCalculatorAddress: string) => set({ rewardCalculatorAddress }),
            setStakingManagerAddress: (stakingManagerAddress: string) => set({ stakingManagerAddress }),
            setTeleporterRegistryAddress: (address: string) => set({ teleporterRegistryAddress: address }),
            setIcmReceiverAddress: (address: string) => set({ icmReceiverAddress: address }),
            setExampleErc20Address: (address: string, deployOn: DeployOn) => set((state) => ({ exampleErc20Address: { ...state.exampleErc20Address, [deployOn]: address } })),
            setErc20TokenHomeAddress: (address: string, deployOn: DeployOn) => set((state) => ({ erc20TokenHomeAddress: { ...state.erc20TokenHomeAddress, [deployOn]: address } })),
            setErc20TokenRemoteAddress: (address: string, deployOn: DeployOn) => set((state) => ({ erc20TokenRemoteAddress: { ...state.erc20TokenRemoteAddress, [deployOn]: address } })),
            setNativeTokenRemoteAddress: (address: string, deployOn: DeployOn) => set((state) => ({ nativeTokenRemoteAddress: { ...state.nativeTokenRemoteAddress, [deployOn]: address } })),

            //unverified methods - remove after testing
            // setNodeRpcUrl: (nodeRpcUrl: string) => set({ nodeRpcUrl }),
            // setEvmChainCoinName: (evmChainCoinName: string) => set({ evmChainCoinName }),
            // setEvmChainIsTestnet: (evmChainIsTestnet: boolean) => set({ evmChainIsTestnet }),


            reset: () => {
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(`toolbox-storage-${chainId}`);
                }
            },
        })),
        {
            name: `toolbox-storage-${chainId}`,
            storage: createJSONStorage(localStorageComp),
        },
    ),
)

export const useToolboxStore = () => {
    const selectedL1 = useSelectedL1()();
    return getToolboxStore(selectedL1?.id || "")();
}

export function resetAllStores() {
    const { isTestnet } = useWalletStore.getState();

    if (typeof isTestnet !== "boolean") {
        console.warn("isTestnet is undefined during reset. Resetting both testnet and mainnet stores.");
        getCreateChainStore(true).getState().reset();
        getCreateChainStore(false).getState().reset();
        getL1ListStore(true).getState().reset();
        getL1ListStore(false).getState().reset();
    } else {
        getCreateChainStore(isTestnet).getState().reset();
        getL1ListStore(isTestnet).getState().reset();
    }

    const testnetChains = getL1ListStore(true).getState().l1List.map((l1) => l1.id);
    const mainnetChains = getL1ListStore(false).getState().l1List.map((l1) => l1.id);
    const allChainIds = [...new Set([...testnetChains, ...mainnetChains])];

    allChainIds.forEach((chainId) => {
        getToolboxStore(chainId).getState().reset();
    });

    window?.location.reload();
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

export function useSelectedL1() {
    const { walletChainId } = useWalletStore();
    const l1ListStore = useL1ListStore();

    return useMemo(() =>
        () => {
            const l1List = l1ListStore.getState().l1List;
            return l1List.find(l1 => l1.evmChainId === walletChainId) || undefined;
        },
        [walletChainId, l1ListStore]
    );
}

