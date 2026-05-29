'use client';

import React from 'react';
import {
  Check,
  Compass,
  Copy,
  Layers,
  LayoutGrid,
  Library,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Eyebrow } from './controls';
import type { StepDef, StepId } from './step-config';

const ICONS = {
  compass: Compass,
  sparkles: Sparkles,
  users: Users,
  library: Library,
  layout: LayoutGrid,
  layers: Layers,
} as const;

/**
 * Left rail for the redesigned editor: editable title, type/format meta, a
 * setup-progress bar, the vertical step list with readiness state, and a
 * footer with duplicate / delete actions.
 */
export default function StepSidebar({
  steps,
  activeStep,
  onSelectStep,
  ready,
  readyCount,
  total,
  pct,
  title,
  onTitleChange,
  eventType,
  format,
  isDraft,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  steps: StepDef[];
  activeStep: StepId;
  onSelectStep: (id: StepId) => void;
  ready: Record<StepId, boolean>;
  readyCount: number;
  total: number;
  pct: number;
  title: string;
  onTitleChange: (value: string) => void;
  eventType: string;
  format?: string;
  isDraft: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}): React.JSX.Element {
  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <Eyebrow>Editing</Eyebrow>
          {isDraft && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Draft
            </span>
          )}
        </div>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled event"
          className="mt-1 w-full bg-transparent text-base font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <div className="mt-1 flex items-center gap-2">
          <Eyebrow>{eventType || 'event'}</Eyebrow>
          {format && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <Eyebrow>{format}</Eyebrow>
            </>
          )}
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <Eyebrow>Setup · {pct}%</Eyebrow>
            <Eyebrow>
              {readyCount}/{total} steps
            </Eyebrow>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-[#D66666] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step rail */}
      <nav className="flex-1 space-y-0.5 p-2">
        {steps.map((step, i) => {
          const Icon = ICONS[step.icon];
          const isActive = step.id === activeStep;
          const isReady = ready[step.id];
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep(step.id)}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                isActive
                  ? 'bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-900/60',
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  isActive
                    ? 'bg-[#D66666] text-white'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                  <span
                    className={cn(
                      'truncate text-sm font-medium',
                      isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                <span className="block truncate text-[11px] text-zinc-400 dark:text-zinc-500">{step.hint}</span>
              </div>
              <span className="shrink-0">
                {isReady ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="block size-2 rounded-full border border-zinc-300 dark:border-zinc-600" />
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {(onDuplicate || (onDelete && canDelete)) && (
        <div className="space-y-1 border-t border-zinc-200 p-3 dark:border-zinc-800">
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Copy className="size-3.5" /> Duplicate event
            </button>
          )}
          {onDelete && canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Delete event…
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
