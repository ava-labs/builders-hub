"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ConnectWallet } from "./ConnectWallet/ConnectWallet";
import { ErrorFallback } from "./ErrorFallback";

export default function ToolboxMdxWrapper({ children, walletMode }: { children: React.ReactNode, walletMode: "l1" | "c-chain" }) {
    const handleReset = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    return <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={handleReset}
    >
        <ConnectWallet walletMode={walletMode}>
            {children}
        </ConnectWallet>
    </ErrorBoundary>;
}
