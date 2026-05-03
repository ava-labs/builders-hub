'use client';

import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isPrimaryNetwork, type CombinedL1 } from '../_lib/types';
import { setupSummary } from '../_lib/setup-steps';
import { SetupProgressCard } from './SetupProgress';

// Setup status pill rendered next to the NextActionBar above NetworkDetailsCard.
// When complete it's a flat green "Fully configured" pill; when not complete
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
