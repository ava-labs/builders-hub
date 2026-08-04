"use client";

import { useReducedMotion } from "framer-motion";
import { flows } from "./data";
import type { FlowDefinition, FlowId } from "./data/types";
import { FlowHero } from "./FlowHero";
import { StepFlow } from "./StepFlow";

export function ValidatorFlowExplainer({ flow: flowId }: { flow: FlowId }) {
  const flow = (flows as Record<string, FlowDefinition | undefined>)[flowId];
  const reducedMotion = useReducedMotion() ?? false;
  if (!flow) return null;
  return (
    <section className="not-prose vf-explainer mt-4 mb-10 w-full">
      <FlowHero flow={flow} />
      <StepFlow flow={flow} reducedMotion={reducedMotion} />
    </section>
  );
}
