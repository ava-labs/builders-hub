"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { CHECK_POP, CONNECTOR_FILL, WIDTH_TWEEN } from "@/components/audits/shared/motion";

interface StepperProps {
  steps: readonly string[];
  current: number;
  /** Completed nodes are clickable to jump back and edit (design 1b). */
  onJumpBack: (index: number) => void;
}

type NodeState = "done" | "current" | "todo";

function Node({ state, index }: { state: NodeState; index: number }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-150",
        state === "current" && "border-brand bg-brand text-white",
        state === "done" &&
          "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900",
        state === "todo" && "border-zinc-300 text-zinc-500 dark:border-white/15 dark:text-zinc-400",
      )}
    >
      {state === "done" ? <Check aria-hidden className={cn("h-3.5 w-3.5", CHECK_POP)} /> : index + 1}
    </span>
  );
}

/**
 * The wizard card's header row (design 1b, picked 2026-07-31): nodes joined
 * by full-width connectors that fill left to right as steps complete. Below
 * sm it collapses to the board-1k progress bar; Back in the footer covers
 * navigation there, so jump-back nodes are a >=sm affordance.
 */
export function Stepper({ steps, current, onJumpBack }: StepperProps) {
  return (
    <nav aria-label="Progress">
      <ol className="hidden items-center sm:flex">
        {steps.map((label, index) => {
          const state: NodeState = index < current ? "done" : index === current ? "current" : "todo";
          const node = (
            <>
              <Node state={state} index={index} />
              <span
                className={cn(
                  "text-[13px]",
                  state === "current"
                    ? "font-semibold text-foreground"
                    : state === "done"
                      ? "font-medium text-zinc-700 dark:text-zinc-300"
                      : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className={cn("flex items-center", index > 0 && "flex-1")}>
              {index > 0 && (
                <span
                  aria-hidden
                  className="relative mx-3 h-px flex-1 overflow-hidden bg-zinc-200 dark:bg-white/10"
                >
                  <span
                    className={cn(
                      "absolute inset-0 bg-zinc-900 dark:bg-zinc-100",
                      CONNECTOR_FILL,
                      index <= current ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              )}
              {state === "done" ? (
                <button
                  type="button"
                  onClick={() => onJumpBack(index)}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 hover:opacity-80"
                  aria-label={`Back to step ${index + 1}: ${label}`}
                >
                  {node}
                </button>
              ) : (
                <span
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex items-center gap-2 px-1"
                >
                  {node}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="sm:hidden" aria-current="step">
        <p className={MONO_LABEL_SM}>
          Step {current + 1} of {steps.length} · {steps[current]}
        </p>
        {/* Edge-to-edge square 3px bar (board 1k): bleeds through the card
            header's px-5/pb-4 so it runs flush under the header rule. */}
        <div className="-mx-5 -mb-4 mt-3 h-[3px] overflow-hidden bg-zinc-100 dark:bg-white/10">
          <div
            className={cn("h-full bg-brand", WIDTH_TWEEN)}
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
