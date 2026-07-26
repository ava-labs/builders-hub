"use client";

import { padStep } from "./format";

export function FlowHeader({
  flowId,
  stepIndex,
  stepCount,
}: {
  flowId: string;
  stepIndex: number;
  stepCount: number;
}) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        FLOW / {flowId.toUpperCase()}
      </span>
      <span
        aria-live="polite"
        className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-50"
      >
        STEP {padStep(stepIndex + 1)} / {padStep(stepCount)}
      </span>
    </div>
  );
}
