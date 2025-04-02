import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { networkIDs } from "@avalabs/avalanchejs";
import { createCoreWalletClient } from '../coreViem';
import { createPublicClient, custom, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { zeroAddress } from 'viem';

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
    }, set => ({
        setCoreWalletClient: (coreWalletClient: ReturnType<typeof createCoreWalletClient>) => set({ coreWalletClient }),
        setWalletChainId: (walletChainId: number) => set({ walletChainId }),
        setWalletEVMAddress: (walletEVMAddress: string) => set({ walletEVMAddress }),
        setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => set({ avalancheNetworkID }),
        setPChainAddress: (pChainAddress: string) => set({ pChainAddress }),
    })),
)
