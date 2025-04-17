"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ConnectWallet } from "../../components/ConnectWallet";
import { ErrorFallback } from "../../components/ErrorFallback";

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
        <ConnectWallet required={true}>
            {children}
        </ConnectWallet>
    </ErrorBoundary>;
}
