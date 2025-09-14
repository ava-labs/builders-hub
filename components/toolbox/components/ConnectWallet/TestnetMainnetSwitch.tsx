import { avalanche, avalancheFuji } from "viem/chains"
import { useWalletStore } from "@/components/toolbox/stores/walletStore";

export const TestnetMainnetSwitch = () => {
    const coreWalletClient = useWalletStore(state => state.coreWalletClient);
    const isTestnet = useWalletStore(state => state.isTestnet);

    const handleSwitchToTestnet = () => {
        coreWalletClient.switchChain({ id: avalancheFuji.id })
    }

    const handleSwitchToMainnet = () => {
        coreWalletClient.switchChain({ id: avalanche.id })
    }


    return (<div className="rounded-full overflow-hidden flex bg-zinc-100 dark:bg-zinc-800/70 p-0.5">
        <button
            onClick={handleSwitchToTestnet}
            className={`px-4 py-1 text-sm rounded-full transition-colors ${isTestnet
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
        >
            Testnet
        </button>
        <button
            onClick={handleSwitchToMainnet}
            className={`px-4 py-1 text-sm rounded-full transition-colors ${!isTestnet
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
        >
            Mainnet
        </button>
    </div>);
}
