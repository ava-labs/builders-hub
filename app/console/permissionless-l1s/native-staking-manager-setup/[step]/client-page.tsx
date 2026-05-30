"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { MainnetPoSWarning } from "@/components/toolbox/components/MainnetPoSWarning";

export default function NativeStakingManagerSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/native-staking-manager-setup";
  return (
    <>
      <MainnetPoSWarning />
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
      />
    </>
  );
}
