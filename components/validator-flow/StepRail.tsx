"use client";

import type { FlowStep } from "./data/types";
import { padStep } from "./format";

export function StepRail({
  steps,
  currentIndex,
  onSelect,
  compact = false,
}: {
  steps: readonly FlowStep[];
  currentIndex: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Flow steps"
      className="grid divide-x divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const stepState =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        const numberClass =
          stepState === "current"
            ? "text-[#E6212F]"
            : stepState === "done"
              ? "text-zinc-500 dark:text-zinc-400"
              : "text-zinc-400 dark:text-zinc-600";
        const nameClass =
          stepState === "current"
            ? "text-zinc-900 dark:text-zinc-50"
            : stepState === "done"
              ? "text-zinc-500 dark:text-zinc-500"
              : "text-zinc-400 dark:text-zinc-600";
        return (
          <button
            key={step.id}
            type="button"
            title={step.title}
            aria-label={`Step ${index + 1}: ${step.title}`}
            aria-current={stepState === "current" ? "step" : undefined}
            onClick={() => onSelect(index)}
            className={[
              compact
                ? "flex cursor-pointer flex-row items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
                : "flex cursor-pointer flex-col items-start gap-0 px-3 py-1 text-left transition-colors",
              stepState === "done" ? "bg-zinc-100 dark:bg-zinc-900" : "",
              stepState === "current"
                ? "shadow-[inset_2px_0_0_#E6212F]"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
            ].join(" ")}
          >
            <span
              className={`font-mono ${compact ? "text-[9px]" : "text-[10px]"} font-bold tabular-nums ${numberClass}`}
            >
              {padStep(index + 1)}
            </span>
            <span
              className={`hidden font-mono leading-4 ${compact ? "text-[7.5px]" : "text-[8px]"} uppercase tracking-[0.14em] sm:block ${nameClass}`}
            >
              {step.railLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
