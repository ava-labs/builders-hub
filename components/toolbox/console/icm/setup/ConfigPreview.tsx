"use client";

import { SyntaxHighlightedJSON } from '@/components/toolbox/components/genesis/SyntaxHighlightedJSON';

interface ConfigPreviewProps {
    configJson: string;
    highlightedLines: number[];
}

export function ConfigPreview({ configJson, highlightedLines }: ConfigPreviewProps) {
    return (
        <div className="lg:sticky lg:top-4 h-fit">
            <div className="border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="border-b p-3 bg-gray-50 dark:bg-gray-900">
                    <h4 className="text-sm font-semibold">Configuration Preview</h4>
                </div>
                <div className="max-h-[600px] overflow-auto p-3 bg-zinc-50 dark:bg-zinc-950">
                    {configJson ? (
                        <SyntaxHighlightedJSON
                            code={configJson}
                            highlightedLines={highlightedLines}
                        />
                    ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                            Select source and destination networks to see configuration
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

