'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InspectorShellProps {
  children: ReactNode;
  /** Footer slot (e.g. primary submit button). */
  footer?: ReactNode;
  /** Optional banner above the form (errors, precompile gates, prerequisites). */
  banner?: ReactNode;
  className?: string;
}

/**
 * Lean inspector frame. The phase title and status are already conveyed by
 * the StepFlow nav strip, so this component is just a focused card with
 * optional banner / footer slots wrapping the active form.
 */
export function InspectorShell({ children, footer, banner, className }: InspectorShellProps) {
  return (
    <article
      id="ictt-inspector"
      className={cn(
        'rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {banner && <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800/80">{banner}</div>}
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800/80">
          {footer}
        </footer>
      )}
    </article>
  );
}
