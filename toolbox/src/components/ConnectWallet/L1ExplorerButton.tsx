
const knownExplorerUrls: Record<number, string> = {
    43114: "https://subnets.avax.network/c-chain",
    43113: "https://subnets-test.avax.network/c-chain",
    173750: "https://subnets-test.avax.network/echo",
    779672: "https://subnets-test.avax.network/dispatch"
}

export const L1ExplorerButton = ({ rpcUrl, evmChainId }: { rpcUrl: string, evmChainId: number }) => {
    const handleExplorerClick = () => {
        const url = knownExplorerUrls[evmChainId];
        window.open(url, "_blank");
    };

    if (knownExplorerUrls[evmChainId]) {
        return (
            <button
                onClick={handleExplorerClick}
                className="px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors"
                title="Open explorer"
            >
                Explorer
            </button>
        );
    }

    if (!rpcUrl) {
        return;
    }

    const handleCustomExplorerClick = () => {
        const routescanUrl = `https://devnet.routescan.io/?rpc=${encodeURIComponent(rpcUrl)}`;
        window.open(routescanUrl, "_blank");
    };

    return (
        <button
            onClick={handleCustomExplorerClick}
            className="ml-2 px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors"
            title="Open explorer"
        >
            Explorer
        </button>
    );
};
