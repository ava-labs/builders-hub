'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Board, BoardHeader, FIG, UNIT } from '@/components/explorer-v2/ui';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { balanceService } from '@/components/toolbox/services/balanceService';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { cn } from '@/lib/utils';
import type { L1HealthState, L1HealthStatus } from '@/hooks/useL1Health';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { WalletNetworkAction } from './WalletNetworkAction';
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, ICON_BTN, TOOLTIP } from './chrome';

// The page's lead board: chain identity and actions on top, the key figures in a stat strip below. Health, balance,
// and identity props are threaded in from `DashboardBody` so the page only owns one `useL1Health` subscription (the
// same one `L1Details` reads).
export function HeroCard({
  l1,
  health,
  onRefresh,
  isRefreshing,
}: {
  l1: CombinedL1;
  health: L1HealthState;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isWalletOnThisL1 = l1.evmChainId !== null && walletChainId === l1.evmChainId;
  const balance = useWalletStore((s) =>
    isWalletOnThisL1 ? (s.balances.l1Chains[String(l1.evmChainId)] ?? null) : null,
  );
  const updateL1Balance = useWalletStore((s) => s.updateL1Balance);

  // Poll the L1 balance every 15s while the wallet is on this chain so the
  // displayed number stays in sync with on-chain reality. Without this the
  // wallet store only refreshes balances on explicit user actions, so
  // spending elsewhere shows a stale figure on the dashboard.
  //
  // `registerRpcUrls` is called BEFORE every update so a wallet-only L1
  // that wasn't part of the initial bulk register (DashboardBody) still has
  // a chain-specific viem client when its balance is read. Without this
  // the service silently falls back to the wallet's currently-connected
  // chain's RPC and returns the wrong balance (or 0 for non-Glacier L1s).
  useEffect(() => {
    if (!isWalletOnThisL1 || l1.evmChainId === null) return;
    const id = String(l1.evmChainId);
    if (l1.rpcUrl) {
      balanceService.registerRpcUrls([{ evmChainId: l1.evmChainId, rpcUrl: l1.rpcUrl }]);
    }
    void updateL1Balance(id);
    const interval = setInterval(() => void updateL1Balance(id), 15_000);
    return () => clearInterval(interval);
  }, [isWalletOnThisL1, l1.evmChainId, l1.rpcUrl, updateL1Balance]);

  const hasBalance = isWalletOnThisL1 && balance !== null;

  return (
    <Board className="border-x border-t">
      <BoardHeader
        display
        label="Selected L1"
        action={<HealthPulse status={health.status} blockAgeSec={health.blockAgeSec} />}
      />

      {/* Identity and actions share a row from xl up; below that the action cluster (refresh, switch, explorer,
          create) wraps under the name so no button clips off the edge. */}
      <div className="flex flex-col gap-5 px-5 py-5 md:px-6 xl:flex-row xl:items-center xl:justify-between">
        <HeroIdentity l1={l1} />
        <HeroActions l1={l1} onRefresh={onRefresh} isRefreshing={isRefreshing} />
      </div>

      <div
        className={cn(
          'grid grid-cols-1 divide-y divide-zinc-200 dark:divide-zinc-800',
          l1.evmChainId !== null && 'sm:grid-cols-2 sm:divide-x sm:divide-y-0',
        )}
      >
        <div className="flex min-w-0 flex-col gap-1.5 px-5 py-5 md:px-6">
          <span className={EYEBROW}>Balance</span>
          <p className={cn(FIG, 'truncate')}>
            {hasBalance ? balance.toFixed(4) : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
            {hasBalance && l1.coinName && <span className={cn(UNIT, 'ml-1.5')}>{l1.coinName}</span>}
          </p>
          {!isWalletOnThisL1 && (
            <span className="font-mono text-[10px] leading-4 tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
              Switch your wallet to this L1 to see balance
            </span>
          )}
        </div>
        {l1.evmChainId !== null && (
          <div className="flex min-w-0 flex-col gap-1.5 px-5 py-5 md:px-6">
            <span className={EYEBROW}>EVM chain ID</span>
            <p className={cn(FIG, 'truncate')}>{l1.evmChainId}</p>
          </div>
        )}
      </div>
    </Board>
  );
}

function HeroIdentity({ l1 }: { l1: CombinedL1 }) {
  const initial = l1.chainName?.charAt(0).toUpperCase() ?? '?';
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = l1.logoUrl && !imgFailed;

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-white md:h-16 md:w-16 dark:border-zinc-800 dark:bg-zinc-900">
        {showImg ? (
          <img
            src={l1.logoUrl}
            alt={l1.chainName}
            className="h-full w-full object-contain p-1.5"
            // The hero sits at the top of every dashboard view, so `eager`
            // matches the user's expectation of the avatar appearing the
            // moment the page paints. `decoding="async"` keeps the decode
            // off the main thread.
            loading="eager"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="font-mono text-2xl font-bold text-zinc-700 dark:text-zinc-200">{initial}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone={l1.isTestnet ? 'testnet' : 'mainnet'}>{l1.isTestnet ? 'Testnet' : 'Mainnet'}</Tag>
          {l1.coinName && <Tag>{l1.coinName}</Tag>}
        </div>
        <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 md:text-[28px] dark:text-zinc-50">
          {l1.chainName}
        </h1>
      </div>
    </div>
  );
}

// Status dot + short mono label in the board's title bar. Mirrors every state
// the `useL1Health` hook can return — emerald for fresh, amber for lagging
// (>2 min since last block), red for stale (>10 min) or RPC errors. The
// hover tooltip explains what each colour means and surfaces the actual
// block-age figure when available.
function HealthPulse({ status, blockAgeSec }: { status: L1HealthStatus | undefined; blockAgeSec: number | null }) {
  if (!status || status === 'unknown') return null;

  const config = HEALTH_PULSE_CONFIG[status];
  const ageLabel = blockAgeSec !== null ? formatBlockAge(blockAgeSec) : null;
  const tooltipLabel = ageLabel ? `${config.description} · last block ${ageLabel} ago` : config.description;

  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex shrink-0 cursor-help items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
          aria-label={tooltipLabel}
          role="status"
        >
          <span className="relative flex h-1.5 w-1.5">
            {config.animatePing && (
              <span
                className={cn(
                  'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                  config.dotClass,
                )}
                aria-hidden="true"
              />
            )}
            <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', config.dotClass)} aria-hidden="true" />
          </span>
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className={TOOLTIP}>
        {tooltipLabel}
      </TooltipContent>
    </UITooltip>
  );
}

const HEALTH_PULSE_CONFIG: Record<
  Exclude<L1HealthStatus, 'unknown'>,
  { dotClass: string; animatePing: boolean; label: string; description: string }
> = {
  healthy: {
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    animatePing: true,
    label: 'Healthy',
    description: 'Chain healthy — producing fresh blocks',
  },
  degraded: {
    dotClass: 'bg-amber-500',
    animatePing: true,
    label: 'Lagging',
    description: 'Chain lagging — last block over 2 minutes ago',
  },
  stale: {
    dotClass: 'bg-red-500',
    animatePing: false,
    label: 'Stale',
    description: 'Chain stale — no new blocks for 10+ minutes',
  },
  offline: {
    dotClass: 'bg-red-500',
    animatePing: false,
    label: 'Offline',
    description: 'RPC unreachable or chain ID mismatch',
  },
};

// Compact human-readable block-age formatter. Tooltip-only, so it can stay
// minimal — "12s", "3m", "2h", "1d" — without a unit-of-time word.
function formatBlockAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

function HeroActions({
  l1,
  onRefresh,
  isRefreshing,
}: {
  l1: CombinedL1;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh L1 list"
        className={ICON_BTN}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
      </button>
      {/* Wallet-related actions cluster together (left): the Switch Wallet
          button only renders when the wallet is on a different chain.
          Create L1 sits at the far right because it's a global navigation
          action, distinct from the per-chain affordances. */}
      <WalletNetworkAction l1={l1} />
      <ExplorerMenu
        evmChainId={l1.evmChainId}
        isTestnet={l1.isTestnet}
        customExplorerUrl={l1.explorerUrl}
        buttonClassName={cn(
          BTN_SECONDARY,
          'rounded-none shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent',
        )}
      />
      <Link href="/console/create-l1" className={cn(BTN_PRIMARY, 'group/create')}>
        Create L1
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/create:translate-x-0.5" />
      </Link>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'testnet' | 'mainnet' }) {
  const toneClass =
    tone === 'testnet'
      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300'
      : tone === 'mainnet'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400';
  return (
    <span
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        toneClass,
      )}
    >
      {children}
    </span>
  );
}
