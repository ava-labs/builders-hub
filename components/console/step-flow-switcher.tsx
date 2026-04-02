"use client";

import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import StepFlow from "./step-flow";
import StepFlowV2 from "./step-flow-v2";

export type { StepDefinition } from "./step-flow-v2";

type StepFlowSwitcherProps = React.ComponentProps<typeof StepFlowV2>;

export default function StepFlowSwitcher(props: StepFlowSwitcherProps) {
  const useV2 = useFeatureFlag("console-step-flow-v2", false);

  if (useV2) {
    return <StepFlowV2 {...props} />;
  }

  return <StepFlow {...props} />;
}
