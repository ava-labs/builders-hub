'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PHASES, type PhaseId } from './types';

interface InspectorPanelProps {
  phase: PhaseId;
  accent: string;
  title: string;
  description: string;
  meta?: string;
  primaryAction?: ReactNode;
  preflight?: ReactNode;
  /**
   * When true, shows a `⌘ Enter` / `Ctrl Enter` hint near the meta text
   * to advertise the keyboard shortcut. Inspectors that bind the
   * shortcut via `useKeyboardSubmit` should pass this so users can
   * discover it.
   */
  showSubmitShortcut?: boolean;
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
  showSubmitShortcut,
  children,
}: InspectorPanelProps) {
  const phaseObj = PHASES.find((p) => p.id === phase);
  const submitChord = useSubmitChord();

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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{meta}</span>
            {showSubmitShortcut && (
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[9px] font-mono text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                {submitChord}
              </kbd>
            )}
          </div>
          {primaryAction && <div className="flex items-center gap-2">{primaryAction}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * macOS uses Cmd; everything else uses Ctrl. Detected once at mount;
 * SSR returns the generic chord so the markup is stable until hydration.
 */
function useSubmitChord(): string {
  const [chord, setChord] = useState('Ctrl + Enter');
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
    setChord(isMac ? '⌘ Enter' : 'Ctrl + Enter');
  }, []);
  return chord;
}
