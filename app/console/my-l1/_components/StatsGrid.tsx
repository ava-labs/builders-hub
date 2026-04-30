'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Blocks, Fuel, Users, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { L1HealthState } from '@/hooks/useL1Health';
import type { L1ValidatorCountState } from '@/hooks/useL1ValidatorCount';
import type { CombinedL1 } from '../_lib/types';
import { formatGasPrice, formatRelativeFromNow } from '../_lib/format';

// Inline shimmer for stat values during the very first load. Sized to roughly
// the final text so the cell's height doesn't jump when data lands.
function StatSkeleton({ width = 'w-16' }: { width?: string }) {
  return <Skeleton className={`inline-block h-5 ${width} align-middle`} />;
}

// Single-digit slot with an odometer-style roll on change. Old digit slides
// up and out as the new digit slides in from below. Non-digit characters
// (e.g. the leading `#`) bypass the animation and render statically.
//
// Implementation note: the invisible "0" inside the overflow-hidden wrapper
// reserves intrinsic width (works with `tabular-nums` which guarantees all
// digit glyphs are the same width). The animating motion.span is absolutely
// positioned over it, so the layout doesn't jitter as digits enter/exit.
function RollingChar({ char }: { char: string }) {
  if (!/^\d$/.test(char)) {
    return <span>{char}</span>;
  }
  return (
    <span className="relative inline-block overflow-hidden align-bottom leading-none">
      <span className="invisible">0</span>
      <AnimatePresence initial={false}>
        <motion.span
          key={char}
          className="absolute inset-0 leading-none"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function RollingNumber({ value }: { value: string }) {
  return (
    <span className="inline-flex tabular-nums">
      {value.split('').map((char, i) => (
        <RollingChar key={i} char={char} />
      ))}
    </span>
  );
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
  // Render the block height as an odometer: each digit position animates
  // independently when its value changes, so the user sees the chain
  // ticking forward digit-by-digit instead of a single fade-pulse on the
  // whole number. `prefers-reduced-motion` users see the same final value
  // without the per-digit slide because framer-motion respects the
  // OS-level setting.
  const blockValue =
    blockHeight !== null ? (
      <span aria-live="polite" aria-atomic="true" aria-label={`Latest block ${blockValueText}`}>
        <RollingNumber value={blockValueText} />
      </span>
    ) : health.isLoading ? (
      <StatSkeleton width="w-20" />
    ) : (
      blockValueText
    );
  const blockAge =
    health.blockAgeSec !== null
      ? `${health.blockAgeSec}s ago`
      : health.status === 'offline'
        ? 'RPC unreachable'
        : 'Pinging...';

  const blockTimeValue =
    health.blockTimeSec !== null ? `${health.blockTimeSec}s` : '—';
  const blockSub =
    blockTimeValue === '—'
      ? blockAge
      : `${blockAge} · ${blockTimeValue} interval`;

  const gasValue: React.ReactNode =
    health.gasPriceEth !== null
      ? formatGasPrice(health.gasPriceEth)
      : health.isLoading
        ? <StatSkeleton width="w-14" />
        : '—';

  // Validator count from Glacier when available, fall back to managed-node
  // count for managed L1s (still useful when Glacier hasn't indexed the
  // subnet yet), or the raw EVM chain ID for wallet-only entries on Glacier
  // misses.
  const fourthCard = (() => {
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
    if (l1.source === 'managed' && l1.nodes) {
      const active = l1.nodes.filter((n) => n.status === 'active').length;
      return (
        <StatCell
          icon={Users}
          label="Managed nodes"
          value={String(l1.nodes.length)}
          subValue={
            l1.expiresAt
              ? `${active} active · expires ${formatRelativeFromNow(l1.expiresAt)}`
              : `${active} active`
          }
        />
      );
    }
    return (
      <StatCell
        icon={Wallet}
        label="EVM chain ID"
        value={l1.evmChainId !== null ? String(l1.evmChainId) : '—'}
        subValue={validators.isLoading ? 'Loading validators…' : 'Added to wallet'}
      />
    );
  })();

  return (
    <Card className="overflow-hidden py-0 shadow-none">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          <StatCell
            icon={Blocks}
            label="Block"
            value={blockValue}
            valueTitle={blockValueText}
            subValue={blockSub}
          />
          <StatCell icon={Fuel} label="Gas price" value={gasValue} subValue="From eth_gasPrice" />
          {fourthCard}
        </div>
      </CardContent>
    </Card>
  );
}

// Clean neutral cell rendered inside the shared StatsGrid card. Drops the
// per-card border + hover-lift in favor of a single unified surface — feels
// more curated than 4 boxes floating side by side.
function StatCell({
  icon: Icon,
  label,
  value,
  subValue,
  valueTitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subValue?: string;
  /** Optional `title` attribute used when `value` is a ReactNode and we still
   *  want a hover tooltip with the full string. */
  valueTitle?: string;
}) {
  return (
    <div className="px-3.5 py-3 transition-colors hover:bg-accent/30">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          {/* div, not p — Skeleton renders as a div and div-in-p is invalid
              HTML; the wrapping element here is just for typography styling. */}
          <div
            className="text-base font-semibold text-foreground truncate tabular-nums"
            title={valueTitle ?? (typeof value === 'string' ? value : undefined)}
          >
            {value}
          </div>
          {subValue && <p className="text-xs text-muted-foreground truncate">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}
