"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useChangeWeightStore } from "@/components/toolbox/stores/changeWeightStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function ChangeWeightClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissioned-l1s/change-validator-weight";
  const { subnetIdL1, globalError, pChainTxId } = useChangeWeightStore();

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError}>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        transactionHash={pChainTxId || undefined}
      />
    </ValidatorManagerLayout>
  );
}
