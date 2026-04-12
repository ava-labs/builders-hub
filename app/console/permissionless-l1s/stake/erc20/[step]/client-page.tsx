"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useStakeValidatorStore } from "@/components/toolbox/stores/stakeValidatorStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function StakeERC20ClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/stake/erc20";
  const { subnetIdL1, globalError, pChainTxId } = useStakeValidatorStore();

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError} showPoSWarning>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        transactionHash={pChainTxId || undefined}
      />
    </ValidatorManagerLayout>
  );
}
