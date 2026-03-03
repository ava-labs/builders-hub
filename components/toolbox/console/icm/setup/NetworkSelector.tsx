"use client";

import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

interface NetworkSelectorProps {
    l1List: L1ListItem[];
    selectedNetworks: string[];
    onToggle: (l1Id: string) => void;
    title: string;
    idPrefix: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export function NetworkSelector({
    l1List,
    selectedNetworks,
    onToggle,
    title,
    idPrefix,
    onMouseEnter,
    onMouseLeave
}: NetworkSelectorProps) {
    return (
        <div className="space-y-3">
            <div className="text-base font-medium">{title}</div>
            <div
                className="space-y-2 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-800/50"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {l1List.map((l1: L1ListItem) => (
                    <div 
                        key={`${idPrefix}-${l1.id}`} 
                        className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    >
                        <input
                            type="checkbox"
                            id={`${idPrefix}-${l1.id}`}
                            checked={selectedNetworks.includes(l1.id)}
                            onChange={() => onToggle(l1.id)}
                            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-600 focus:ring-zinc-500"
                        />
                        <label htmlFor={`${idPrefix}-${l1.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium text-sm">{l1.name}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">Chain ID: {l1.evmChainId}</div>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}

