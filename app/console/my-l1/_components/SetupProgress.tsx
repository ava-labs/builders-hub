'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardHeader } from '@/components/explorer-v2/ui';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWalletSwitch } from '@/components/toolbox/hooks/useWalletSwitch';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { setupSummary } from '@/lib/console/my-l1/setup-steps';
import { COUNT, FRAME, NOTICE_WARN } from './chrome';

// Inline "next step" hero — surfaces the single most important action a user
// can take right now. Hidden when the L1 is fully configured (the green
// "Fully configured" SetupStatusPill takes its place).
// The whole row is one Link so there's only one focus target / tap target.
//
// When the connected wallet isn't on this L1's chain, the click handler
// triggers the wallet switch first, then navigates. The destination setup
// pages (e.g. /console/icm/setup) need the wallet on the right chain to
// sign the deploy tx — having the user click → switch → click again was
// the friction point flagged in the screenshot review.
export function NextActionBar({ l1 }: { l1: CombinedL1 }) {
  const { nextStep, done, steps } = setupSummary(l1);
  const router = useRouter();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const { safelySwitch } = useWalletSwitch();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!nextStep) return null;
  const Icon = nextStep.icon;

  // Skip the switch gate when we don't know the chain id yet (wallet store
  // still hydrating → walletChainId === 0) or when the L1 has no EVM chain
  // (we can't switch to it).
  const needsSwitch = l1.evmChainId !== null && walletChainId !== 0 && walletChainId !== l1.evmChainId;

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!needsSwitch || isSwitching || l1.evmChainId === null) return;
    e.preventDefault();
    await runSwitchAndNavigate();
  };

  // Extracted so the error-toast Retry action can re-fire the same flow
  // without us needing access to the click event.
  const runSwitchAndNavigate = async () => {
    if (l1.evmChainId === null || !nextStep) return;
    setIsSwitching(true);
    try {
      await safelySwitch(l1.evmChainId, l1.isTestnet);
      router.push(nextStep.href);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch network';
      toast.error('Network switch failed', msg, {
        id: `setup-switch:${l1.evmChainId}`,
        action: { label: 'Retry', onClick: () => void runSwitchAndNavigate() },
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const ctaLabel = isSwitching
    ? 'Switching…'
    : needsSwitch
      ? `Switch & ${nextStep.ctaLabel.toLowerCase()}`
      : nextStep.ctaLabel;

  return (
    <Link
      href={nextStep.href}
      onClick={handleClick}
      aria-label={
        needsSwitch
          ? `Switch wallet to ${l1.chainName} and start: ${nextStep.shortLabel}. ${done} of ${steps.length} complete.`
          : `Next setup step: ${nextStep.shortLabel}. ${done} of ${steps.length} complete.`
      }
      aria-busy={isSwitching}
      className={cn(
        NOTICE_WARN,
        'group/next flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:border-amber-500 dark:hover:border-amber-600',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] tabular-nums text-amber-800 dark:text-amber-300">
          Needs attention · {done}/{steps.length} complete
        </p>
        <p className="mt-1 truncate text-[15px] font-semibold text-zinc-900 underline-offset-4 group-hover/next:underline dark:text-zinc-50">
          {nextStep.shortLabel}
        </p>
      </div>
      <span
        className="inline-flex h-9 shrink-0 items-center gap-2 border border-zinc-900 bg-zinc-900 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors group-hover/next:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:group-hover/next:bg-zinc-300"
        aria-hidden="true"
      >
        {ctaLabel}
        {isSwitching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/next:translate-x-0.5" />
        )}
      </span>
    </Link>
  );
}

export function SetupProgressCard({ l1, fullWidth = false }: { l1: CombinedL1; fullWidth?: boolean }) {
  const { steps, done, pct } = setupSummary(l1);

  return (
    <div className={cn(FRAME, fullWidth ? '' : 'lg:col-span-1')}>
      <BoardHeader
        display
        label="Setup progress"
        action={
          <span className={COUNT}>
            {done}/{steps.length} · {pct}%
          </span>
        }
      />
      <div className="h-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <motion.div
          // Animate via `scaleX` (a transform) instead of `width` so
          // the browser can keep the bar on the compositor thread —
          // width changes force a paint on every frame of the spring.
          className="h-full origin-left bg-zinc-900 dark:bg-zinc-100"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          style={{ width: '100%' }}
        />
      </div>
      <ol
        className={cn(
          'divide-y divide-zinc-200 dark:divide-zinc-800',
          fullWidth && 'grid grid-cols-1 md:grid-cols-2 md:divide-y-0',
        )}
      >
        {steps.map((s, i) => {
          const nextUp = !s.completed && i === done;
          return (
            <li key={s.key}>
              <Link href={s.href} className="group/row flex items-center gap-3 px-5 py-2.5">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] font-bold tabular-nums',
                    s.completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : nextUp
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500',
                  )}
                >
                  {s.completed ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'flex-1 truncate text-[13.5px] underline-offset-4 group-hover/row:underline',
                    nextUp ? 'font-medium text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  {s.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
