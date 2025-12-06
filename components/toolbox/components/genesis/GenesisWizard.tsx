"use client";

import { useState, useEffect, ReactNode } from "react";
import { JsonPreviewPanel } from "./JsonPreviewPanel";
import { GenesisHighlightProvider, useGenesisHighlight } from "./GenesisHighlightContext";
import { SyntaxHighlightedJSON } from "./SyntaxHighlightedJSON";

interface GenesisWizardProps {
    children: ReactNode;
    genesisData: string;
    onGenesisDataChange: (data: string) => void;
    currentStep?: number;
    footer?: ReactNode;
    embedded?: boolean;
}

function GenesisWizardContent({ children, genesisData, onGenesisDataChange, footer, embedded = false }: GenesisWizardProps) {
    const { highlightPath } = useGenesisHighlight();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            // Force single column layout if embedded or on mobile
            setIsMobile(embedded || window.innerWidth < 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, [embedded]);

    if (isMobile) {
        // Mobile/Embedded layout - stacked view with always-visible JSON preview and scroll-to-highlight
        return (
            <div className="space-y-6">
                <div>
                    {children}
                </div>

                {genesisData && genesisData.length > 0 && !genesisData.startsWith("Error:") && (
                    <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <div className="px-4 py-2.5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Genesis JSON</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-500">
                                {(new Blob([genesisData]).size / 1024).toFixed(2)} KiB
                            </span>
                        </div>
                        <div className="w-full overflow-x-auto">
                            <JsonPreviewPanel
                                jsonData={genesisData}
                                onJsonUpdate={onGenesisDataChange}
                                highlightPath={highlightPath || undefined}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Desktop layout - split view with global footer
    return (
        <div className="flex flex-col">
            <div className="flex gap-6">
                {/* Left Panel - Configuration */}
                <div className="flex-1 min-w-0 text-[13px] pr-4">
                    {children}
                </div>

                {/* Right Panel - JSON Preview */}
                <div className="w-[480px] xl:w-[560px] flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800 sticky top-4 self-start">
                    <JsonPreviewPanel
                        jsonData={genesisData}
                        onJsonUpdate={onGenesisDataChange}
                        highlightPath={highlightPath || undefined}
                    />
                </div>
            </div>

            {footer && (
                <div className="border-t border-zinc-200 dark:border-zinc-800">
                    <div className="px-4 py-3 flex items-center justify-center">
                        {footer}
                    </div>
                </div>
            )}
        </div>
    );
}

export function GenesisWizard({
    children,
    genesisData,
    onGenesisDataChange,
    currentStep = 1,
    footer,
    embedded = false
}: GenesisWizardProps) {
    return (
        <GenesisHighlightProvider>
            <GenesisWizardContent
                genesisData={genesisData}
                onGenesisDataChange={onGenesisDataChange}
                footer={footer}
                embedded={embedded}
            >
                {children}
            </GenesisWizardContent>
        </GenesisHighlightProvider>
    );
}

interface WizardStepProps {
    title: string;
    description?: string;
    children: ReactNode;
}

export function WizardStep({ title, description, children }: WizardStepProps) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
                )}
            </div>
            <div>{children}</div>
        </div>
    );
}
