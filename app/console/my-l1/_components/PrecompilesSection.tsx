'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  MessagesSquare,
  ShieldCheck,
  ShieldUser,
  SlidersVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPrimaryNetwork, type CombinedL1 } from '@/lib/console/my-l1/types';
import type { L1PrecompileKey, UseL1ActivePrecompilesState } from '@/hooks/useL1ActivePrecompiles';
import { BONE, CELL, GRID, NOTICE_WARN } from './chrome';

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

export function PrecompilesSection({ l1, state }: { l1: CombinedL1; state: UseL1ActivePrecompilesState }) {
  // Primary Network (C-Chain) runs coreth, not subnet-EVM, so the
  // eth_getActiveRulesAt method isn't available. The parent already gates
  // the section but we double-guard here for direct consumers.
  if (isPrimaryNetwork(l1)) return null;

  if (state.isLoading && !state.precompiles && state.rpcSupportsRulesQuery) {
    return (
      <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(CELL, 'flex min-h-32 flex-col gap-3 p-5')}>
            <span className={cn(BONE, 'h-4 w-4')} />
            <span className={cn(BONE, 'mt-auto h-3.5 w-32')} />
            <span className={cn(BONE, 'h-2.5 w-44')} />
          </div>
        ))}
      </div>
    );
  }

  // The RPC didn't recognise `eth_getActiveRulesAt` — common on older
  // subnet-EVM versions and most non-Avalanche EVM RPCs. Without that
  // method we can't tell the *real* state of any precompile, so render
  // an explicit "unknown" surface instead of a wall of "Off" tiles
  // that would falsely imply the L1 has no precompiles enabled.
  if (!state.rpcSupportsRulesQuery) {
    return (
      <div className={cn(NOTICE_WARN, 'flex items-start gap-4 p-5')}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-200">
            Precompile state unavailable from this RPC
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            This L1&apos;s RPC endpoint does not expose{' '}
            <code className="font-mono text-[12px]">eth_getActiveRulesAt</code>, so the dashboard can&apos;t verify
            which precompiles are enabled. Check the genesis configuration, or upgrade the node software to a recent
            subnet-EVM version (≥ <code className="font-mono text-[12px]">v0.6.10</code>).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(GRID, 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')}>
        {PRECOMPILES.map((precompile) => (
          <PrecompileTile
            key={precompile.key}
            precompile={precompile}
            active={Boolean(state.precompiles?.[precompile.key])}
          />
        ))}
      </div>
      {state.error && (
        <p className="font-mono text-[11px] text-zinc-400 [overflow-wrap:anywhere] dark:text-zinc-500">
          Could not verify precompiles from this RPC: {state.error}
        </p>
      )}
    </div>
  );
}

function PrecompileTile({ precompile, active }: { precompile: PrecompileRow; active: boolean }) {
  const Icon = precompile.icon;
  const body = (
    <div className={cn(CELL, 'flex h-full min-h-32 flex-col gap-3 p-5')}>
      <span className="flex items-center justify-between gap-2">
        <Icon
          className={cn(
            'h-4 w-4',
            active
              ? 'text-zinc-400 transition-colors group-hover/door:text-zinc-900 dark:group-hover/door:text-zinc-100'
              : 'text-zinc-300 dark:text-zinc-700',
          )}
        />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
            active ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500',
          )}
        >
          <span
            aria-hidden="true"
            className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700')}
          />
          {active ? 'Enabled' : 'Off'}
        </span>
      </span>
      <span
        className={cn(
          'mt-auto flex items-center gap-2 text-[15px] font-semibold',
          active ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500',
        )}
      >
        <span className={cn('truncate', active && 'underline-offset-4 group-hover/door:underline')}>
          {precompile.name}
        </span>
        {active && (
          <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/door:translate-x-0 group-hover/door:opacity-100" />
        )}
      </span>
      <span
        className={cn(
          'line-clamp-2 text-[13px] leading-relaxed',
          active ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600',
        )}
      >
        {precompile.description}
      </span>
      {active && (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover/door:text-zinc-900 dark:text-zinc-400 dark:group-hover/door:text-zinc-100">
          Open tool
        </span>
      )}
    </div>
  );

  if (!active) return body;
  return (
    <Link href={precompile.href} className="group/door block h-full">
      {body}
    </Link>
  );
}
