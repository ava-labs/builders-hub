"use client";

import { useReducedMotion } from "framer-motion";
import { flows } from "./data";
import type { FlowId } from "./data/types";
import { desktopLayout, mobileLayout } from "./stage-layouts";
import { Stage } from "./Stage";
import { StepControls } from "./StepControls";
import { StepDetail } from "./StepDetail";
import { useFlowState, useMediaQuery } from "./use-flow-state";

export function ValidatorFlowExplainer({ flow: flowId }: { flow: FlowId }) {
  const flow = flows[flowId];
  const { state, dispatch } = useFlowState();
  const narrow = useMediaQuery("(max-width: 767px)");
  const reducedMotion = useReducedMotion() ?? false;
  const step = flow.steps[state.stepIndex];
  const sectionKey = (section: "operator" | "failures") =>
    `${step.id}:${section}`;
  return (
    <figure className="not-prose my-6 space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <Stage
        flow={flow}
        step={step}
        layout={narrow ? mobileLayout : desktopLayout}
        reducedMotion={reducedMotion}
      />
      <StepControls
        steps={flow.steps}
        current={state.stepIndex}
        onBack={() => dispatch({ type: "back" })}
        onNext={() => dispatch({ type: "next", stepCount: flow.steps.length })}
        onGoto={(index) =>
          dispatch({ type: "goto", index, stepCount: flow.steps.length })
        }
      />
      <StepDetail
        step={step}
        stepNumber={state.stepIndex + 1}
        stepCount={flow.steps.length}
        operatorOpen={Boolean(state.expanded[sectionKey("operator")])}
        failuresOpen={Boolean(state.expanded[sectionKey("failures")])}
        onToggle={(section) =>
          dispatch({ type: "toggle", section: sectionKey(section) })
        }
      />
    </figure>
  );
}
