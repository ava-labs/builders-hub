'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Copy, Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { L1HealthState, L1HealthStatus } from '@/hooks/useL1Health';
import type { CombinedL1 } from '../_lib/types';
import { WalletNetworkAction } from './WalletNetworkAction';

// Tint palette for the chain logo fallback + radial glow accent. Each entry
// pairs a logo background (used when the chain has no logoUrl) with three
// raw rgba/hex stops we feed straight into `background: radial-gradient(...)`
// inline. Tailwind v4 ships a different gradient-variable API than v3, so
// composing `from-X to-transparent` no longer reliably hydrates
// `--tw-gradient-stops` for our custom `bg-gradient-radial` utility — going
// inline sidesteps that entirely. Same trick the existing
// `states.tsx:38` `radial-gradient(...)` already uses in this folder.
type Tint = {
  logo: string;
  haloColor: string; // bright halo behind the logo
  primaryColor: string; // upper-left ambient bloom
  secondaryColor: string; // bottom-right counter-glow
  initial: string;
};

const FALLBACK_TINTS: readonly Tint[] = [
  {
    logo: 'bg-rose-500',
    haloColor: 'rgba(244, 63, 94, 0.55)',
    primaryColor: 'rgba(244, 63, 94, 0.32)',
    secondaryColor: 'rgba(251, 113, 133, 0.18)',
    initial: 'text-white',
  },
  {
    logo: 'bg-emerald-500',
    haloColor: 'rgba(16, 185, 129, 0.55)',
    primaryColor: 'rgba(16, 185, 129, 0.32)',
    secondaryColor: 'rgba(52, 211, 153, 0.18)',
    initial: 'text-white',
  },
  {
    logo: 'bg-sky-500',
    haloColor: 'rgba(14, 165, 233, 0.55)',
    primaryColor: 'rgba(14, 165, 233, 0.32)',
    secondaryColor: 'rgba(56, 189, 248, 0.18)',
    initial: 'text-white',
  },
  {
    logo: 'bg-amber-500',
    haloColor: 'rgba(245, 158, 11, 0.55)',
    primaryColor: 'rgba(245, 158, 11, 0.32)',
    secondaryColor: 'rgba(251, 191, 36, 0.18)',
    initial: 'text-white',
  },
  {
    logo: 'bg-violet-500',
    haloColor: 'rgba(139, 92, 246, 0.55)',
    primaryColor: 'rgba(139, 92, 246, 0.32)',
    secondaryColor: 'rgba(167, 139, 250, 0.18)',
    initial: 'text-white',
  },
] as const;

// Known-chain overrides so each L1 picks up the colour of its actual logo
// rather than a hash-of-subnetId roulette. Falls through to the hash-based
// fallback for chains we don't know.
const KNOWN_CHAIN_TINTS: Record<string, Tint> = {
  // C-Chain (Fuji + Mainnet) — AVAX brand red
  '11111111111111111111111111111111LpoYY': FALLBACK_TINTS[0],
  // Echo testnet — teal/emerald logo
  i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK: FALLBACK_TINTS[1],
  // Dispatch testnet — violet/purple logo
  '7WtoAMPhrmh5KosDUsFL9yTcvw7YSxiKHPpdfs4JsgW47oZT5': FALLBACK_TINTS[4],
  // Dexalot testnet — pink/rose logo
  '9m6a3Qte8FaRbLZixLhh8Ptdkemm4csNaLwQeKkENx5wskbWP': FALLBACK_TINTS[0],
};

function pickTint(seed: string): Tint {
  if (KNOWN_CHAIN_TINTS[seed]) return KNOWN_CHAIN_TINTS[seed];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length];
}

// Single hero card — chain identity on the left, big balance number in the
// middle, action cluster on the right. Health, balance, and identity props
// are threaded in from `DashboardBody` so the page only owns one
// `useL1Health` subscription (the same one `L1Details` reads).
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
  const tint = pickTint(l1.subnetId);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isWalletOnThisL1 = l1.evmChainId !== null && walletChainId === l1.evmChainId;
  const balance = useWalletStore((s) =>
    isWalletOnThisL1 ? s.balances.l1Chains[String(l1.evmChainId)] ?? null : null,
  );
  const updateL1Balance = useWalletStore((s) => s.updateL1Balance);

  // Poll the L1 balance every 15s while the wallet is on this chain so the
  // displayed number stays in sync with on-chain reality. Without this the
  // wallet store only refreshes balances on explicit user actions, so
  // spending elsewhere shows a stale figure on the dashboard.
  useEffect(() => {
    if (!isWalletOnThisL1 || l1.evmChainId === null) return;
    const id = String(l1.evmChainId);
    void updateL1Balance(id);
    const interval = setInterval(() => void updateL1Balance(id), 15_000);
    return () => clearInterval(interval);
  }, [isWalletOnThisL1, l1.evmChainId, updateL1Balance]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-card"
    >
      {/* Layer order (back → front), all painted before the content layer
          which carries `z-10`:
            0. base                — `bg-card` on the parent
            1. conic border        — slow-rotating conic gradient that shows
                                     only as a 1px ring along the card edge
                                     (the inner mask at step 2 covers the
                                     rest). Premium-grade rotating-bezel cue.
            2. inner mask          — `bg-card` square inset by 1px, rounded
                                     to `15px` so it tracks the parent's
                                     `2xl` radius. Hides the conic except at
                                     the border.
            3. aurora drift        — large radial blob that slowly wanders
                                     diagonally across the card, painting on
                                     top of the inner mask.
            4. breathing halo      — tight bright glow centred on the logo
                                     position, opacity + scale loop.
            5. primary / secondary — static upper-left + bottom-right washes
                                     for ambient depth.
          We use inline `background: radial/conic-gradient(...)` because
          Tailwind v4's gradient utilities don't hydrate
          `--tw-gradient-stops` for our custom `bg-gradient-radial`. */}
      <motion.div
        aria-hidden="true"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute -inset-[100%] motion-reduce:!hidden"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${tint.haloColor} 30deg, transparent 90deg, transparent 210deg, ${tint.primaryColor} 270deg, transparent 330deg, transparent 360deg)`,
        }}
      />
      {/* Static fallback ring for users with reduced motion — same colours
          as the rotating layer, no spin. Only visible when the rotating
          layer is hidden by `motion-reduce:!hidden`. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden motion-reduce:block opacity-60"
        style={{
          background: `linear-gradient(135deg, ${tint.haloColor} 0%, transparent 50%, ${tint.primaryColor} 100%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-card"
      />

      <motion.div
        aria-hidden="true"
        animate={{ x: ['-12%', '18%', '-12%'], y: ['-8%', '14%', '-8%'] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-3xl mix-blend-screen motion-reduce:!translate-x-[-50%] motion-reduce:!translate-y-[-50%] motion-reduce:!transform-none"
        style={{
          background: `radial-gradient(circle, ${tint.primaryColor} 0%, transparent 60%)`,
        }}
      />
      <motion.div
        initial={{ opacity: 0.65, scale: 0.96 }}
        animate={{ opacity: [0.6, 0.95, 0.6], scale: [0.96, 1.05, 0.96] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute top-[60px] left-[60px] w-[280px] h-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl motion-reduce:!scale-100 motion-reduce:opacity-70"
        style={{
          background: `radial-gradient(circle, ${tint.haloColor} 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-24 -left-16 w-[460px] h-[460px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${tint.primaryColor} 0%, transparent 65%)`,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-20 w-[360px] h-[360px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${tint.secondaryColor} 0%, transparent 65%)`,
        }}
        aria-hidden="true"
      />

      {/* Diagonal shimmer pass — once every ~9s a 30%-wide highlight crosses
          the card from upper-left to bottom-right. Mirrors the way premium
          cards in Vercel/Linear use a single subtle reflection cue
          instead of busy continuous motion. `mix-blend-screen` keeps it
          additive so the highlight rides on top of the underlying glow
          rather than washing it out. */}
      <motion.div
        aria-hidden="true"
        animate={{ x: ['-150%', '150%'] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
        className="pointer-events-none absolute inset-y-0 w-[35%] -skew-x-12 mix-blend-screen opacity-40 motion-reduce:!hidden"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 50%, transparent)',
        }}
      />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 md:gap-8 px-5 py-5 md:px-6 md:py-6 items-center">
        <HeroIdentity l1={l1} tint={tint} health={health} />
        <HeroBalance balance={balance} coinName={l1.coinName} isOnChain={isWalletOnThisL1} />
        <HeroActions l1={l1} onRefresh={onRefresh} isRefreshing={isRefreshing} />
      </div>
    </motion.div>
  );
}

function HeroIdentity({
  l1,
  tint,
  health,
}: {
  l1: CombinedL1;
  tint: Tint;
  health: L1HealthState;
}) {
  const initial = l1.chainName?.charAt(0).toUpperCase() ?? '?';
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = l1.logoUrl && !imgFailed;

  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl shrink-0 ring-1 ring-border overflow-hidden flex items-center justify-center">
        {showImg ? (
          <img
            src={l1.logoUrl}
            alt={l1.chainName}
            className="w-full h-full object-contain p-1.5 bg-muted"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center text-2xl font-semibold',
              tint.logo,
              tint.initial,
            )}
          >
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Pill tone={l1.isTestnet ? 'testnet' : 'mainnet'}>
            {l1.isTestnet ? 'Testnet' : 'Mainnet'}
          </Pill>
          {l1.coinName && <Pill>{l1.coinName}</Pill>}
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-foreground truncate">
            {l1.chainName}
          </h1>
          <HealthPulse status={health.status} blockAgeSec={health.blockAgeSec} />
        </div>
        {l1.evmChainId !== null && (
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            Chain {l1.evmChainId}
          </p>
        )}
      </div>
    </div>
  );
}

// Status pulse dot rendered next to the chain name. Mirrors every state the
// `useL1Health` hook can return — emerald for fresh, amber for lagging
// (>2 min since last block), red for stale (>10 min) or RPC errors. The
// hover tooltip explains what each colour means and surfaces the actual
// block-age figure when available.
function HealthPulse({
  status,
  blockAgeSec,
}: {
  status: L1HealthStatus | undefined;
  blockAgeSec: number | null;
}) {
  if (!status || status === 'unknown') return null;

  const config = HEALTH_PULSE_CONFIG[status];
  const ageLabel = blockAgeSec !== null ? formatBlockAge(blockAgeSec) : null;
  const tooltipLabel = ageLabel
    ? `${config.description} · last block ${ageLabel} ago`
    : config.description;

  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <span
          className="relative flex w-2 h-2 shrink-0 cursor-help"
          aria-label={tooltipLabel}
          role="status"
        >
          {config.animatePing && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                config.dotClass,
              )}
              aria-hidden="true"
            />
          )}
          <span
            className={cn('relative inline-flex rounded-full h-2 w-2', config.dotClass)}
            aria-hidden="true"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipLabel}</TooltipContent>
    </UITooltip>
  );
}

const HEALTH_PULSE_CONFIG: Record<
  Exclude<L1HealthStatus, 'unknown'>,
  { dotClass: string; animatePing: boolean; description: string }
> = {
  healthy: {
    dotClass: 'bg-emerald-500',
    animatePing: true,
    description: 'Chain healthy — producing fresh blocks',
  },
  degraded: {
    dotClass: 'bg-amber-500',
    animatePing: true,
    description: 'Chain lagging — last block over 2 minutes ago',
  },
  stale: {
    dotClass: 'bg-red-500',
    animatePing: false,
    description: 'Chain stale — no new blocks for 10+ minutes',
  },
  offline: {
    dotClass: 'bg-red-500',
    animatePing: false,
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

function HeroBalance({
  balance,
  coinName,
  isOnChain,
}: {
  balance: number | null;
  coinName?: string;
  isOnChain: boolean;
}) {
  return (
    <div className="text-center order-3 md:order-2">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
        Balance
      </p>
      <p className="mt-1 text-xl md:text-[28px] font-semibold tracking-tight tabular-nums text-foreground leading-tight">
        {isOnChain && balance !== null ? balance.toFixed(4) : '—'}
        {isOnChain && balance !== null && coinName && (
          <span className="ml-1.5 text-xs md:text-sm font-medium text-muted-foreground">
            {coinName}
          </span>
        )}
      </p>
      {!isOnChain && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Switch your wallet to this L1 to see balance
        </p>
      )}
    </div>
  );
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
    <div className="flex items-center justify-end gap-2 md:order-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh L1 list"
      >
        <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
      </Button>
      {/* Wallet-related actions cluster together (left): the Switch Wallet
          button only renders when the wallet is on a different chain, which
          is the same context the user just used the Refresh button in.
          Create L1 sits at the far right because it's a global navigation
          action, distinct from the per-chain affordances. */}
      <WalletNetworkAction l1={l1} />
      <ExplorerMenu
        evmChainId={l1.evmChainId}
        isTestnet={l1.isTestnet}
        customExplorerUrl={l1.explorerUrl}
      />
      <CopyGenesisButton l1={l1} />
      <Link href="/console/create-l1">
        <Button size="sm">
          <Layers className="w-4 h-4 mr-1.5" />
          Create L1
        </Button>
      </Link>
    </div>
  );
}

// Copies the L1's genesis JSON to the clipboard. Source of truth is the
// wallet store's L1ListItem.genesisData, populated either by the Create L1
// wizard or by the optional paste field on the Add Chain modal. When the
// genesis isn't on file (older entries, primary network, imports without a
// pasted genesis) the button is disabled with an explanatory tooltip.
function CopyGenesisButton({ l1 }: { l1: CombinedL1 }) {
  const [copied, setCopied] = useState(false);
  const genesisData = typeof l1.genesisData === 'string' ? l1.genesisData.trim() : '';
  const hasGenesis = genesisData.length > 0;

  const handleCopy = async () => {
    if (!hasGenesis) return;
    try {
      await navigator.clipboard.writeText(genesisData);
      setCopied(true);
      toast.success('Genesis JSON copied', undefined, { id: 'copy-genesis' });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error(
        'Could not copy',
        err instanceof Error ? err.message : 'Clipboard unavailable',
        { id: 'copy-genesis' },
      );
    }
  };

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      disabled={!hasGenesis}
      aria-label={hasGenesis ? 'Copy genesis JSON' : 'Genesis JSON not available'}
    >
      {copied ? (
        <Check className="w-4 h-4 mr-1.5 text-emerald-500" />
      ) : (
        <Copy className="w-4 h-4 mr-1.5" />
      )}
      Copy Genesis
    </Button>
  );

  if (hasGenesis) return button;

  // Wrap the disabled button in a focusable span — without it the tooltip
  // never opens, since `disabled` removes the button from the focus order
  // and pointer events bypass the trigger in some browsers.
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px]">
        Genesis JSON not stored for this L1. Re-add the chain from the Add
        Chain modal and paste the genesis to enable copy.
      </TooltipContent>
    </UITooltip>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'testnet' | 'mainnet';
}) {
  const toneClass =
    tone === 'testnet'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
      : tone === 'mainnet'
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
        : 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        toneClass,
      )}
    >
      {children}
    </span>
  );
}
