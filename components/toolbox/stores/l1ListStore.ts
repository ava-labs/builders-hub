import { create } from "zustand";
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useWalletStore } from "./walletStore";
import { localStorageComp, STORE_VERSION } from "./utils";
import { useMemo } from "react";

export type L1ListItem = {
    id: string;
    name: string;
    description?: string;
    rpcUrl: string;
    evmChainId: number;
    coinName: string;
    isTestnet: boolean;
    subnetId: string;
    wrappedTokenAddress: string;
    validatorManagerAddress: string;
    logoUrl: string;
    wellKnownTeleporterRegistryAddress?: string;
    externalFaucetUrl?: string;
    explorerUrl?: string;
    hasBuilderHubFaucet?: boolean;
    dripAmount?: number;
    features?: string[];
    // Native currency cache - extended info beyond just coinName
    nativeCurrency?: {
        name: string;
        symbol: string;
        decimals: number;
    };
};

const l1ListInitialStateFuji = {
    l1List: [
        {
            id: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp",
            name: "C-Chain",
            description: "Smart contract development blockchain",
            rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
            evmChainId: 43113,
            coinName: "AVAX",
            isTestnet: true,
            subnetId: "11111111111111111111111111111111LpoYY",
            wrappedTokenAddress: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
            wellKnownTeleporterRegistryAddress: "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228",
            hasBuilderHubFaucet: true,
            externalFaucetUrl: "https://core.app/tools/testnet-faucet",
            explorerUrl: "https://subnets-test.avax.network/c-chain",
            dripAmount: 1,
            features: [
                "EVM-compatible blockchain",
                "Deploy smart contracts"
            ]
        },
        {
            id: "98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp",
            name: "Echo",
            description: "Echo is a Testnet L1 for testing dApps utilizing ICM",
            rpcUrl: "https://subnets.avax.network/echo/testnet/rpc",
            evmChainId: 173750,
            coinName: "ECH",
            isTestnet: true,
            subnetId: "i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK",
            wrappedTokenAddress: "0xc85a1b7876eabbacf1d6551c58e0759788cf8d02",
            validatorManagerAddress: "0x0646263a231b4fde6f62d4de63e18df7e6ad94d6",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/7kyTY75fdtnO6mh7f0osix/4c92c93dd688082bfbb43d5d910cbfeb/Echo_Subnet_Logo.png",
            wellKnownTeleporterRegistryAddress: "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228",
            hasBuilderHubFaucet: true,
            externalFaucetUrl: "https://core.app/tools/testnet-faucet",
            explorerUrl: "https://subnets-test.avax.network/echo",
            dripAmount: 2,
            features: [
                "EVM-compatible L1 chain",
                "Deploy dApps & test interoperability with Echo"
            ]
        },
        {
            id: "2D8RG4UpSXbPbvPCAWppNJyqTG2i2CAXSkTgmTBBvs7GKNZjsY",
            name: "Dispatch",
            description: "Dispatch is a Testnet L1 for testing dApps utilizing ICM",
            rpcUrl: "https://subnets.avax.network/dispatch/testnet/rpc",
            evmChainId: 779672,
            coinName: "DIS",
            isTestnet: true,
            subnetId: "7WtoAMPhrmh5KosDUsFL9yTcvw7YSxiKHPpdfs4JsgW47oZT5",
            wrappedTokenAddress: "0x8d4dfb65e48a464d6fca2b297776da77e01db34b",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/60XrKdf99PqQKrHiuYdwTE/908622f5204311dbb11be9c6008ead44/Dispatch_Subnet_Logo.png",
            wellKnownTeleporterRegistryAddress: "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228",
            hasBuilderHubFaucet: true,
            externalFaucetUrl: "https://core.app/tools/testnet-faucet",
            explorerUrl: "https://subnets-test.avax.network/dispatch",
            dripAmount: 2,
            features: [
                "EVM-compatible L1 chain",
                "Deploy dApps & test interoperability with Dispatch"
            ]
        }
    ] as L1ListItem[],
}

const l1ListInitialStateMainnet = {
    l1List: [
        {
            id: "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5",
            name: "C-Chain",
            description: "The C-Chain of the Mainnet is the EVM chain of the Primary Network.",
            rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
            evmChainId: 43114,
            coinName: "AVAX",
            isTestnet: false,
            subnetId: "11111111111111111111111111111111LpoYY",
            wrappedTokenAddress: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
            wellKnownTeleporterRegistryAddress: "0x7C43605E14F391720e1b37E49C78C4b03A488d98",
            hasBuilderHubFaucet: false,
            explorerUrl: "https://subnets.avax.network/c-chain"
        }
    ] as L1ListItem[],
}

const defaultChainIds = [
    ...l1ListInitialStateFuji.l1List.map((l1) => l1.id),
    ...l1ListInitialStateMainnet.l1List.map((l1) => l1.id),
]
export const isDefaultChain = (chainId: string) => defaultChainIds.includes(chainId)


// Ensure singleton stores per network to keep state in sync across components
let testnetStoreSingleton: any | null = null;
let mainnetStoreSingleton: any | null = null;

export const getL1ListStore = (isTestnet: boolean) => {
    if (isTestnet) {
        if (!testnetStoreSingleton) {
            testnetStoreSingleton = create(
                persist(
                    combine(l1ListInitialStateFuji, (set, get) => ({
                        addL1: (l1: L1ListItem) => set((state) => ({ l1List: [...state.l1List, l1] })),
                        removeL1: (l1Id: string) => set((state) => ({ l1List: state.l1List.filter((l) => l.id !== l1Id) })),
                        setNativeCurrencyInfo: (chainId: number, info: { name: string; symbol: string; decimals: number }) => {
                            set((state) => ({
                                l1List: state.l1List.map((l1) =>
                                    l1.evmChainId === chainId
                                        ? { ...l1, nativeCurrency: info }
                                        : l1
                                )
                            }));
                        },
                        getNativeCurrencyInfo: (chainId: number) => {
                            const l1 = get().l1List.find((l1) => l1.evmChainId === chainId);
                            return l1?.nativeCurrency;
                        },
                        reset: () => {
                            window?.localStorage.removeItem(`${STORE_VERSION}-l1-list-store-testnet`);
                        },
                    })),
                    {
                        name: `${STORE_VERSION}-l1-list-store-testnet`,
                        storage: createJSONStorage(localStorageComp),
                    },
                ),
            );
        }
        return testnetStoreSingleton;
    } else {
        if (!mainnetStoreSingleton) {
            mainnetStoreSingleton = create(
                persist(
                    combine(l1ListInitialStateMainnet, (set, get) => ({
                        addL1: (l1: L1ListItem) => set((state) => ({ l1List: [...state.l1List, l1] })),
                        removeL1: (l1Id: string) => set((state) => ({ l1List: state.l1List.filter((l) => l.id !== l1Id) })),
                        setNativeCurrencyInfo: (chainId: number, info: { name: string; symbol: string; decimals: number }) => {
                            set((state) => ({
                                l1List: state.l1List.map((l1) =>
                                    l1.evmChainId === chainId
                                        ? { ...l1, nativeCurrency: info }
                                        : l1
                                )
                            }));
                        },
                        getNativeCurrencyInfo: (chainId: number) => {
                            const l1 = get().l1List.find((l1) => l1.evmChainId === chainId);
                            return l1?.nativeCurrency;
                        },
                        reset: () => {
                            window?.localStorage.removeItem(`${STORE_VERSION}-l1-list-store-mainnet`);
                        },
                    })),
                    {
                        name: `${STORE_VERSION}-l1-list-store-mainnet`,
                        storage: createJSONStorage(localStorageComp),
                    },
                ),
            );
        }
        return mainnetStoreSingleton;
    }
}

// Create a stable hook that returns the current l1List and properly subscribes to changes
export const useL1List = () => {
    const { isTestnet } = useWalletStore();
    // Get the appropriate store based on testnet status
    const store = useMemo(() => getL1ListStore(Boolean(isTestnet)), [isTestnet]);
    // Subscribe to the l1List from the current store
    return store((state: { l1List: L1ListItem[] }) => state.l1List);
};

// Keep the original hook but make it stable to prevent infinite loops
export const useL1ListStore = () => {
    const { isTestnet } = useWalletStore();
    // Use useMemo to stabilize the store reference and prevent unnecessary re-renders
    return useMemo(() => {
        return getL1ListStore(Boolean(isTestnet));
    }, [isTestnet]);
}


export function useSelectedL1() {
    const { walletChainId } = useWalletStore();
    const l1ListStore = useL1ListStore();

    return useMemo(() =>
        () => {
            const l1List = l1ListStore.getState().l1List;
            return l1List.find((l1: L1ListItem) => l1.evmChainId === walletChainId) || undefined;
        },
        [walletChainId, l1ListStore]
    );
}

export function useL1ByChainId(chainId: string) {
    const l1ListStore = useL1ListStore();

    return useMemo(() =>
        () => {
            const l1List = l1ListStore.getState().l1List;
            return l1List.find((l1: L1ListItem) => l1.id === chainId) || undefined;
        },
        [chainId, l1ListStore]
    );
}

// Native currency hooks for L1 store
export const useSetNativeCurrencyInfo = () => {
    const l1ListStore = useL1ListStore();
    
    return (chainId: number, info: { name: string; symbol: string; decimals: number }) => {
        l1ListStore.getState().setNativeCurrencyInfo(chainId, info);
    };
};

export const useNativeCurrencyInfo = (chainId?: number) => {
    const { walletChainId } = useWalletStore();
    const l1ListStore = useL1ListStore();
    const effectiveChainId = chainId || walletChainId;
    
    return useMemo(() => {
        return l1ListStore.getState().getNativeCurrencyInfo(effectiveChainId);
    }, [l1ListStore, effectiveChainId]);
};

// Wrapped native token hooks
export const useWrappedNativeToken = () => {
    const selectedL1 = useSelectedL1()();
    return selectedL1?.wrappedTokenAddress || "";
};

export const useSetWrappedNativeToken = () => {
    const { walletChainId } = useWalletStore();
    const l1ListStore = useL1ListStore();
    
    return (address: string) => {
        const currentL1List = l1ListStore.getState().l1List;
        const updatedL1List = currentL1List.map((l1: L1ListItem) => 
            l1.evmChainId === walletChainId 
                ? { ...l1, wrappedTokenAddress: address }
                : l1
        );
        l1ListStore.setState({ l1List: updatedL1List });
    };
};
