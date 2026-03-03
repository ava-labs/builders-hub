"use client";

import { SyntaxHighlightedJSON } from '@/components/toolbox/components/genesis/SyntaxHighlightedJSON';
import { FileJson, Copy, Check, ExternalLink } from 'lucide-react';
import { useState, useCallback } from 'react';

interface ConfigPreviewProps {
    configJson: string;
    highlightedLines: number[];
}

export function ConfigPreview({ configJson, highlightedLines }: ConfigPreviewProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        if (!configJson) return;
        await navigator.clipboard.writeText(configJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [configJson]);

    return (
        <div className="lg:sticky lg:top-4 flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-[600px]">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-zinc-400" />
                    <div>
                        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            config.json
                        </h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            Relayer Configuration
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        disabled={!configJson}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30"
                        title="Copy configuration"
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                    <a
                        href="https://github.com/ava-labs/awm-relayer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                        title="AWM Relayer GitHub"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 bg-zinc-50 dark:bg-zinc-950">
                {configJson ? (
                    <SyntaxHighlightedJSON
                        code={configJson}
                        highlightedLines={highlightedLines}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                            <FileJson className="w-6 h-6 text-zinc-400" />
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                            No Configuration Yet
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            Select source and destination networks
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Hover over form fields to highlight corresponding config values
                </p>
            </div>
        </div>
    );
}
