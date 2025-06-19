import { useL1ByChainId } from "../../stores/l1ListStore";
import { useWalletStore } from "../../stores/walletStore";

export const L1ExplorerButton = ({ blockchainId }: { blockchainId: string }) => {
    const l1 = useL1ByChainId(blockchainId)();
    const { walletEVMAddress } = useWalletStore();

    if (!l1) return null;

    // Determine the URL based on available data
    let explorerUrl = "";

    if (l1.explorerUrl) {
        explorerUrl = `${l1.explorerUrl}/address/${walletEVMAddress}`;
    } else if (l1.rpcUrl) {
        explorerUrl = `https://devnet.routescan.io/?rpc=${encodeURIComponent(l1.rpcUrl)}`;
    }

    // If no URL could be determined, don't render anything
    if (!explorerUrl) return null;

    // Return the button with the determined URL
    return (<a
            href={explorerUrl}
            target="_blank"
            className="px-2 py-1 text-xs font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors"
            title="Open explorer"
        >
            Explorer
        </a>
    );
};