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

  const tone = isArchival ? '#E6212F' : 'currentColor';
  const reference = isArchival ? prunedRef : archivalRef;

  return (
    <div className="mt-4 border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Storage Requirements
        </h4>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {network === 'fuji' ? 'Fuji' : 'Mainnet'} · estimate
        </span>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-zinc-200 border-b border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        <div className="flex flex-col gap-1 px-4 py-3">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Initial
          </dt>
          <dd className="font-mono text-lg tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatStorage(estimate.initial)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Growth
          </dt>
          <dd className="font-mono text-lg tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            +{formatStorage(estimate.monthlyGrowth)}
            <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">/mo</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            After 1 yr
          </dt>
          <dd className="font-mono text-lg tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatStorage(estimate.oneYearTotal)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Chart */}
        <div className="relative h-32 text-zinc-900 dark:text-zinc-100">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {/* Reference line (archival if pruned, pruned if archival) */}
            <path d={generateArea(reference)} fill="#a1a1aa" fillOpacity="0.06" />
            <path
              d={generatePath(reference)}
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="1"
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />

            {/* Current config */}
            <path d={generateArea(estimate)} fill={tone} fillOpacity="0.08" />
            <path
              d={generatePath(estimate)}
              fill="none"
              stroke={tone}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Y-axis labels */}
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 flex flex-col justify-between font-mono text-[10px] tabular-nums text-zinc-400">
            <span>{formatStorage(maxStorage)}</span>
            <span>0</span>
          </div>

          {/* X-axis labels */}
          <div className="pointer-events-none absolute bottom-0 left-6 right-0 flex justify-between font-mono text-[10px] text-zinc-400">
            <span>Now</span>
            <span>6mo</span>
            <span>1yr</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em]">
          <div className="flex items-center gap-1.5">
            <span className={`h-0.5 w-3 ${isArchival ? 'bg-[#E6212F]' : 'bg-zinc-900 dark:bg-zinc-100'}`} aria-hidden />
            <span className="text-zinc-600 dark:text-zinc-400">Your config</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-zinc-400" aria-hidden />
            <span className="tabular-nums text-zinc-400">
              {isArchival ? 'Pruned' : 'Archival'} ({formatStorage(reference.oneYearTotal)})
            </span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Tag tone={pruningEnabled ? 'ok' : 'bad'}>{pruningEnabled ? 'Pruning ON' : 'Pruning OFF'}</Tag>
        <Tag tone={stateSyncEnabled ? 'ink' : 'muted'}>{stateSyncEnabled ? 'State Sync' : 'Full Replay'}</Tag>
        {!skipTxIndexing && <Tag tone="muted">TX Index</Tag>}
        {debugEnabled && <Tag tone="warn">Debug +20%</Tag>}
      </div>
    </div>
  );
}

const TAG_TONES = {
  ok: 'border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400',
  bad: 'border-red-300 text-red-700 dark:border-red-900 dark:text-red-400',
  warn: 'border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400',
  ink: 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100',
  muted: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
} as const;

function Tag({ tone, children }: { tone: keyof typeof TAG_TONES; children: React.ReactNode }) {
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
