"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: readonly string[];
  current: number;
  /** Completed nodes are clickable to jump back and edit (design 1b). */
  onJumpBack: (index: number) => void;
}

// Markup lifted from the mini-grants stepper (grants/team1-mini-grants/apply),
// adapted to the audit design language: done step = zinc check, current = red.
export function Stepper({ steps, current, onJumpBack }: StepperProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((label, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const node = (
            <>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  isCurrent
                    ? "border-brand bg-brand text-white"
                    : isComplete
                      ? "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-white/15 dark:bg-white/10 dark:text-zinc-300"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {isComplete ? <Check aria-hidden className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-2">
              {isComplete ? (
                <button
                  type="button"
                  onClick={() => onJumpBack(index)}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 hover:opacity-80"
                  aria-label={`Back to step ${index + 1}: ${label}`}
                >
                  {node}
                </button>
              ) : (
                <span aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-2 px-1">
                  {node}
                </span>
              )}
              {index < steps.length - 1 && (
                <span aria-hidden className="mx-1 hidden h-px w-6 bg-border sm:inline-block" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
