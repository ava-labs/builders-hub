"use client";

import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import StepFlow from "./step-flow";
import StepFlowV2 from "./step-flow-v2";

export type { StepDefinition } from "./step-flow-v2";

type StepFlowSwitcherProps = React.ComponentProps<typeof StepFlowV2>;

export default function StepFlowSwitcher(props: StepFlowSwitcherProps) {
  const flagV2 = useFeatureFlag("console-step-flow-v2", false);
  // Local dev: always exercise v2; production still gated by the flag.
  const useV2 =
    process.env.NODE_ENV === "development" || flagV2;

  if (useV2) {
    return <StepFlowV2 {...props} />;
  }

  return <StepFlow {...props} />;
}
