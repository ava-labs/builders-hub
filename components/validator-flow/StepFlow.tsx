"use client";

import type { FlowDefinition } from "./data/types";
import { desktopLayout, mobileLayout } from "./stage-layouts";
import { useFlowState } from "./use-flow-state";
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
