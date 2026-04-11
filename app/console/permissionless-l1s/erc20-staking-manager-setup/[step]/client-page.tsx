"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { MainnetPoSWarning } from "@/components/toolbox/components/MainnetPoSWarning";

export default function ERC20StakingManagerSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/erc20-staking-manager-setup";
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
