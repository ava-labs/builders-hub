import { create } from "zustand";
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useWalletStore } from "./walletStore";
import { localStorageComp, STORE_VERSION } from "./utils";
import { useMemo } from "react";
type L1ListItem = {
    id: string;
    name: string;
    rpcUrl: string;
    evmChainId: number;
    coinName: string;
    isTestnet: boolean;
    subnetId: string;
    wrappedTokenAddress: string;
    validatorManagerAddress: string;
    logoUrl: string;
    wellKnownTeleporterRegistryAddress?: string;
    faucetUrl?: string;
    explorerUrl?: string;
};



const l1ListInitialStateFuji = {
    l1List: [
        {
            id: "yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp",
            name: "C-Chain",
            rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
            evmChainId: 43113,
            coinName: "AVAX",
            isTestnet: true,
            subnetId: "11111111111111111111111111111111LpoYY",
            wrappedTokenAddress: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
            wellKnownTeleporterRegistryAddress: "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228",
            faucetUrl: "https://test.core.app/tools/testnet-faucet/?subnet=c&token=c",
            explorerUrl: "https://subnets-test.avax.network/c-chain"
        },
        {
            id: "98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp",
            name: "Echo",
            rpcUrl: "https://subnets.avax.network/echo/testnet/rpc",
            evmChainId: 173750,
            coinName: "ECH",
            isTestnet: true,
            subnetId: "i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK",
            wrappedTokenAddress: "",
            validatorManagerAddress: "0x0646263a231b4fde6f62d4de63e18df7e6ad94d6",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/7kyTY75fdtnO6mh7f0osix/4c92c93dd688082bfbb43d5d910cbfeb/Echo_Subnet_Logo.png",
            wellKnownTeleporterRegistryAddress: "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228",
            faucetUrl: "https://test.core.app/tools/testnet-faucet/?subnet=echo&token=echo",
            explorerUrl: "https://subnets-test.avax.network/echo",
        },
        {
            id: "2D8RG4UpSXbPbvPCAWppNJyqTG2i2CAXSkTgmTBBvs7GKNZjsY",
            name: "Dispatch",
            rpcUrl: "https://subnets.avax.network/dispatch/testnet/rpc",
            evmChainId: 779672,
            coinName: "DISP",
            isTestnet: true,
            subnetId: "7WtoAMPhrmh5KosDUsFL9yTcvw7YSxiKHPpdfs4JsgW47oZT5",
            wrappedTokenAddress: "",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/60XrKdf99PqQKrHiuYdwTE/908622f5204311dbb11be9c6008ead44/Dispatch_Subnet_Logo.png",
            wellKnownTeleporterRegistryAddress: "0xF86Cb19Ad8405AEFa7d09C778215D2Cb6eBfB228",
            faucetUrl: "https://test.core.app/tools/testnet-faucet/?subnet=dispatch&token=dispatch",
            explorerUrl: "https://subnets-test.avax.network/dispatch"
        }
    ] as L1ListItem[],
}

const l1ListInitialStateMainnet = {
    l1List: [
        {
            id: "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5",
            name: "C-Chain",
            rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
            evmChainId: 43114,
            coinName: "AVAX",
            isTestnet: false,
            subnetId: "11111111111111111111111111111111LpoYY",
            wrappedTokenAddress: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
            validatorManagerAddress: "",
            logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
            wellKnownTeleporterRegistryAddress: "0x7C43605E14F391720e1b37E49C78C4b03A488d98",
            explorerUrl: "https://subnets.avax.network/c-chain"
        }
    ] as L1ListItem[],
}

const defaultChainIds = [
    ...l1ListInitialStateFuji.l1List.map((l1) => l1.id),
    ...l1ListInitialStateMainnet.l1List.map((l1) => l1.id),
]
export const isDefaultChain = (chainId: string) => defaultChainIds.includes(chainId)


export const getL1ListStore = (isTestnet: boolean) => create(
    persist(
        combine(isTestnet ? l1ListInitialStateFuji : l1ListInitialStateMainnet, (set) => ({
            addL1: (l1: L1ListItem) => set((state) => ({ l1List: [...state.l1List, l1] })),
            removeL1: (l1Id: string) => set((state) => ({ l1List: state.l1List.filter((l) => l.id !== l1Id) })),
            reset: () => {
                window?.localStorage.removeItem(`${STORE_VERSION}-l1-list-store-${isTestnet ? 'testnet' : 'mainnet'}`);
            },
        })),
        {
            name: `${STORE_VERSION}-l1-list-store-${isTestnet ? 'testnet' : 'mainnet'}`,
            storage: createJSONStorage(localStorageComp),
        },
    ),
)

export const useL1ListStore = () => {
    const { isTestnet } = useWalletStore();
    return getL1ListStore(Boolean(isTestnet));
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
