"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import PermissionedFlowLayout from "@/components/toolbox/console/permissioned-l1s/shared/PermissionedFlowLayout";

export default function AddValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissioned-l1s/add-validator";
  const { subnetIdL1, globalError, pChainTxId } = useAddValidatorStore();

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
