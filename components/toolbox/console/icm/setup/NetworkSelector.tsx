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
            <div className="text-base font-semibold">{title}</div>
            <div 
                className="space-y-2 border rounded-md p-4 bg-gray-50 dark:bg-gray-900/20"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {l1List.map((l1: L1ListItem) => (
                    <div 
                        key={`${idPrefix}-${l1.id}`} 
                        className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                        <input
                            type="checkbox"
                            id={`${idPrefix}-${l1.id}`}
                            checked={selectedNetworks.includes(l1.id)}
                            onChange={() => onToggle(l1.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor={`${idPrefix}-${l1.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium text-sm">{l1.name}</div>
                            <div className="text-xs text-gray-500">Chain ID: {l1.evmChainId}</div>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}

