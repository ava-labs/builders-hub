"use client";

import { ApiKeyListItem } from './types';
import { Button } from "@/components/toolbox/components/Button";
import { Trash2, RefreshCw } from "lucide-react";

interface ApiKeysListProps {
    apiKeys: ApiKeyListItem[];
    isLoading: boolean;
    error: string | null;
    maxApiKeysAllowed: number;
    deletingKeys: Set<string>;
    onRefresh: () => void;
    onShowCreateForm: () => void;
    onDeleteKey: (keyId: string) => void;
}

function truncateKeyId(keyId: string): string {
    if (keyId.length <= 12) return keyId;
    return `${keyId.slice(0, 8)}...${keyId.slice(-4)}`;
}

export default function ApiKeysList({
    apiKeys,
    isLoading,
    error,
    maxApiKeysAllowed,
    deletingKeys,
    onRefresh,
    onShowCreateForm,
    onDeleteKey,
}: ApiKeysListProps) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                {/* Loading skeleton */}
                <div className="animate-pulse">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4 mb-4"></div>
                    <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6">
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex space-x-4">
                                        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24"></div>
                                        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32"></div>
                                    </div>
                                    <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-20"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-red-200 dark:border-red-700 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                    Failed to Load API Keys
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
                <Button
                    onClick={onRefresh}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    if (apiKeys.length === 0) {
        return (
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                    No API Keys Yet
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                    Create your first API key to start using the Glacier API.
                </p>
                <Button
                    onClick={onShowCreateForm}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                    Create API Key
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold">{apiKeys.length}</span> / {maxApiKeysAllowed} API keys
                </p>
                <button
                    onClick={onRefresh}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    aria-label="Refresh API keys"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                <th className="text-left py-4 px-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    Alias
                                </th>
                                <th className="text-left py-4 px-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    Key ID
                                </th>
                                <th className="text-right py-4 px-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {apiKeys.map((apiKey) => (
                                <tr
                                    key={apiKey.keyId}
                                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                                >
                                    <td className="py-4 px-6">
                                        <div className="font-medium text-zinc-900 dark:text-white">
                                            {apiKey.alias}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <code className="text-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono text-zinc-700 dark:text-zinc-300">
                                            {truncateKeyId(apiKey.keyId)}
                                        </code>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => onDeleteKey(apiKey.keyId)}
                                            disabled={deletingKeys.has(apiKey.keyId)}
                                            className="p-1.5 text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Delete API key"
                                        >
                                            {deletingKeys.has(apiKey.keyId) ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
