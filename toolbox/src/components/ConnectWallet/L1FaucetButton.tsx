"use client"
import { useL1ByChainId } from "../../stores/l1ListStore";

const LOW_BALANCE_THRESHOLD = 0.5

export const L1FaucetButton = ({
    blockchainId,
    displayedL1Balance,
}: {
    blockchainId: string;
    displayedL1Balance: number;
}) => {
    const l1 = useL1ByChainId(blockchainId)();

    return l1 && l1.faucetUrl && <button
        onClick={() => window.open(l1.faucetUrl, "_blank")}
        className={`px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors ${displayedL1Balance < LOW_BALANCE_THRESHOLD
            ? "shimmer"
            : ""
            }`}
        title="Open faucet"
    >
        Faucet
    </button>;
};