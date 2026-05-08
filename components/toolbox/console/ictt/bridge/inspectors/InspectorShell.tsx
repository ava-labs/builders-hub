'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRIDGE_PHASE_ORDER, PHASE_DESCRIPTION, PHASE_LABEL, type BridgePhase, type BridgeStatus } from '../types';

export interface InspectorShellProps {
  phase: BridgePhase;
  status: BridgeStatus;
  onPhaseChange: (next: BridgePhase) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Footer slot (e.g., primary submit button + secondary actions). */
  footer?: ReactNode;
  /** Optional banner above the form (errors, precompile gates). */
  banner?: ReactNode;
  className?: string;
}

const STATUS_PILL: Record<BridgeStatus, { label: string; tone: string }> = {
  idle: { label: 'Not started', tone: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  'in-progress': {
    label: 'In progress',
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  },
  complete: {
    label: 'Complete',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
  error: { label: 'Error', tone: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
};

export function InspectorShell({
  phase,
  status,
  onPhaseChange,
  title,
  description,
  children,
  footer,
  banner,
  className,
}: InspectorShellProps) {
  const phaseIndex = BRIDGE_PHASE_ORDER.indexOf(phase);
  const prevPhase = phaseIndex > 0 ? BRIDGE_PHASE_ORDER[phaseIndex - 1] : null;
  const nextPhase = phaseIndex < BRIDGE_PHASE_ORDER.length - 1 ? BRIDGE_PHASE_ORDER[phaseIndex + 1] : null;
  const pill = STATUS_PILL[status];

  return (
    <article
      id="ictt-inspector"
      aria-labelledby="ictt-inspector-title"
      className={cn(
        'rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800/80">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Phase {phaseIndex + 1} of {BRIDGE_PHASE_ORDER.length} · {PHASE_LABEL[phase]}
          </span>
          <h2
            id="ictt-inspector-title"
            tabIndex={-1}
            className="text-lg font-semibold text-zinc-900 outline-none dark:text-zinc-100"
          >
            {title ?? PHASE_DESCRIPTION[phase]}
          </h2>
          {description && (
            <p className="max-w-2xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
        </div>
        <span
          className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', pill.tone)}
        >
          {pill.label}
        </span>
      </header>

      {banner && <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800/80">{banner}</div>}

      <div className="px-5 py-4">{children}</div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevPhase}
            onClick={() => prevPhase && onPhaseChange(prevPhase)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              prevPhase
                ? 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60'
                : 'cursor-not-allowed text-zinc-400 dark:text-zinc-600',
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {prevPhase ? PHASE_LABEL[prevPhase] : 'Back'}
          </button>
          <button
            type="button"
            disabled={!nextPhase}
            onClick={() => nextPhase && onPhaseChange(nextPhase)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              nextPhase
                ? 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60'
                : 'cursor-not-allowed text-zinc-400 dark:text-zinc-600',
            )}
          >
            {nextPhase ? PHASE_LABEL[nextPhase] : 'Done'}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {footer && <div className="flex items-center gap-2">{footer}</div>}
      </footer>
    </article>
  );
}
