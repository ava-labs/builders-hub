"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ConnectWallet } from "./ConnectWallet/ConnectWallet";
import { ErrorFallback } from "./ErrorFallback";

export default function ToolboxMdxWrapper({ children }: { children: React.ReactNode }) {
    const handleReset = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    return <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={handleReset}
    >
        <ConnectWallet walletMode="l1">
            {children}
        </ConnectWallet>
    </ErrorBoundary>;
}
