'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Sticky action bar pinned to the bottom of the form pane. Dark in both themes
 * (an "emphasis" surface that doesn't shift with the page background). Houses
 * Discard / Save draft / Publish; Publish is gated by step readiness.
 */
export default function SaveBar({
  dirty,
  saving,
  allReady,
  isPublic,
  incompleteCount,
  onDiscard,
  onSaveDraft,
  onPublish,
}: {
  dirty: boolean;
  saving: boolean;
  allReady: boolean;
  isPublic: boolean;
  incompleteCount: number;
  onDiscard: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}): React.JSX.Element {
  const status = saving
    ? 'Saving changes…'
    : dirty
      ? 'You have unsaved changes'
      : isPublic
        ? 'Published · all changes saved'
        : 'Draft saved';

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl justify-center px-4">
      <div className="pointer-events-auto flex w-full items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-zinc-100 shadow-xl ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            saving ? 'animate-pulse bg-sky-400' : dirty ? 'animate-pulse bg-amber-400' : isPublic ? 'bg-emerald-400' : 'bg-zinc-500',
          )}
        />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-medium">{status}</span>
          {dirty && !allReady && (
            <span className="ml-1 hidden text-zinc-400 sm:inline">
              · {incompleteCount} step{incompleteCount === 1 ? '' : 's'} left before publishing
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || saving}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!dirty || saving}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={!allReady || saving}
          title={!allReady ? 'Complete all steps to publish' : undefined}
          className="rounded-lg bg-[#D66666] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#c25555] disabled:pointer-events-none disabled:opacity-40"
        >
          {isPublic ? 'Update' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
