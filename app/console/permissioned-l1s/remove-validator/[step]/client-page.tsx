"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useRemoveValidatorStore } from "@/components/toolbox/stores/removeValidatorStore";
import PermissionedFlowLayout from "@/components/toolbox/console/permissioned-l1s/shared/PermissionedFlowLayout";

export default function RemoveValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissioned-l1s/remove-validator";
  const { subnetIdL1, globalError, pChainTxId } = useRemoveValidatorStore();

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
