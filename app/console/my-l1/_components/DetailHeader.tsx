'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/lib/toast';
import type { L1HealthState, L1HealthStatus } from '@/hooks/useL1Health';
import { isPrimaryNetwork, type CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';
import { validatorManagerKindLabel } from '../_lib/validator-manager-routing';
import type { L1ValidatorManagerInfo } from '../_lib/useL1ValidatorManager';
import { WalletNetworkAction } from './WalletNetworkAction';
import { SetupProgressCard } from './SetupProgress';

export function DetailHeader({
  l1,
  health,
  validatorManager,
}: {
  l1: CombinedL1;
  health?: L1HealthState;
  validatorManager?: L1ValidatorManagerInfo;
}) {
  const nodeCount = l1.nodes?.length ?? 0;
  // Show wallet balance only when the wallet is currently connected to this
  // L1 — otherwise the cached number in the store may be from a different
  // chain and would mislead. Reading via a selector to avoid re-rendering
  // when unrelated balances change.
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const balance = useWalletStore((s) =>
    l1.evmChainId !== null && walletChainId === l1.evmChainId
      ? s.balances.l1Chains[String(l1.evmChainId)] ?? null
      : null,
  );
  const isWalletOnThisL1 = l1.evmChainId !== null && walletChainId === l1.evmChainId;
  const updateL1Balance = useWalletStore((s) => s.updateL1Balance);

  // Poll the L1 balance every 15s while the wallet is on this chain so
  // the displayed number stays in sync with on-chain reality. Without
  // this, the wallet store only refreshes balances on explicit user
  // actions (e.g. after a TX through the toolbox), so a user that
  // spends ALOT in another tab sees a stale figure on the dashboard.
  // The balance service debounces internally so the trailing-edge
  // refresh from the previous interval doesn't pile up.
  useEffect(() => {
    if (!isWalletOnThisL1 || l1.evmChainId === null) return;
    const chainIdStr = String(l1.evmChainId);
    void updateL1Balance(chainIdStr);
    const id = setInterval(() => {
      void updateL1Balance(chainIdStr);
    }, 15_000);
    return () => clearInterval(id);
  }, [isWalletOnThisL1, l1.evmChainId, updateL1Balance]);

  // First letter of chain name, used as a fallback avatar when no logoUrl.
  // Stable hash of subnetId picks one of a few neutral hues so different
  // L1s look distinct without us picking a color per chain by hand.
  const initial = l1.chainName?.charAt(0).toUpperCase() ?? '?';
  const fallbackTint = pickFallbackTint(l1.subnetId);

  // Status pulse dot next to the chain name. Reflects every state the
  // health hook can report — green when fresh, amber when blocks are
  // lagging (≤10 min), red when the chain has gone dark or the RPC is
  // unreachable. Hidden only when health hasn't sampled yet (`unknown`).
  const status = health?.status;

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="flex items-center gap-3.5 min-w-0">
        <ChainLogo
          logoUrl={l1.logoUrl}
          chainName={l1.chainName}
          initial={initial}
          fallbackTint={fallbackTint}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground truncate">
              {l1.chainName}
            </h2>
            <HealthPulse status={status} blockAgeSec={health?.blockAgeSec ?? null} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {l1.evmChainId !== null && <MetaPill>Chain {l1.evmChainId}</MetaPill>}
            <MetaPill tone={l1.isTestnet ? 'testnet' : 'mainnet'}>
              {l1.isTestnet ? 'Testnet' : 'Mainnet'}
            </MetaPill>
            {l1.source === 'managed' && nodeCount > 0 && (
              <MetaPill>
                {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
              </MetaPill>
            )}
            {/* Source pill hides when wallet is active here — the
                "Wallet active" pill below already implies the L1 is
                in the user's wallet, so showing both reads as repetition. */}
            {l1.source === 'wallet' && !isWalletOnThisL1 && !isPrimaryNetwork(l1) && (
              <MetaPill>Wallet</MetaPill>
            )}
            {validatorManager?.kind && (
              <MetaPill tone={validatorManager.kind === 'poa' ? 'subtleAmber' : 'subtleEmerald'}>
                {validatorManagerKindLabel(validatorManager.kind)}
              </MetaPill>
            )}
            {l1.coinName && <MetaPill>{l1.coinName}</MetaPill>}
            {/* Explicit positive signal that the wallet is on this chain.
                Without it the only cue was the absence of the "Switch
                Wallet" button in the actions row — easy to miss. */}
            {isWalletOnThisL1 && (
              <MetaPill tone="walletActive">
                <span className="flex items-center gap-1">
                  <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping [animation-duration:2.4s]" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Wallet active
                </span>
              </MetaPill>
            )}
            {!isPrimaryNetwork(l1) && <SetupStatusPill l1={l1} />}
          </div>
          {isWalletOnThisL1 && balance !== null && (
            <p className="text-sm text-foreground mt-1.5">
              <span className="text-muted-foreground">Balance:</span>{' '}
              <span className="font-mono tabular-nums">
                {balance.toFixed(4)} {l1.coinName ?? ''}
              </span>
            </p>
          )}
        </div>
      </div>
      {/* min-h-10 (40px) on mobile keeps the row buttons inside touch-target
          range without enlarging them on desktop where they pack tighter. */}
      <div className="flex flex-wrap gap-2 shrink-0 [&>*]:min-h-10 md:[&>*]:min-h-0">
        {/* Primary action when the wallet isn't on this L1. Renders nothing
            otherwise — replaces the old full-width banner. */}
        <WalletNetworkAction l1={l1} />
        <ExplorerMenu
          evmChainId={l1.evmChainId}
          isTestnet={l1.isTestnet}
          customExplorerUrl={l1.explorerUrl}
        />
        <CopyChainConfigButton l1={l1} />
      </div>
    </div>
  );
}

// Copies the L1's wagmi/viem-friendly chain config as JSON. Handy when the
// user wants to plug the L1 into another tool (Hardhat, Foundry, a custom
// dApp) without retyping the RPC URL + chain ID + native currency by hand.
function CopyChainConfigButton({ l1 }: { l1: CombinedL1 }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const config = {
      chainId: l1.evmChainId,
      chainName: l1.chainName,
      rpcUrls: [l1.rpcUrl],
      nativeCurrency: l1.coinName
        ? { name: l1.coinName, symbol: l1.coinName, decimals: 18 }
        : undefined,
      blockExplorerUrls: l1.explorerUrl ? [l1.explorerUrl] : undefined,
      subnetId: l1.subnetId,
      blockchainId: l1.blockchainId,
      isTestnet: l1.isTestnet,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      // Same id across rapid clicks — replaces the previous toast
      // instead of stacking. Tighter copy too: paste-target hint
      // belongs in the (i) tooltip on the button, not a toast.
      toast.success('Chain config copied', undefined, { id: 'copy-chain-config' });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error(
        'Could not copy',
        err instanceof Error ? err.message : 'Clipboard unavailable',
        { id: 'copy-chain-config' },
      );
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
      Copy Config
    </Button>
  );
}

// Status pulse dot rendered next to the chain name. Mirrors every state
// the `useL1Health` hook can return — emerald for fresh, amber for
// lagging (>2 min since last block), red for stale (>10 min) or RPC
// errors. The hover tooltip explains what each color means and surfaces
// the actual block-age figure when available.
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
  // Compose the hover hint by joining the static description with a live
  // block-age suffix when we have one. "Chain healthy · last block 12s ago"
  // reads cleaner than two separate lines.
  const tooltipLabel = ageLabel ? `${config.description} · last block ${ageLabel} ago` : config.description;

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
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${config.dotClass}`}
              aria-hidden="true"
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`}
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

// Setup status pill rendered inline in the meta row. Replaces the old
// SetupCompleteBadge / SetupProgressCard that took a full row at the top
// of the page. When complete it's a flat green "Fully configured" pill;
// when not complete it's an amber popover trigger with an inline
// progress bar — clicking it surfaces the full checklist without claiming
// permanent vertical space on the dashboard.
function SetupStatusPill({ l1 }: { l1: CombinedL1 }) {
  const { steps, done, pct, nextStep } = setupSummary(l1);
  const isComplete = pct === 100;

  if (isComplete) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
        aria-label="L1 fully configured"
      >
        <Check className="w-3 h-3" aria-hidden="true" />
        Fully configured
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            nextStep
              ? `Configuration ${done} of ${steps.length} complete. Next step: ${nextStep.shortLabel}. Click to view checklist.`
              : `Configuration ${done} of ${steps.length} complete. Click to view checklist.`
          }
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 hover:border-amber-500/60 hover:shadow-sm transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          <span>
            {done}/{steps.length} configured
          </span>
          <span
            className="relative block h-1 w-12 rounded-full bg-amber-500/20 overflow-hidden"
            aria-hidden="true"
          >
            <span
              className="block h-full bg-amber-500 transition-all"
              style={{ width: `${pct}%` }}
            />
            {/* Slow shimmer pass — subtle reminder that this is actionable. */}
            <span
              className="absolute inset-0 animate-shimmer-sweep"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              }}
            />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,90vw)] p-0 border-0 shadow-lg">
        <SetupProgressCard l1={l1} />
      </PopoverContent>
    </Popover>
  );
}

// Compact metadata chip — replaces the old dot-separated "Chain ID: 836504 ·
// Testnet · Wallet" text line. Each fact gets its own pill so the eye can
// scan them faster, and Testnet/Mainnet picks up an accent color (amber for
// testnet, emerald for mainnet) matching the conventional "warning vs.
// production" palette used elsewhere in the console.
function MetaPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'testnet' | 'mainnet' | 'walletActive' | 'subtleAmber' | 'subtleEmerald';
}) {
  const toneClass =
    tone === 'testnet'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
      : tone === 'mainnet'
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
        : tone === 'walletActive'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
          : tone === 'subtleAmber'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
            : tone === 'subtleEmerald'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

// Compact chain avatar: tries the wallet-provided logoUrl, falls back to a
// tinted initial when the logo is missing or 404s. Lifts the page header
// from "small icon next to text" to a real visual anchor without needing
// every L1 to have a logo asset.
function ChainLogo({
  logoUrl,
  chainName,
  initial,
  fallbackTint,
}: {
  logoUrl?: string;
  chainName: string;
  initial: string;
  fallbackTint: { bg: string; text: string };
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = logoUrl && !imgFailed;
  return (
    <div
      className="w-11 h-11 rounded-xl shrink-0 ring-1 ring-border bg-muted flex items-center justify-center overflow-hidden"
      aria-hidden={showImg ? undefined : true}
    >
      {showImg ? (
        <img
          src={logoUrl}
          alt={chainName}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center text-base font-semibold ${fallbackTint.bg} ${fallbackTint.text}`}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

// Tiny stable hash → pick one of 5 tinted gradients for the fallback avatar.
// Different L1s read as different swatches without us spending design
// energy on per-chain branding. The diagonal gradient (top-left → bottom-
// right) gives the disc a hint of depth so it doesn't read as a flat
// monochrome circle.
const FALLBACK_TINTS = [
  {
    bg: 'bg-gradient-to-br from-rose-500/15 to-rose-500/[0.04] dark:from-rose-500/20 dark:to-rose-500/[0.06]',
    text: 'text-rose-700 dark:text-rose-300',
  },
  {
    bg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/[0.04] dark:from-emerald-500/20 dark:to-emerald-500/[0.06]',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    bg: 'bg-gradient-to-br from-sky-500/15 to-sky-500/[0.04] dark:from-sky-500/20 dark:to-sky-500/[0.06]',
    text: 'text-sky-700 dark:text-sky-300',
  },
  {
    bg: 'bg-gradient-to-br from-amber-500/15 to-amber-500/[0.04] dark:from-amber-500/20 dark:to-amber-500/[0.06]',
    text: 'text-amber-700 dark:text-amber-300',
  },
  {
    bg: 'bg-gradient-to-br from-violet-500/15 to-violet-500/[0.04] dark:from-violet-500/20 dark:to-violet-500/[0.06]',
    text: 'text-violet-700 dark:text-violet-300',
  },
];

function pickFallbackTint(seed: string): (typeof FALLBACK_TINTS)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length];
}
