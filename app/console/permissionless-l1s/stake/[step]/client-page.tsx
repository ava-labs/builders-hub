"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useStakeValidatorStore } from "@/components/toolbox/stores/stakeValidatorStore";
import PermissionedFlowLayout from "@/components/toolbox/console/permissioned-l1s/shared/PermissionedFlowLayout";

export default function StakeClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/stake";
  const { subnetIdL1, globalError, pChainTxId } = useStakeValidatorStore();

  return (
    <PermissionedFlowLayout subnetIdL1={subnetIdL1} globalError={globalError}>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        transactionHash={pChainTxId || undefined}
      />
    </PermissionedFlowLayout>
  );
}
