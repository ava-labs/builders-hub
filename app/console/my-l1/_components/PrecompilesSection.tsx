'use client';

import Link from 'next/link';
import { CheckCircle2, CircleOff, Coins, MessagesSquare, ShieldCheck, ShieldUser, SlidersVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { isPrimaryNetwork, type CombinedL1 } from '../_lib/types';
import type { L1PrecompileKey, UseL1ActivePrecompilesState } from '@/hooks/useL1ActivePrecompiles';

type PrecompileRow = {
  key: L1PrecompileKey;
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PRECOMPILES: PrecompileRow[] = [
  {
    key: 'nativeMinter',
    name: 'Native Minter',
    description: 'Mint native tokens from approved addresses.',
    href: '/console/l1-tokenomics/native-minter',
    icon: Coins,
  },
  {
    key: 'feeManager',
    name: 'Fee Manager',
    description: 'Tune gas and fee parameters.',
    href: '/console/l1-tokenomics/fee-manager',
    icon: SlidersVertical,
  },
  {
    key: 'rewardManager',
    name: 'Reward Manager',
    description: 'Configure fee reward distribution.',
    href: '/console/l1-tokenomics/reward-manager',
    icon: Coins,
  },
  {
    key: 'deployerAllowlist',
    name: 'Deployer Allowlist',
    description: 'Restrict contract deployment rights.',
    href: '/console/l1-access-restrictions/deployer-allowlist',
    icon: ShieldCheck,
  },
  {
    key: 'transactorAllowlist',
    name: 'Transactor Allowlist',
    description: 'Restrict who can submit transactions.',
    href: '/console/l1-access-restrictions/transactor-allowlist',
    icon: ShieldUser,
  },
  {
    key: 'warp',
    name: 'Warp / ICM',
    description: 'Avalanche Warp Messaging support.',
    href: '/console/icm/setup',
    icon: MessagesSquare,
  },
];

export function PrecompilesSection({
  l1,
  state,
}: {
  l1: CombinedL1;
  state: UseL1ActivePrecompilesState;
}) {
  // Primary Network (C-Chain) runs coreth, not subnet-EVM, so the
  // eth_getActiveRulesAt method isn't available. The parent already gates
  // the section but we double-guard here for direct consumers.
  if (isPrimaryNetwork(l1)) return null;

  if (state.isLoading && !state.precompiles) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      {PRECOMPILES.map((precompile) => (
        <PrecompileTile
          key={precompile.key}
          precompile={precompile}
          active={Boolean(state.precompiles?.[precompile.key])}
        />
      ))}
      {state.error && (
        <div className="md:col-span-2 xl:col-span-3 text-xs text-muted-foreground">
          Could not verify precompiles from this RPC: {state.error}
        </div>
      )}
    </div>
  );
}

function PrecompileTile({
  precompile,
  active,
}: {
  precompile: PrecompileRow;
  active: boolean;
}) {
  const Icon = precompile.icon;
  const body = (
    <div
      className={`rounded-lg border px-3 py-2.5 h-full transition-all duration-150 ${
        active
          ? 'bg-card hover:bg-accent/40 hover:border-foreground/20 hover:shadow-sm hover:-translate-y-px'
          : 'bg-muted/30 opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-foreground text-sm truncate">{precompile.name}</h4>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                active
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              {active ? <CheckCircle2 className="w-3 h-3" /> : <CircleOff className="w-3 h-3" />}
              {active ? 'Enabled' : 'Off'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{precompile.description}</p>
          {active && <p className="mt-2 text-xs font-medium text-foreground">Open tool</p>}
        </div>
      </div>
    </div>
  );

  if (!active) return body;
  return (
    <Link href={precompile.href} className="block h-full">
      {body}
    </Link>
  );
}
