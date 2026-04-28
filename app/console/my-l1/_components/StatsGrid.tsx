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
  // Using `key={blockHeight}` forces remount → re-animate.
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
        <StatCard
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
        <StatCard
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
      <StatCard
        icon={Wallet}
        label="EVM chain ID"
        value={l1.evmChainId !== null ? String(l1.evmChainId) : '—'}
        subValue={validators.isLoading ? 'Loading validators…' : 'Added to wallet'}
      />
    );
  })();

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Blocks}
        label="Latest block"
        value={blockValue}
        valueTitle={blockValueText}
        subValue={blockSub}
      />
      <StatCard
        icon={Timer}
        label="Block time"
        value={blockTimeValue}
        subValue={blockTimeValue === '—' ? 'Unavailable' : 'Last interval'}
      />
      <StatCard icon={Fuel} label="Gas price" value={gasValue} subValue="From eth_gasPrice" />
      {fourthCard}
    </div>
  );
}

// Clean neutral StatCard — the dashboard's at-a-glance cards rely on
// typography + icons for differentiation, not color. The brand accent is
// reserved for the chart page (where it actually carries data) so the
// dashboard reads as a quiet hub instead of a noisy color wheel.
function StatCard({
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
    <Card className="py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
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
      </CardContent>
    </Card>
  );
}
