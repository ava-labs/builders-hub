"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../academy/wrapper/ErrorFallback";

export default function ToolboxConsoleWrapper({ children }: { children: React.ReactNode }) {
    const handleReset = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    return <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={handleReset}
    >
        {children}
    </ErrorBoundary>;
}


