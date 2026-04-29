'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Check, CheckCircle2, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWalletSwitch } from '@/components/toolbox/hooks/useWalletSwitch';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';

// Inline "next step" hero — surfaces the single most important action a user
// can take right now. Hidden when the L1 is fully configured (the
// SetupCompleteBadge takes its place). The whole row is one Link so there's
// only one focus target / tap target.
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
  const needsSwitch =
    l1.evmChainId !== null && walletChainId !== 0 && walletChainId !== l1.evmChainId;

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!needsSwitch || isSwitching || l1.evmChainId === null) return;
    e.preventDefault();
    setIsSwitching(true);
    try {
      await safelySwitch(l1.evmChainId, l1.isTestnet);
      router.push(nextStep.href);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch network';
      toast.error('Network switch failed', msg);
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
      className="group flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.1] transition-colors px-4 py-3.5"
    >
      <div
        className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center"
        aria-hidden="true"
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Needs attention · {done}/{steps.length} complete
        </p>
        <p className="text-base font-semibold text-foreground truncate">{nextStep.shortLabel}</p>
      </div>
      <span
        className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:translate-x-0.5 transition-transform"
        aria-hidden="true"
      >
        {ctaLabel}
        {isSwitching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
      </span>
    </Link>
  );
}

// Slim "all done" pill that takes the place of the SetupProgressCard once
// every step is completed. Avoids the noisy 5-row checklist when there's
// nothing left to act on.
export function SetupCompleteBadge({ stepCount }: { stepCount: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/30 text-sm">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className="font-medium text-emerald-900 dark:text-emerald-200">L1 fully configured</span>
      <span className="text-emerald-800/70 dark:text-emerald-200/60 hidden sm:inline">
        All {stepCount} setup steps complete.
      </span>
    </div>
  );
}

export function SetupProgressCard({
  l1,
  fullWidth = false,
}: {
  l1: CombinedL1;
  fullWidth?: boolean;
}) {
  const { steps, done, pct } = setupSummary(l1);

  return (
    <Card className={cn(fullWidth ? '' : 'lg:col-span-1')}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Setup progress
          </CardTitle>
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {done}/{steps.length} · {pct}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          />
        </div>
        <ol
          className={cn(
            'space-y-1',
            fullWidth && 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 space-y-0',
          )}
        >
          {steps.map((s, i) => {
            const nextUp = !s.completed && i === done;
            return (
              <li key={s.key}>
                <Link href={s.href} className="group block">
                  <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0',
                        s.completed
                          ? 'bg-emerald-500 text-white'
                          : nextUp
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {s.completed ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        'flex-1 text-sm truncate',
                        s.completed
                          ? 'text-muted-foreground'
                          : nextUp
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground',
                      )}
                    >
                      {s.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
