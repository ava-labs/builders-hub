import { create } from "zustand";
import { persist, createJSONStorage, combine } from 'zustand/middleware'
import { useWalletStore } from "./walletStore";
import { localStorageComp, STORE_VERSION } from "./utils";

const createChainInitialState = {
    subnetId: "",
    chainID: "",
    chainName: "",
    managerAddress: "0xfacade0000000000000000000000000000000000",
    genesisData: "",
    targetBlockRate: 1,
    gasLimit: 12000000,
    evmChainId: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
    convertToL1TxId: "",
    validatorWeights: Array(100).fill(100) as number[],
    nodePopJsons: [""] as string[],
    blueprint: null as string | null,
}

// Cache store instances to ensure the same instance is returned for each network
const storeCache: { testnet?: ReturnType<typeof createStore>; mainnet?: ReturnType<typeof createStore> } = {};

const createStore = (isTestnet: boolean) => create(
    persist(
        combine(createChainInitialState, (set) => ({
            setSubnetID: (subnetId: string) => set({ subnetId }),
            setChainName: (chainName: string) => set({ chainName }),
            setChainID: (chainID: string) => set({ chainID }),
            setManagerAddress: (managerAddress: string) => set({ managerAddress }),
            setGenesisData: (genesisData: string) => set({ genesisData }),
            setTargetBlockRate: (targetBlockRate: number) => set({ targetBlockRate }),
            setGasLimit: (gasLimit: number) => set({ gasLimit }),
            setEvmChainId: (evmChainId: number) => set({ evmChainId }),
            setConvertToL1TxId: (convertToL1TxId: string) => set({ convertToL1TxId }),
            setValidatorWeights: (validatorWeights: number[]) => set({ validatorWeights }),
            setNodePopJsons: (nodePopJsons: string[]) => set({ nodePopJsons }),
            setBlueprint: (blueprint: string | null) => set({ blueprint }),

            reset: () => {
                window?.localStorage.removeItem(`${STORE_VERSION}-create-chain-store-${isTestnet ? 'testnet' : 'mainnet'}`);
            },
        })),
        {
            name: `${STORE_VERSION}-create-chain-store-${isTestnet ? 'testnet' : 'mainnet'}`,
            storage: createJSONStorage(localStorageComp),
        },
    ),
);

export const getCreateChainStore = (isTestnet: boolean) => {
    const key = isTestnet ? 'testnet' : 'mainnet';
    if (!storeCache[key]) {
        storeCache[key] = createStore(isTestnet);
    }
    return storeCache[key]!;
}

export const useCreateChainStore = () => {
    const { isTestnet } = useWalletStore();
    return getCreateChainStore(Boolean(isTestnet))
}

