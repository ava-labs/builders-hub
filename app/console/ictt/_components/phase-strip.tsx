'use client';

import { Check } from 'lucide-react';
import { cn } from '@/components/toolbox/lib/utils';
import { PHASES, type PhaseId, type PhaseStatus } from './types';

interface PhaseStripProps {
  activePhase: PhaseId;
  phaseStatus: Record<PhaseId, PhaseStatus>;
  onPhaseClick: (phase: PhaseId) => void;
}

/**
 * Bridge console's phase navigation. Visually mirrors the shared
 * `components/console/step-flow.tsx` stepper (same border / background
 * tokens, `→` separators, numbered circles, `Check` for done) so the
 * ICTT page reads as part of the console rather than a one-off design.
 *
 * The differences vs step-flow are functional, not visual:
 *   - Phase state is driven by on-chain reads (idle/active/done/blocked)
 *     rather than URL position
 *   - Blocked phases get a disabled treatment + tooltip; clicks are
 *     ignored so users can't deep-link into a phase that needs prior
 *     work first
 */
export function PhaseStrip({ activePhase, phaseStatus, onPhaseClick }: PhaseStripProps) {
  return (
    <nav className="border-b border-border bg-background px-4 md:px-6 py-3">
      <ol className="flex flex-wrap items-center justify-center gap-3 text-sm">
        {PHASES.map((phase, index) => {
          const status = phaseStatus[phase.id];
          const isActive = activePhase === phase.id;
          const isDone = status === 'done';
          const isBlocked = status === 'blocked';

          return (
            <li key={phase.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => !isBlocked && onPhaseClick(phase.id)}
                disabled={isBlocked}
                title={isBlocked ? 'Complete previous phase first' : phase.description}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : isDone
                      ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                      : 'border-border text-muted-foreground',
                  isBlocked && 'opacity-50 cursor-not-allowed',
                  !isBlocked && !isActive && 'hover:border-foreground/30 cursor-pointer',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isDone
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span>{phase.label}</span>
              </button>
              {index < PHASES.length - 1 && <span className="text-muted-foreground/50 ml-3">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
