import { useWalletStore } from "@/components/toolbox/stores/walletStore";

export const PChainExplorerButton = () => {
    const { isTestnet, pChainAddress } = useWalletStore();

    const baseExplorerUrl = isTestnet ? "https://subnets-test.avax.network/p-chain" : "https://subnets.avax.network/p-chain";

    return <a
        href={`${baseExplorerUrl}/address/${pChainAddress}`}
        target="_blank"
        className="px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors"
        title="Open explorer"
    >
        Explorer
    </a>;
};
