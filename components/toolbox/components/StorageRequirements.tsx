'use client';

import { useMemo } from 'react';

type StorageVariant = 'primary' | 'l1';

interface StorageRequirementsProps {
  nodeType: 'validator' | 'rpc' | 'archival';
  pruningEnabled: boolean;
  skipTxIndexing: boolean;
  stateSyncEnabled: boolean;
  debugEnabled?: boolean;
  network?: 'mainnet' | 'fuji';
  /**
   * Storage baseline profile. `'primary'` uses real Avalanche C-Chain
   * measurements (~13 TB archival mainnet). `'l1'` uses much smaller
   * numbers anchored on the typical Avalanche L1 baseline shown in the L1
   * node setup tile (~200 GB pruned validator mainnet, ~40 GB Fuji). L1
   * storage varies enormously with chain activity — the L1 figures are
   * conservative averages, not precise predictions. Default `'primary'`.
   */
  variant?: StorageVariant;
}

interface StorageEstimate {
  initial: number;
  monthlyGrowth: number;
  yearlyGrowth: number;
  oneYearTotal: number;
}

// Baseline figures in GB, per profile. Values are picked so that the
// "typical validator" cell (pruned + state sync + skip TX index) matches
// the visible figure in the corresponding node setup's Set up Instance
// tile, keeping the right-sidebar storage estimate consistent with the
// hardware-spec callout.
//
// Sources:
//   - Primary Network: real C-Chain measurements. Validator ~300 GB with
//     state sync, RPC ~350 GB. Archival 12.1 TiB ≈ 13.3 TB, growing
//     ~0.64 TiB/mo ≈ 700 GB/mo. Fuji at ~15% of mainnet.
//   - L1: anchored on the existing "~40 GB Fuji / ~200 GB Mainnet"
//     baseline used in the L1 node setup hardware tile (validator + state
//     sync + skip tx index). Archival figures scaled ~4x pruned to reflect
//     full-history storage being substantially larger than pruned, but
//     nowhere near the 13 TB C-Chain archival since L1s are smaller,
//     lower-volume chains. Growth rates assume light-to-moderate L1
//     traffic; user is reminded that real values track actual chain
//     throughput.
interface ProfileBaseline {
  archival: { initial: number; monthly: number };
  prunedSyncSkip: { initial: number; monthly: number }; // pruned + state sync + skip tx idx
  prunedSyncFull: { initial: number; monthly: number }; // pruned + state sync + full tx idx
  prunedNoSyncSkip: { initial: number; monthly: number }; // pruned + replay + skip tx idx
  prunedNoSyncFull: { initial: number; monthly: number }; // pruned + replay + full tx idx
  fujiMultiplier: number;
}

const STORAGE_BASELINES: Record<StorageVariant, ProfileBaseline> = {
  primary: {
    archival: { initial: 13300, monthly: 700 },
    prunedSyncSkip: { initial: 300, monthly: 80 },
    prunedSyncFull: { initial: 350, monthly: 100 },
    prunedNoSyncSkip: { initial: 450, monthly: 80 },
    prunedNoSyncFull: { initial: 500, monthly: 100 },
    fujiMultiplier: 0.15,
  },
  l1: {
    archival: { initial: 800, monthly: 35 },
    prunedSyncSkip: { initial: 200, monthly: 10 },
    prunedSyncFull: { initial: 240, monthly: 12 },
    prunedNoSyncSkip: { initial: 260, monthly: 10 },
    prunedNoSyncFull: { initial: 300, monthly: 12 },
    // 200 GB Mainnet → 40 GB Fuji matches the Set up Instance tile (40/200=0.2)
    fujiMultiplier: 0.2,
  },
};

const getStorageEstimate = (
  pruningEnabled: boolean,
  skipTxIndexing: boolean,
  stateSyncEnabled: boolean,
  debugEnabled: boolean,
  network: 'mainnet' | 'fuji',
  variant: StorageVariant,
): StorageEstimate => {
  const profile = STORAGE_BASELINES[variant];
  const mult = network === 'fuji' ? profile.fujiMultiplier : 1;
  // Debug tracing stores execution traces, adding ~20% storage overhead
  const debugMult = debugEnabled ? 1.2 : 1;

  let initial: number;
  let monthlyGrowth: number;

  if (!pruningEnabled) {
    initial = profile.archival.initial * mult;
    monthlyGrowth = profile.archival.monthly * mult;
  } else if (stateSyncEnabled) {
    const cell = skipTxIndexing ? profile.prunedSyncSkip : profile.prunedSyncFull;
    initial = cell.initial * mult;
    monthlyGrowth = cell.monthly * mult;
  } else {
    const cell = skipTxIndexing ? profile.prunedNoSyncSkip : profile.prunedNoSyncFull;
    initial = cell.initial * mult;
    monthlyGrowth = cell.monthly * mult;
  }

  // Apply debug multiplier to growth rate (traces accumulate over time)
  // Initial is less affected since debug data builds up with usage
  monthlyGrowth = monthlyGrowth * debugMult;

  const yearlyGrowth = monthlyGrowth * 12;
  return { initial, monthlyGrowth, yearlyGrowth, oneYearTotal: initial + yearlyGrowth };
};

const formatStorage = (gb: number): string => {
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)}TB`;
  return `${Math.round(gb)}GB`;
};

export function StorageRequirements({
  pruningEnabled,
  skipTxIndexing,
  stateSyncEnabled,
  debugEnabled = false,
  network = 'mainnet',
  variant = 'primary',
}: StorageRequirementsProps) {
  const estimate = useMemo(
    () => getStorageEstimate(pruningEnabled, skipTxIndexing, stateSyncEnabled, debugEnabled, network, variant),
    [pruningEnabled, skipTxIndexing, stateSyncEnabled, debugEnabled, network, variant],
  );

  // Reference lines don't include debug overhead for clearer comparison
  const prunedRef = getStorageEstimate(true, false, true, false, network, variant);
  const archivalRef = getStorageEstimate(false, false, false, false, network, variant);

  const maxStorage = archivalRef.oneYearTotal;
  const isArchival = !pruningEnabled;

  // Generate smooth curve points
  const generatePath = (est: StorageEstimate) => {
    let d = `M 0 ${100 - (est.initial / maxStorage) * 100}`;
    for (let m = 1; m <= 12; m++) {
      const x = (m / 12) * 100;
      const y = 100 - ((est.initial + est.monthlyGrowth * m) / maxStorage) * 100;
      d += ` L ${x} ${y}`;
    }
    return d;
  };

  // Area path (for fill)
  const generateArea = (est: StorageEstimate) => {
    let d = `M 0 100 L 0 ${100 - (est.initial / maxStorage) * 100}`;
    for (let m = 1; m <= 12; m++) {
      const x = (m / 12) * 100;
      const y = 100 - ((est.initial + est.monthlyGrowth * m) / maxStorage) * 100;
      d += ` L ${x} ${y}`;
    }
    d += ` L 100 100 Z`;
    return d;
  };

  return (
    <div className="border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden mt-4">
      <div className="border-b px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Storage Requirements</h4>
      </div>

      <div className="p-4 space-y-5">
        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatStorage(estimate.initial)}
            </div>
            <div className="text-xs text-zinc-500">Initial</div>
          </div>
          <div className="text-right">
            <div className="text-lg text-zinc-600 dark:text-zinc-400">
              +{formatStorage(estimate.monthlyGrowth)}
              <span className="text-xs text-zinc-400">/mo</span>
            </div>
            <div className="text-xs text-zinc-500">→ {formatStorage(estimate.oneYearTotal)} after 1 year</div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-32">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isArchival ? '#ef4444' : '#3b82f6'} stopOpacity="0.2" />
                <stop offset="100%" stopColor={isArchival ? '#ef4444' : '#3b82f6'} stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="refGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a1a1aa" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Reference line (archival if pruned, pruned if archival) */}
            <path d={generateArea(isArchival ? prunedRef : archivalRef)} fill="url(#refGradient)" />
            <path
              d={generatePath(isArchival ? prunedRef : archivalRef)}
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="1"
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />

            {/* Current config */}
            <path d={generateArea(estimate)} fill="url(#areaGradient)" />
            <path
              d={generatePath(estimate)}
              fill="none"
              stroke={isArchival ? '#ef4444' : '#3b82f6'}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-zinc-400 pointer-events-none">
            <span>{formatStorage(maxStorage)}</span>
            <span>0</span>
          </div>

          {/* X-axis labels */}
          <div className="absolute left-6 right-0 bottom-0 flex justify-between text-[10px] text-zinc-400 pointer-events-none">
            <span>Now</span>
            <span>6mo</span>
            <span>1yr</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-0.5 rounded-full ${isArchival ? 'bg-red-500' : 'bg-blue-500'}`} />
            <span className="text-zinc-600 dark:text-zinc-400">Your config</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded-full bg-zinc-400"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #a1a1aa 0, #a1a1aa 2px, transparent 2px, transparent 4px)',
              }}
            />
            <span className="text-zinc-400">
              {isArchival ? 'Pruned' : 'Archival'} (
              {formatStorage(isArchival ? prunedRef.oneYearTotal : archivalRef.oneYearTotal)})
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              pruningEnabled
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {pruningEnabled ? 'Pruning ON' : 'Pruning OFF'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              stateSyncEnabled
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {stateSyncEnabled ? 'State Sync' : 'Full Replay'}
          </span>
          {!skipTxIndexing && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              TX Index
            </span>
          )}
          {debugEnabled && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Debug +20%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
