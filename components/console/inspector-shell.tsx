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
  /** Optional DOM id for anchoring/scroll targeting. */
  id?: string;
}

/**
 * Lean inspector frame shared across the console step flows. The phase/step
 * title and status are already conveyed by the StepFlow nav strip, so this
 * component is just a focused card with optional banner / footer slots
 * wrapping the active form.
 */
export function InspectorShell({ children, footer, banner, className, id }: InspectorShellProps) {
  return (
    <article
      id={id}
      className={cn(
        'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      {banner && <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">{banner}</div>}
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          {footer}
        </footer>
      )}
    </article>
  );
}
