'use client';

import type { TokenSnapshot } from './use-token-snapshot';
import { formatTokenAmount } from './use-token-snapshot';

interface TokenSnapshotPanelProps {
  title: string;
  snapshot: TokenSnapshot;
  showBridged?: boolean;
  bridgedLabel?: string;
}

/**
 * Three-cell stat block used in the expanded chain panels. Cells shrink
 * to "—" when no data exists yet (e.g., before TokenHome is deployed).
 * Loading state shows a faint shimmer rather than a spinner so it
 * doesn't visually compete with the active phase indicators.
 */
export function TokenSnapshotPanel({
  title,
  snapshot,
  showBridged = true,
  bridgedLabel = 'Bridged',
}: TokenSnapshotPanelProps) {
  const { symbol, decimals, totalSupply, bridged, isLoading, error } = snapshot;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-2">
        {title}
      </div>
      {error ? (
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-lg px-3 py-2">
          Could not load snapshot.
        </div>
      ) : (
        <div className={`grid grid-cols-3 gap-2 ${isLoading ? 'animate-pulse' : ''}`}>
          <Stat label="Supply" value={formatTokenAmount(totalSupply, decimals)} />
          <Stat label="Decimals" value={String(decimals)} />
          {showBridged ? (
            <Stat label={bridgedLabel} value={formatTokenAmount(bridged, decimals)} />
          ) : (
            <Stat label="Symbol" value={symbol} />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 px-2.5 py-2">
      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">{value}</div>
    </div>
  );
}
