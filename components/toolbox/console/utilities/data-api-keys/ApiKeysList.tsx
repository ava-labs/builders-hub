'use client';

import { ApiKeyListItem } from './types';
import { Button } from '@/components/toolbox/components/Button';
import { Trash2, RefreshCw, KeyRound, Loader2, AlertTriangle } from 'lucide-react';
import { TableSkeleton } from '@/components/console';

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
    return <TableSkeleton rows={3} columns={3} />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-red-200/80 dark:border-red-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">Failed to Load API Keys</h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
        <Button onClick={onRefresh} variant="primary">
          Try Again
        </Button>
      </div>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <KeyRound className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
        </div>
        <h3 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">No API Keys Yet</h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Create your first API key to start using the Glacier API.
        </p>
        <Button onClick={onShowCreateForm} variant="primary">
          Create API Key
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium">{apiKeys.length}</span> / {maxApiKeysAllowed} API keys
        </p>
        <button
          onClick={onRefresh}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
          aria-label="Refresh API keys"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50">
                <th className="text-left py-3 px-6 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Alias
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Key ID
                </th>
                <th className="text-right py-3 px-6 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr
                  key={apiKey.keyId}
                  className="border-b border-zinc-200/80 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{apiKey.alias}</div>
                  </td>
                  <td className="py-4 px-6">
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg font-mono text-zinc-700 dark:text-zinc-300">
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
                        <Loader2 className="w-4 h-4 animate-spin" />
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
