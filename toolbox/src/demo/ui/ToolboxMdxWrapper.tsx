"use client";

import { ErrorBoundary } from "react-error-boundary";
import { Button } from "./";
import { ConnectWallet } from "./ConnectWallet";

const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => {
    return (
        <div className="space-y-2">
            <div className="text-red-500 text-sm">
                {error.message}
            </div>
            {
                error.message.includes("The error is mostly returned when the client requests") && (
                    <div className="text-sm text-red-500">
                        ^ This usually indicates that the core wallet is not in testnet mode. Open settings &gt; Advanced &gt; Testnet mode.
                    </div>
                )
            }
            <Button onClick={resetErrorBoundary}>
                Try Again
            </Button>
        </div>
    );
};

export default function ToolboxMdxWrapper({ children }: { children: React.ReactNode }) {
    return <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
            window.location.reload();
        }}
    >
        <ConnectWallet required={true}>
            {children}
        </ConnectWallet>
    </ErrorBoundary>;
}
