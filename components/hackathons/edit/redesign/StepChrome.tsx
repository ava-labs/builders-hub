'use client';

import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Eyebrow } from './controls';

/**
 * Header strip above the active step body: step counter, step title, and an
 * autosave status pill. Deliberately has NO "hide/show preview" toggle — the
 * preview pane is responsive and always present on wide screens.
 */
export function StepHeader({
  stepIndex,
  totalSteps,
  title,
  dirty,
  saving,
}: {
  stepIndex: number;
  totalSteps: number;
  title: string;
  dirty: boolean;
  saving: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <div className="min-w-0">
        <Eyebrow>
          Step {stepIndex + 1} of {totalSteps}
        </Eyebrow>
        <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        <span
          className={cn(
            'size-1.5 rounded-full',
            saving ? 'animate-pulse bg-sky-500' : dirty ? 'animate-pulse bg-amber-500' : 'bg-emerald-500',
          )}
        />
        {saving ? 'Saving…' : dirty ? 'Unsaved · autosaving' : 'All changes saved'}
      </span>
    </div>
  );
}

/** Previous / Next navigation pinned under the step body. */
export function StepFooter({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <button
        type="button"
        onClick={onPrev}
        disabled={index === 0}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" /> Previous
      </button>
      <Eyebrow>
        {index + 1} of {total}
      </Eyebrow>
      <button
        type="button"
        onClick={onNext}
        disabled={index === total - 1}
        className="inline-flex items-center gap-2 rounded-lg bg-[#D66666] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c25555] disabled:pointer-events-none disabled:opacity-40"
      >
        Next step <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
