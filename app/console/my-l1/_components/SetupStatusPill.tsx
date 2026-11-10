'use client';

import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isPrimaryNetwork, type CombinedL1 } from '@/lib/console/my-l1/types';
import { setupSummary } from '@/lib/console/my-l1/setup-steps';
import { SetupProgressCard } from './SetupProgress';

// Setup status pill rendered next to the NextActionBar above NetworkDetailsCard.
// When complete it's a flat green "Fully configured" chip; when not complete
// it's an amber popover trigger with an inline progress bar — clicking it
// surfaces the full checklist without claiming permanent vertical space on
// the dashboard. Returns null for the Primary Network since setup steps
// don't apply.
export function SetupStatusPill({ l1 }: { l1: CombinedL1 }) {
  if (isPrimaryNetwork(l1)) return null;

  const { steps, done, pct, nextStep } = setupSummary(l1);
  const isComplete = pct === 100;

  if (isComplete) {
    return (
      <span
        className="inline-flex h-9 items-center gap-1.5 border border-emerald-300 bg-emerald-50 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300"
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
          className="inline-flex h-9 cursor-pointer items-center gap-2.5 border border-amber-300 bg-amber-50 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800 transition-colors hover:border-amber-500 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-600"
        >
          <span className="tabular-nums">
            {done}/{steps.length} configured
          </span>
          <span
            className="relative block h-1 w-12 overflow-hidden bg-amber-200 dark:bg-amber-900/60"
            aria-hidden="true"
          >
            <span className="block h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(420px,90vw)] rounded-none border-0 bg-white p-0 shadow-xl dark:bg-zinc-950"
      >
        <SetupProgressCard l1={l1} />
      </PopoverContent>
    </Popover>
  );
}
