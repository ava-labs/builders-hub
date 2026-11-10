'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Blocks, Fuel, Users, Wallet } from 'lucide-react';
import { Board, LiveDot } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { BONE } from './chrome';
import type { L1HealthState } from '@/hooks/useL1Health';
import type { L1ValidatorCountState } from '@/hooks/useL1ValidatorCount';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { formatDurationCompact, formatGasPrice, formatRelativeFromNow } from '@/lib/console/my-l1/format';

// Inline shimmer for stat values during the very first load. Sized to roughly
// the final text so the cell's height doesn't jump when data lands.
function StatSkeleton({ width = 'w-16' }: { width?: string }) {
  return <span className={cn(BONE, 'inline-block h-5 align-middle', width)} />;
}

export function StatsGrid({
  l1,
  health,
  validators,
}: {
  l1: CombinedL1;
  health: L1HealthState;
  validators: L1ValidatorCountState;
}) {
  // Block, block-time, gas price come from the live RPC probe. The fourth
  // card prefers Active validators (Glacier) over managed-node count, since
  // active validators is the universally-meaningful signal across L1s and
  // the managed-node count is already visible in the header subtitle.
  const blockHeight = health.blockNumber !== null ? health.blockNumber.toString() : null;
  const blockValueText = blockHeight !== null ? `#${blockHeight}` : '—';
  // Whole-number "tick up" on each RPC update: the new value enters from
  // below with a subtle fade, the old value exits upward and fades. Reads
  // like a scrolling ticker without the per-digit baseline-alignment
  // problems that plagued the literal odometer (each digit needs its own
  // clipping container, and the clip + line-height + baseline interaction
  // breaks alignment with the leading `#` in subtle ways). `popLayout`
  // lifts the exiting element out of flow so the new one drops into the
  // same slot without a horizontal shift.
  const blockValue =
    blockHeight !== null ? (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={blockHeight}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -6, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="inline-block"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Latest block ${blockValueText}`}
        >
          {blockValueText}
        </motion.span>
      </AnimatePresence>
    ) : health.isLoading ? (
      <StatSkeleton width="w-20" />
    ) : (
      blockValueText
    );
  const blockAgeSec = useLiveAge(health.blockAgeSec, health.lastSampledAt);
  const blockAge =
    blockAgeSec !== null
      ? `${formatDurationCompact(blockAgeSec)} ago`
      : health.status === 'offline'
        ? 'RPC unreachable'
        : 'Pinging...';

  const blockTimeValue = health.blockTimeSec !== null ? formatDurationCompact(health.blockTimeSec) : '—';
  const blockSub = blockTimeValue === '—' ? blockAge : `${blockAge} · ${blockTimeValue} interval`;

  const gasValue: React.ReactNode =
    health.gasPriceEth !== null ? (
      formatGasPrice(health.gasPriceEth)
    ) : health.isLoading ? (
      <StatSkeleton width="w-14" />
    ) : (
      '—'
    );

  // Validator count from Glacier when available, fall back to managed-node
  // count for managed L1s (still useful when Glacier hasn't indexed the
  // subnet yet), or the raw EVM chain ID for wallet-only entries on Glacier
  // misses.
  const fourthCard = (() => {
    // While Glacier is responding, keep the cell labelled "Active
    // validators" and shimmer the value — avoids the awkward swap from
    // "EVM chain ID" → "Active validators" when the query returns.
    if (validators.isLoading && validators.count === null) {
      return (
        <StatCell
          icon={Users}
          label="Active validators"
          value={<StatSkeleton width="w-8" />}
          subValue="Querying validators…"
        />
      );
    }
    if (validators.count !== null) {
      return (
        <StatCell
          icon={Users}
          label="Active validators"
          value={String(validators.count)}
          subValue={`Subnet ${l1.subnetId.slice(0, 6)}…`}
        />
      );
    }
    // Glacier returned an error (5xx, network failure, etc). Surface it
    // explicitly instead of silently falling through to EVM chain ID —
    // a "—" with no context reads as "0 / not applicable", which would
    // mislead the user into thinking the chain is healthy with no
    // validators rather than "we can't tell right now."
    if (validators.error) {
      return (
        <StatCell
          icon={Users}
          label="Active validators"
          value={<span className="text-zinc-300 dark:text-zinc-700">—</span>}
          subValue="Glacier unavailable"
          valueTitle={validators.error}
        />
      );
    }
    if (l1.source === 'managed' && l1.nodes) {
      const active = l1.nodes.filter((n) => n.status === 'active').length;
      return (
        <StatCell
          icon={Users}
          label="Managed nodes"
          value={String(l1.nodes.length)}
          subValue={
            l1.expiresAt ? `${active} active · expires ${formatRelativeFromNow(l1.expiresAt)}` : `${active} active`
          }
        />
      );
    }
    return (
      <StatCell
        icon={Wallet}
        label="EVM chain ID"
        value={l1.evmChainId !== null ? String(l1.evmChainId) : '—'}
        subValue="Added to wallet"
      />
    );
  })();

  return (
    <Board divide={false} className="border-x border-t">
      <div className="grid grid-cols-1 divide-y divide-zinc-200 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-zinc-800">
        <StatCell
          icon={Blocks}
          label="Block"
          live={health.status !== 'offline' && health.blockNumber !== null}
          value={blockValue}
          valueTitle={blockValueText}
          subValue={blockSub}
        />
        <StatCell icon={Fuel} label="Gas price" value={gasValue} subValue="From eth_gasPrice" />
        {fourthCard}
      </div>
    </Board>
  );
}

/** The block's age, counting up each second between RPC samples. */
function useLiveAge(ageSec: number | null, sampledAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (ageSec === null) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [ageSec]);
  if (ageSec === null || sampledAt === null) return ageSec;
  return ageSec + Math.max(0, Math.floor((now - sampledAt) / 1000));
}

/* One figure in the strip, in the explorer's stat voice: mono label, the figure, a quiet qualifier. */
function StatCell({
  icon: Icon,
  label,
  value,
  subValue,
  valueTitle,
  live = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subValue?: string;
  /** A `title` for when `value` is a node but should still show the full string on hover. */
  valueTitle?: string;
  live?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {live ? <LiveDot /> : <Icon className="h-3 w-3" />}
        {label}
      </span>
      {/* A div, not a p: the skeleton renders a div, and a div inside a p is invalid. */}
      <div
        className="truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50"
        title={valueTitle ?? (typeof value === 'string' ? value : undefined)}
      >
        {value}
      </div>
      {subValue && (
        <span className="truncate font-mono text-[10px] leading-4 tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
          {subValue}
        </span>
      )}
    </div>
  );
}
