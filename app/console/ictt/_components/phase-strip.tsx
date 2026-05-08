'use client';

import { Check } from 'lucide-react';
import { cn } from '@/components/toolbox/lib/utils';
import { PHASES, type PhaseId, type PhaseStatus } from './types';

interface PhaseStripProps {
  activePhase: PhaseId;
  phaseStatus: Record<PhaseId, PhaseStatus>;
  onPhaseClick: (phase: PhaseId) => void;
  accent: string;
}

/**
 * Top-of-page phase strip. Replaces `step-flow.tsx` for ICTT only — the
 * generic stepper still powers 50+ other console flows.
 *
 * Phases render as pills connected by 1px lines. Active pill takes the
 * accent color. Done pills are emerald with a check icon. Blocked pills
 * are grayed out and disabled. Connector color reflects the *previous*
 * phase's done-ness.
 */
export function PhaseStrip({ activePhase, phaseStatus, onPhaseClick, accent }: PhaseStripProps) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 md:px-6 py-3">
      <div className="flex items-center gap-1 md:gap-2 overflow-x-auto">
        {PHASES.map((phase, index) => {
          const status = phaseStatus[phase.id];
          const isActive = activePhase === phase.id;
          const isDone = status === 'done';
          const isBlocked = status === 'blocked';
          const previousDone = index === 0 || phaseStatus[PHASES[index - 1].id] === 'done';

          return (
            <div key={phase.id} className="flex items-center flex-shrink-0">
              <button
                type="button"
                onClick={() => !isBlocked && onPhaseClick(phase.id)}
                disabled={isBlocked}
                title={isBlocked ? `Complete previous phase first` : phase.description}
                style={isActive && !isDone ? { background: accent, borderColor: accent, color: '#fff' } : undefined}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
                  isActive && !isDone && 'shadow-sm',
                  isDone &&
                    'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300',
                  !isActive &&
                    !isDone &&
                    !isBlocked &&
                    'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 cursor-pointer',
                  isBlocked &&
                    'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-600',
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold',
                    isDone && 'bg-white/40 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
                    isActive && !isDone && 'bg-white/25',
                    !isActive &&
                      !isDone &&
                      !isBlocked &&
                      'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
                    isBlocked && 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600',
                  )}
                >
                  {isDone ? <Check className="w-3 h-3" strokeWidth={2.5} /> : index + 1}
                </span>
                <span>{phase.label}</span>
              </button>
              {index < PHASES.length - 1 && (
                <div
                  className={cn(
                    'mx-1 md:mx-2 w-4 md:w-8 h-px',
                    previousDone ? 'bg-emerald-300 dark:bg-emerald-800' : 'bg-zinc-200 dark:bg-zinc-800',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
