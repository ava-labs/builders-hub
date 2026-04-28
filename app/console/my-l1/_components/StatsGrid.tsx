'use client';

import { motion } from 'framer-motion';
import { Blocks, Fuel, Timer, Users, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { L1HealthState } from '@/hooks/useL1Health';
import type { L1ValidatorCountState } from '@/hooks/useL1ValidatorCount';
import type { CombinedL1 } from '../_lib/types';
import { formatGasPrice, formatRelativeFromNow } from '../_lib/format';

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
  const blockValueText = blockHeight !== null ? `#${blockHeight}` : health.isLoading ? '…' : '—';
  // Wrap the block height in a keyed motion.span so the value pulses on every
  // RPC tick — the user sees the chain breathe instead of a static number.
  // Using `key={blockHeight}` forces remount → re-animate. `prefers-reduced-
  // motion` users see the same final value without the entrance animation
  // because framer-motion respects the OS-level setting by default.
  const blockValue =
    blockHeight !== null ? (
      <motion.span
        key={blockHeight}
        initial={{ opacity: 0.55, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {blockValueText}
      </motion.span>
    ) : (
      blockValueText
    );
  const blockSub =
    health.blockAgeSec !== null
      ? `${health.blockAgeSec}s ago`
      : health.status === 'offline'
        ? 'RPC unreachable'
        : 'Pinging…';

  const blockTimeValue =
    health.blockTimeSec !== null ? `${health.blockTimeSec}s` : health.isLoading ? '…' : '—';

  const gasValue = health.gasPriceEth !== null ? formatGasPrice(health.gasPriceEth) : '—';

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

  // Single connected unit instead of 4 detached cards. On desktop the four
  // cells share one rounded card with vertical dividers; on mobile (<md)
  // each cell stays full-width with horizontal dividers so the icons line up
  // and don't squish.
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
          <StatCell
            icon={Blocks}
            label="Latest block"
            value={blockValue}
            valueTitle={blockValueText}
            subValue={blockSub}
          />
          <StatCell
            icon={Timer}
            label="Block time"
            value={blockTimeValue}
            subValue={blockTimeValue === '—' ? 'Unavailable' : 'Last interval'}
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
    <div className="px-4 py-4 transition-colors hover:bg-accent/40">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className="text-lg font-semibold text-foreground truncate tabular-nums"
            title={valueTitle ?? (typeof value === 'string' ? value : undefined)}
          >
            {value}
          </p>
          {subValue && <p className="text-xs text-muted-foreground truncate">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}
