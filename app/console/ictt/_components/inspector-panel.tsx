'use client';

import type { ReactNode } from 'react';
import { PHASES, type PhaseId } from './types';

interface InspectorPanelProps {
  phase: PhaseId;
  accent: string;
  title: string;
  description: string;
  meta?: string;
  primaryAction?: ReactNode;
  preflight?: ReactNode;
  children: ReactNode;
}

/**
 * Container for phase-specific contextual content. Replaces the wall-of-
 * fields in each step of the old wizard with a focused 2-4 field form.
 *
 * The phase-specific body is passed as `children`; per-phase modules in
 * `./inspectors/` provide the form fields and wire `primaryAction` to
 * the corresponding contract hook. `preflight` slot renders chain-
 * mismatch / precompile warnings above the form body.
 *
 * No close (×) button — the phase strip is the navigation surface;
 * a redundant close that often resolves to a no-op was confusing.
 */
export function InspectorPanel({
  phase,
  accent,
  title,
  description,
  meta,
  primaryAction,
  preflight,
  children,
}: InspectorPanelProps) {
  const phaseObj = PHASES.find((p) => p.id === phase);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accent }}>
            {phaseObj?.label ?? phase}
          </span>
        </div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">{description}</p>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
        {preflight}
        {children}
      </div>

      {(meta || primaryAction) && (
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30 flex-shrink-0 gap-3">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{meta}</span>
          {primaryAction && <div className="flex items-center gap-2">{primaryAction}</div>}
        </div>
      )}
    </div>
  );
}
