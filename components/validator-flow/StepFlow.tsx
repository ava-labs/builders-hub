"use client";

import type { FlowDefinition } from "./data/types";
import { desktopLayout, mobileLayout } from "./stage-layouts";
import { useFlowState } from "./use-flow-state";
import { FlowHeader } from "./FlowHeader";
import { Stage } from "./Stage";
import { StepRail } from "./StepRail";
import { StepPanel } from "./StepPanel";

export function StepFlow({
  flow,
  reducedMotion,
}: {
  flow: FlowDefinition;
  reducedMotion: boolean;
}) {
  const { state, dispatch } = useFlowState();
  const step = flow.steps[state.stepIndex];
  const sectionKey = (section: "operator" | "failures") => `${step.id}:${section}`;
  return (
    <div className="space-y-4">
      <div className="border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <FlowHeader
          flowId={flow.id}
          stepIndex={state.stepIndex}
          stepCount={flow.steps.length}
        />
        <div className="px-4 py-3">
          <div className="md:hidden">
            <Stage
              flow={flow}
              stepIndex={state.stepIndex}
              layout={mobileLayout}
              reducedMotion={reducedMotion}
              className="h-auto w-full select-none"
            />
          </div>
          <div className="hidden md:block">
            <Stage
              flow={flow}
              stepIndex={state.stepIndex}
              layout={desktopLayout}
              reducedMotion={reducedMotion}
              className="h-auto w-full select-none"
            />
          </div>
        </div>
        <StepRail
          steps={flow.steps}
          currentIndex={state.stepIndex}
          onSelect={(index) =>
            dispatch({ type: "goto", index, stepCount: flow.steps.length })
          }
        />
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => dispatch({ type: "back" })}
            disabled={state.stepIndex === 0}
            className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-700 disabled:cursor-default disabled:opacity-40 dark:text-zinc-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "next", stepCount: flow.steps.length })}
            disabled={state.stepIndex === flow.steps.length - 1}
            className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-700 disabled:cursor-default disabled:opacity-40 dark:text-zinc-200"
          >
            Next
          </button>
        </div>
      </div>
      <StepPanel
        step={step}
        stepNumber={state.stepIndex + 1}
        stepCount={flow.steps.length}
        operatorOpen={Boolean(state.expanded[sectionKey("operator")])}
        failuresOpen={Boolean(state.expanded[sectionKey("failures")])}
        onToggle={(section) =>
          dispatch({ type: "toggle", section: sectionKey(section) })
        }
      />
    </div>
  );
}
