'use client';

import { ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import type { PrecompileCheck } from '../use-precompile-active';

interface PrecompileBannerProps {
  check: PrecompileCheck;
  precompileName: string;
  chainName: string;
  docsLink?: string;
}

/**
 * Compact precompile-availability banner for the inspector preflight slot.
 * Mirrors the look of `<ChainMismatchBanner>`. Four states:
 *   - loading: subtle gray bar with spinner ("Checking…")
 *   - active: returns null (silent — nothing to warn about)
 *   - error: gray banner with the error message in mono
 *   - inactive: amber warning with optional docs link
 */
export function PrecompileBanner({ check, precompileName, chainName, docsLink }: PrecompileBannerProps) {
  if (check.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 px-3.5 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking {precompileName} on {chainName}…
      </div>
    );
  }

  if (check.isActive) return null;

  if (check.error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 px-3.5 py-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Could not verify {precompileName}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-mono break-all">
            {check.error}
          </p>
        </div>
      </div>
    );
  }

  // Inactive — hard block.
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30 px-3.5 py-3">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {precompileName} not enabled on {chainName}
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
          NativeTokenRemote needs this precompile to mint bridged tokens. Enable it in the L1's genesis or upgrade
          config before deploying.
        </p>
        {docsLink && (
          <a
            href={docsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            Learn how to enable it
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
