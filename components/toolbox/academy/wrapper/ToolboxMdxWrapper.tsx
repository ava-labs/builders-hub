"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorFallback";
import { SessionProvider } from "next-auth/react";

import { EmbeddedConsoleHeader } from "@/components/toolbox/components/console-header/embedded-console-header";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { LoginModal } from "@/components/login/LoginModal";

export default function ToolboxMdxWrapper({ children }: { children: React.ReactNode, walletMode?: "l1" | "c-chain", enforceChainId?: number }) {
    const handleReset = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    return <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={handleReset}
    >
        <SessionProvider>
            <WalletProvider>
                <div
                    className="h-screen overflow-hidden m-2 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col"
                    style={{ "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
                >
                    <EmbeddedConsoleHeader />
                    <div className="flex flex-1 flex-col gap-4 p-6 overflow-y-auto bg-white dark:bg-gray-800">
                        {children}
                    </div>
                </div>
                {/* Login modal for account requirements */}
                <LoginModal />
            </WalletProvider>
        </SessionProvider>
    </ErrorBoundary>;
}
