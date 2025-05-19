import { useWalletStore } from "../../stores/walletStore";

export const PChainExplorerButton = () => {
    const isTestnet = useWalletStore(state => state.isTestnet);

    return <a
        href={isTestnet ? "https://subnets-test.avax.network/p-chain" : "https://subnets.avax.network/p-chain"}
        target="_blank"
        className="px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors"
        title="Open explorer"
    >
        Explorer
    </a>;
};
