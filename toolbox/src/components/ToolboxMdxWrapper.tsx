"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorFallback";

import { AcademySidebar } from "./console-header/academy-sidebar";
import { AcademyHeader } from "./console-header/academy-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
        <div className="h-screen overflow-hidden m-2 rounded-xl border border-gray-200 dark:border-gray-700 relative">
            <SidebarProvider
                defaultOpen={false}
                className="h-full overflow-hidden relative"
                style={
                    {
                        "--sidebar-width": "100%",
                        "--header-height": "calc(var(--spacing) * 12)",
                    } as React.CSSProperties
                }
            >
                <AcademySidebar />
                <SidebarInset className="h-full bg-white dark:bg-gray-800">
                <AcademyHeader />
                <div className="flex flex-1 flex-col gap-4 p-6 overflow-y-auto h-[calc(100vh-var(--header-height)-1rem)]">
                    {children}
                </div>
                </SidebarInset>
            </SidebarProvider>
        </div>
    </ErrorBoundary>;
}
