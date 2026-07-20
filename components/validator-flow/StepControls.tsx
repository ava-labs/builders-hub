"use client";

import type { FlowStep } from "./data/types";

export function StepControls({
  steps,
  current,
  onBack,
  onNext,
  onGoto,
}: {
  steps: readonly FlowStep[];
  current: number;
  onBack: () => void;
  onNext: () => void;
  onGoto: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={current === 0}
        className="cursor-pointer disabled:cursor-default rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
      >
        Back
      </button>
      <ol className="flex items-center gap-1.5" aria-label="Flow steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              title={step.title}
              aria-label={`Step ${index + 1}: ${step.title}`}
              aria-current={index === current ? "step" : undefined}
              onClick={() => onGoto(index)}
              className={
                index === current
                  ? "cursor-pointer h-8 w-8 rounded-full bg-red-500 text-sm font-semibold text-white"
                  : index < current
                    ? "cursor-pointer h-8 w-8 rounded-full bg-red-100 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "cursor-pointer h-8 w-8 rounded-full border border-zinc-300 text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
              }
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onNext}
        disabled={current === steps.length - 1}
        className="cursor-pointer disabled:cursor-default rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
      >
        Next
      </button>
    </div>
  );
}
