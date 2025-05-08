import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { networkIDs } from "@avalabs/avalanchejs";
import { createCoreWalletClient } from '../coreViem';
import { createPublicClient, custom, http } from 'viem';
import { avalancheFuji, avalanche } from 'viem/chains';
import { zeroAddress } from 'viem';
import { getPChainBalance, getNativeTokenBalance, getChains } from '../coreViem/utils/glacier';
import debounce from 'debounce';

let indexedChainsPromise: Promise<Number[]> | null = null;
function getIndexedChains() {
    if (!indexedChainsPromise) {
        indexedChainsPromise = getChains().then(chains => chains.map(chain => parseInt(chain.chainId)));
    }
    return indexedChainsPromise as Promise<Number[]>;
}

export const useWalletStore = create(
    combine({
        coreWalletClient: createCoreWalletClient(zeroAddress) as ReturnType<typeof createCoreWalletClient>,
        publicClient: createPublicClient({
            transport: typeof window !== 'undefined' && window.avalanche ? custom(window.avalanche) : http(avalancheFuji.rpcUrls.default.http[0]),
        }) as ReturnType<typeof createPublicClient>,
        walletChainId: 0,
        walletEVMAddress: "",
        avalancheNetworkID: networkIDs.FujiID as typeof networkIDs.FujiID | typeof networkIDs.MainnetID,
        pChainAddress: "",
        coreEthAddress: "",
        isTestnet: undefined as boolean | undefined,//Even though it can be undefined, the components will never use it as undefined
        evmChainName: "",
        pChainBalance: 0,
        l1Balance: 0,
        cChainBalance: 0,
        isPChainBalanceLoading: false,
        isL1BalanceLoading: false,
        isCChainBalanceLoading: false,
    }, (set, get) => {
        const _updatePChainBalance = async () => {
            if (get().isPChainBalanceLoading) return; //  Return if already loading
            let newBalance = 0;
            set({ isPChainBalanceLoading: true });
            try {
                const response = await getPChainBalance(get().isTestnet ? "testnet" : "mainnet", get().pChainAddress);
                newBalance = Number(response.balances.unlockedUnstaked[0].amount) / 1e9;
            } finally {
                set({ pChainBalance: newBalance, isPChainBalanceLoading: false });
            }
        };

        const _updateL1Balance = async () => {
            if (get().isL1BalanceLoading) return; // Return if already loading
            let newBalance = 0;
            set({ isL1BalanceLoading: true });
            try {
                const indexedChains = await getIndexedChains();
                const isIndexedChain = indexedChains.includes(get().walletChainId);

                if (isIndexedChain) {
                    const l1Balance = await getNativeTokenBalance(get().walletChainId, get().walletEVMAddress);
                    newBalance = Number(l1Balance.balance) / (10 ** l1Balance.decimals);
                } else {
                    const l1Balance = await get().publicClient.getBalance({
                        address: get().walletEVMAddress as `0x${string}`,
                    });
                    newBalance = Number(l1Balance) / 1e18;
                }
            } finally {
                set({ l1Balance: newBalance, isL1BalanceLoading: false });
            }
        };

        const _updateCChainBalance = async () => {
            if (get().isCChainBalanceLoading) return; // Return if already loading
            let newBalance = 0;
            set({ isCChainBalanceLoading: true });


            const chain = get().isTestnet ? avalancheFuji : avalanche;

            try {
                const cChainBalance = await getNativeTokenBalance(chain.id, get().walletEVMAddress);
                newBalance = Number(cChainBalance.balance) / (10 ** cChainBalance.decimals);
            } finally {
                set({ cChainBalance: newBalance, isCChainBalanceLoading: false });
            }
        }

        // Create debounced versions (500ms wait time)
        const debouncedUpdatePChainBalance = debounce(_updatePChainBalance, 500);
        const debouncedUpdateL1Balance = debounce(_updateL1Balance, 500);
        const debouncedUpdateCChainBalance = debounce(_updateCChainBalance, 500);

        return {
            setCoreWalletClient: (coreWalletClient: ReturnType<typeof createCoreWalletClient>) => set({ coreWalletClient }),
            setWalletChainId: (walletChainId: number) => set({ walletChainId }),
            setWalletEVMAddress: (walletEVMAddress: string) => set({ walletEVMAddress }),
            setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => set({ avalancheNetworkID }),
            setPChainAddress: (pChainAddress: string) => set({ pChainAddress }),
            setCoreEthAddress: (coreEthAddress: string) => set({ coreEthAddress }),
            setIsTestnet: (isTestnet: boolean) => set({ isTestnet }),
            setEvmChainName: (evmChainName: string) => set({ evmChainName }),
            updatePChainBalance: () => debouncedUpdatePChainBalance(),
            updateL1Balance: () => debouncedUpdateL1Balance(),
            updateCChainBalance: () => debouncedUpdateCChainBalance(),
            updateAllBalances: async () => {
                debouncedUpdatePChainBalance();
                debouncedUpdateL1Balance();
                debouncedUpdateCChainBalance();
            }
        }
    })
)
