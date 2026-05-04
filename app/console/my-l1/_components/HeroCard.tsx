'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { Layers, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { cn } from '@/lib/utils';
import type { L1HealthState, L1HealthStatus } from '@/hooks/useL1Health';
import type { CombinedL1 } from '../_lib/types';
import { WalletNetworkAction } from './WalletNetworkAction';

// Each tint stores three triplets:
//   - `rgb`         the brand-strength chain colour, used by every layer
//                   on dark backgrounds where additive light on near-black
//                   produces deep saturation regardless.
//   - `rgbSoft`     a brighter complement for the secondary glow on dark.
//   - `rgbDeep`     a *darker* shade of the same hue (~700-shade Tailwind).
//                   Used by the left-side atmosphere wash on light
//                   backgrounds: red-500 at α 0.4 over white reads as
//                   pastel pink, but red-700 at the same alpha lands as
//                   visible coral. Same hue, more pigment, less powder.
type Tint = {
  logo: string;
  rgb: string;
  rgbSoft: string;
  rgbDeep: string;
  initial: string;
};

const FALLBACK_TINTS: readonly Tint[] = [
  { logo: 'bg-rose-500',    rgb: '244, 63, 94',   rgbSoft: '251, 113, 133', rgbDeep: '159, 18, 57',  initial: 'text-white' },
  { logo: 'bg-emerald-500', rgb: '16, 185, 129',  rgbSoft: '52, 211, 153',  rgbDeep: '4, 120, 87',   initial: 'text-white' },
  { logo: 'bg-sky-500',     rgb: '14, 165, 233',  rgbSoft: '56, 189, 248',  rgbDeep: '3, 105, 161',  initial: 'text-white' },
  { logo: 'bg-amber-500',   rgb: '245, 158, 11',  rgbSoft: '251, 191, 36',  rgbDeep: '180, 83, 9',   initial: 'text-white' },
  { logo: 'bg-violet-500',  rgb: '139, 92, 246',  rgbSoft: '167, 139, 250', rgbDeep: '91, 33, 182',  initial: 'text-white' },
] as const;

// Per-mode alpha targets for each gradient layer.
//
// Both modes run the *same* layer stack at the *same* alphas — what
// differs is only the blend mode. Dark uses `mix-blend-screen` against
// near-black (additive lighten); light uses `mix-blend-multiply`
// against white (subtractive darken). Since `screen` and `multiply`
// are symmetric inverses against their respective backgrounds, a
// chain colour at α 0.32 produces visually equivalent saturation in
// both modes — rich red glow on dark, rich coral wash on white.
//
// Earlier rewrites tried to "tone down" light mode by lowering alphas
// or swapping to the deeper 700-shade triplet. The result was either
// pastel watercolour or muted stain. Direct alpha parity with dark +
// the brighter `rgb` triplet (500-shade) lands the chain colour at
// the correct saturation against white.
//
// Light mode keeps two extra elements for the "card sits on a
// surface" cue that dark mode delivers naturally through deep colour
// wells: the 2px top stripe and a chain-tinted drop shadow.
const ALPHAS = {
  dark: {
    halo: 0.55,
    primary: 0.32,
    secondarySoft: 0.18,
    drift: 0.32,
    conicHalo: 0.60,
    conicPrimary: 0.40,
    shimmer: 0.40,
    topStripe: 0,
    coloredShadow: 0,
  },
  light: {
    halo: 0.55,
    primary: 0.32,
    secondarySoft: 0.18,
    drift: 0.32,
    conicHalo: 0.60,
    conicPrimary: 0.40,
    shimmer: 0.40,
    topStripe: 0.55,
    coloredShadow: 0.20,
  },
} as const;

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

  // Cursor-tracked specular highlight. We push the pointer's local position
  // into MotionValues so framer-motion writes the gradient `background`
  // directly to the DOM without re-rendering React on every mousemove.
  // `cursorActive` toggles the overlay's opacity via a CSS transition so the
  // spotlight fades cleanly on enter/leave instead of snapping in/out.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorX = useMotionValue(50);
  const cursorY = useMotionValue(50);
  const [cursorActive, setCursorActive] = useState(false);

  // Theme-aware gradient strings. We can't use Tailwind's `dark:` modifier
  // here because the colours are dynamic per chain — so resolve the theme
  // up-front and pre-compose every rgba string with the right alpha.
  // `mounted` guards against hydration mismatch: `next-themes` returns
  // undefined on the first render, so we default to dark and switch when
  // the client confirms the resolved theme.
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isLight = mounted && resolvedTheme === 'light';

  // Pre-compose gradient strings. Same layer stack in both modes,
  // identical alphas (see `ALPHAS` above), identical colour triplets.
  // The only difference between modes is the blend mode applied to
  // each layer — `screen` for dark, `multiply` for light. Symmetric.
  const palette = isLight ? ALPHAS.light : ALPHAS.dark;
  const layerRgb = tint.rgb;
  const secondaryRgb = tint.rgbSoft;

  const haloColor = `rgba(${layerRgb}, ${palette.halo})`;
  const primaryColor = `rgba(${layerRgb}, ${palette.primary})`;
  const secondaryColor = `rgba(${secondaryRgb}, ${palette.secondarySoft})`;
  const driftColor = `rgba(${layerRgb}, ${palette.drift})`;
  const conicHalo = `rgba(${layerRgb}, ${palette.conicHalo})`;
  const conicPrimary = `rgba(${layerRgb}, ${palette.conicPrimary})`;
  const shimmerAlpha = palette.shimmer;

  // Light-only chrome: chain-tinted top stripe + drop shadow. The
  // dark surface delivers these cues naturally through deep colour
  // wells; on white we paint them explicitly.
  const lightTopStripeColor = `rgba(${tint.rgbDeep}, ${ALPHAS.light.topStripe})`;
  const lightShadowColor = `rgba(${tint.rgbDeep}, ${ALPHAS.light.coloredShadow})`;

  // Cursor-tracked specular highlight is dark-mode only — `mix-blend-
  // screen` on a white surface produces nothing, and a darker spotlight
  // on white reads as a smudge rather than premium reflection.
  const cursorAlpha = 0.12;
  const cursorBackground = useMotionTemplate`radial-gradient(320px circle at ${cursorX}% ${cursorY}%, rgba(255, 255, 255, ${cursorAlpha}), transparent 65%)`;

  // Light-mode drop shadow: a soft chain-tinted bloom underneath the
  // card so it reads as "lit by the chain" from below, plus a faint
  // neutral shadow for grounding. Hover state inflates both stops.
  // Tinted shadows are explicitly OK per taste-skill ("when a shadow
  // is used, tint it to the background hue") — for a chain-coloured
  // surface, the chain hue *is* the local background.
  const lightShadowRest = `0 4px 18px -6px ${lightShadowColor}, 0 1px 2px 0 rgba(15,23,42,0.04), 0 8px 22px -8px rgba(15,23,42,0.06), inset 0 1px 0 0 rgba(255,255,255,0.6)`;
  const lightShadowHover = `0 12px 32px -8px ${lightShadowColor}, 0 2px 4px 0 rgba(15,23,42,0.05), 0 16px 36px -10px rgba(15,23,42,0.10), inset 0 1px 0 0 rgba(255,255,255,0.6)`;

  const handlePointerMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    cursorX.set(((e.clientX - rect.left) / rect.width) * 100);
    cursorY.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      onMouseEnter={() => setCursorActive(true)}
      onMouseLeave={() => setCursorActive(false)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      // Border + theme-tuned shadow give the card depth in both modes.
      // Light mode runs the inline `boxShadow` below (carries a tinted
      // bloom keyed to the chain colour); dark mode falls back to the
      // Tailwind class shadow. Shadow eases up on hover via `cursorActive`
      // — we already track it for the spotlight, so reusing avoids a
      // second hover state.
      className="relative overflow-hidden rounded-3xl border border-border bg-card ring-1 ring-zinc-900/[0.02] transition-shadow duration-300 dark:ring-white/[0.04] dark:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.20),inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.40),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      style={isLight ? { boxShadow: cursorActive ? lightShadowHover : lightShadowRest } : undefined}
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
      {/* Rotating conic gradient — runs in both modes. The inner mask
          below covers everything except a 1px ring around the card
          edge. Same layer in both modes; the colour reads against
          either backdrop because the mask isolates it to the rim. */}
      <motion.div
        aria-hidden="true"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute -inset-[100%] motion-reduce:!hidden"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${conicHalo} 30deg, transparent 90deg, transparent 210deg, ${conicPrimary} 270deg, transparent 330deg, transparent 360deg)`,
        }}
      />
      {/* Static fallback ring for reduced motion. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden motion-reduce:block opacity-60"
        style={{
          background: `linear-gradient(135deg, ${conicHalo} 0%, transparent 50%, ${conicPrimary} 100%)`,
        }}
      />
      {/* Inner mask — `bg-card` is theme-aware (white in light,
          near-black in dark), so this single element hides the conic
          inside the card edge in both modes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-card"
      />

      {/* Light-only chrome: 2px chain-coloured top stripe. */}
      {isLight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${lightTopStripeColor} 20%, ${lightTopStripeColor} 80%, transparent 100%)`,
          }}
        />
      )}

      {/* Aurora drift — slow diagonal wander. Multiply blend on light
          (subtractive: tints white toward coral); screen on dark
          (additive: tints near-black toward bright red). Symmetric. */}
      <motion.div
        aria-hidden="true"
        animate={{ x: ['-12%', '18%', '-12%'], y: ['-8%', '14%', '-8%'] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen motion-reduce:!translate-x-[-50%] motion-reduce:!translate-y-[-50%] motion-reduce:!transform-none"
        style={{
          background: `radial-gradient(circle, ${driftColor} 0%, transparent 60%)`,
        }}
      />

      {/* Breathing halo behind the logo. */}
      <motion.div
        initial={{ opacity: 0.65, scale: 0.96 }}
        animate={{ opacity: [0.6, 0.95, 0.6], scale: [0.96, 1.05, 0.96] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute top-[60px] left-[60px] w-[280px] h-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen motion-reduce:!scale-100 motion-reduce:opacity-70"
        style={{
          background: `radial-gradient(circle, ${haloColor} 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Static primary + secondary glows. Multiply on light, screen
          on dark. */}
      <div
        className="pointer-events-none absolute -top-24 -left-16 w-[460px] h-[460px] rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen"
        style={{
          background: `radial-gradient(circle, ${primaryColor} 0%, transparent 65%)`,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-20 w-[360px] h-[360px] rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen"
        style={{
          background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 65%)`,
        }}
        aria-hidden="true"
      />

      {/* Diagonal shimmer pass — once every ~9s a 30%-wide highlight
          crosses the card. White at low alpha; `screen` on dark,
          `overlay` on light so the highlight catches against the
          underlying glow rather than disappearing into the surface. */}
      <motion.div
        aria-hidden="true"
        animate={{ x: ['-150%', '150%'] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
        className="pointer-events-none absolute inset-y-0 w-[35%] -skew-x-12 mix-blend-overlay dark:mix-blend-screen motion-reduce:!hidden"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(255, 255, 255, ${shimmerAlpha * 0.5}) 50%, transparent)`,
        }}
      />

      {/* Cursor-tracked specular highlight — dark only. `mix-blend-
          screen` on white surfaces produces nothing, and a darker
          spotlight on white reads as a smudge rather than premium
          reflection. */}
      {!isLight && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-300 motion-reduce:!hidden"
          style={{ background: cursorBackground, opacity: cursorActive ? 1 : 0 }}
        />
      )}

      {/* Layout breakpoints:
          - mobile + sm + md + lg: vertical stack so the long balance
            number, multi-button action cluster, and identity row each
            get their own row with breathing room. The three-column
            layout below was previously kicking in at `md` (768px) and
            squeezing actions until the Create L1 button clipped off
            the right edge — see the user-reported responsive bug.
          - xl (1280px+): three-column row layout with identity left,
            balance centred, actions right-aligned. Picked `xl` rather
            than `lg` because the right-side action cluster runs ~500px
            (refresh + switch + explorer + copy genesis + create L1)
            and needs at least ~1200px of card width to coexist with a
            comfortable balance column. */}
      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] gap-5 xl:gap-8 px-5 py-5 xl:px-6 xl:py-6 items-center">
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
    <div className="text-left xl:text-center">
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
    <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
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
      <Link href="/console/create-l1">
        <Button size="sm">
          <Layers className="w-4 h-4 mr-1.5" />
          Create L1
        </Button>
      </Link>
    </div>
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
