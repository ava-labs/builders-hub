"use client";

import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export interface PrecompileInfo {
    address: string;
    name: string;
    description: string;
    githubUrl?: string;
}

export interface PrecompileItem {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    info: PrecompileInfo;
    expandedContent?: ReactNode;
}

interface PrecompileToggleListProps {
    items: PrecompileItem[];
    showEnabledCount?: boolean;
}

export function PrecompileToggleList({ 
    items, 
    showEnabledCount = true 
}: PrecompileToggleListProps) {
    const enabledCount = items.filter(item => item.checked).length;
    const totalCount = items.length;

    return (
        <div className="space-y-3">
            {showEnabledCount && (
                <div className="flex items-center justify-between text-[12px]">
                    <div className="text-zinc-600 dark:text-zinc-400">Enabled</div>
                    <div className="text-zinc-700 dark:text-zinc-300 font-medium">
                        {enabledCount} / {totalCount}
                    </div>
                </div>
            )}

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                {items.map((item) => (
                    <div key={item.id} className="px-3 py-2 text-[12px] bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {item.label}
                                </span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                            <div className="font-semibold">{item.info.name}</div>
                                            <div className="text-xs font-mono">{item.info.address}</div>
                                            <div className="text-xs">{item.info.description}</div>
                                            {item.info.githubUrl && (
                                                <a
                                                    href={item.info.githubUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                                >
                                                    View contract source
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Switch
                                checked={item.checked}
                                onCheckedChange={item.onCheckedChange}
                            />
                        </div>
                        {item.checked && item.expandedContent && (
                            <div className="mt-2">
                                {item.expandedContent}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
