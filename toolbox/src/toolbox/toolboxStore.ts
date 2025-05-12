import { create } from 'zustand'
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useMemo } from 'react';
import { useWalletStore } from '../lib/walletStore';

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
    logoUrl: string;
};

const l1ListInitialStateFuji = {
    l1List: [
        {
            id: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp",
            name: "Avalanche Fuji",
            rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
            evmChainId: 43113,
            coinName: "AVAX",
            isTestnet: true,
            subnetId: "11111111111111111111111111111111LpoYY",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
        },
        {
            id: "98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp",
            name: "Echo",
            rpcUrl: "https://subnets.avax.network/echo/testnet/rpc",
            evmChainId: 173750,
            coinName: "ECH",
            isTestnet: true,
            subnetId: "i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK",
            validatorManagerAddress: "0x0646263a231b4fde6f62d4de63e18df7e6ad94d6",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/7kyTY75fdtnO6mh7f0osix/4c92c93dd688082bfbb43d5d910cbfeb/Echo_Subnet_Logo.png",
        },
        {
            id: "2D8RG4UpSXbPbvPCAWppNJyqTG2i2CAXSkTgmTBBvs7GKNZjsY",
            name: "Dispatch",
            rpcUrl: "https://subnets.avax.network/dispatch/testnet/rpc",
            evmChainId: 779672,
            coinName: "DISP",
            isTestnet: true,
            subnetId: "7WtoAMPhrmh5KosDUsFL9yTcvw7YSxiKHPpdfs4JsgW47oZT5",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/60XrKdf99PqQKrHiuYdwTE/908622f5204311dbb11be9c6008ead44/Dispatch_Subnet_Logo.png",
        }
    ] as L1ListItem[],
}

const l1ListInitialStateMainnet = {
    l1List: [
        {
            id: "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5",
            name: "Avalanche Mainnet",
            rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
            evmChainId: 43114,
            coinName: "AVAX",
            isTestnet: false,
            subnetId: "11111111111111111111111111111111LpoYY",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
        }
    ] as L1ListItem[],
}
const getL1ListStore = (isTestnet: boolean) => create(
    persist(
        combine(isTestnet ? l1ListInitialStateFuji : l1ListInitialStateMainnet, (set) => ({
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
    exampleErc20Address: "",
    erc20TokenHomeAddress: "",
    erc20TokenRemoteAddress: "",
    nativeTokenRemoteAddress: "",

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
            setExampleErc20Address: (address: string) => set({ exampleErc20Address: address }),
            setErc20TokenHomeAddress: (address: string) => set({ erc20TokenHomeAddress: address }),
            setErc20TokenRemoteAddress: (address: string) => set({ erc20TokenRemoteAddress: address }),
            setNativeTokenRemoteAddress: (address: string) => set({ nativeTokenRemoteAddress: address }),

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


export function useL1ByChainId(chainId: string) {
    const l1ListStore = useL1ListStore();

    return useMemo(() =>
        () => {
            const l1List = l1ListStore.getState().l1List;
            return l1List.find(l1 => l1.id === chainId) || undefined;
        },
        [chainId, l1ListStore]
    );
}

