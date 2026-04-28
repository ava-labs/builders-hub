'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';

// Inline "next step" hero — surfaces the single most important action a user
// can take right now. Hidden when the L1 is fully configured (the
// SetupCompleteBadge takes its place). The whole row is one Link so there's
// only one focus target / tap target.
export function NextActionBar({ l1 }: { l1: CombinedL1 }) {
  const { nextStep, done, steps } = setupSummary(l1);
  if (!nextStep) return null;
  const Icon = nextStep.icon;
  return (
    <Link
      href={nextStep.href}
      className="group flex items-center gap-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors px-4 py-3.5"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Next step · {done}/{steps.length} complete
        </p>
        <p className="text-base font-semibold text-foreground truncate">{nextStep.shortLabel}</p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:translate-x-0.5 transition-transform">
        {nextStep.ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

// Slim "all done" pill that takes the place of the SetupProgressCard once
// every step is completed. Avoids the noisy 5-row checklist when there's
// nothing left to act on.
export function SetupCompleteBadge() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/30 text-sm">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className="font-medium text-emerald-900 dark:text-emerald-200">L1 fully configured</span>
      <span className="text-emerald-800/70 dark:text-emerald-200/60 hidden sm:inline">
        All 5 setup steps complete.
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
        <CardDescription>Complete these steps to fully configure your L1</CardDescription>
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
