"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";
import { useSubnetIdQuery } from "@/components/toolbox/hooks/useSubnetIdQuery";

export default function AddValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/add-validator";
  const { subnetIdL1, pChainTxId, flowCompleted, setSubnetIdL1 } = useAddValidatorStore();
  useSubnetIdQuery(subnetIdL1, flowCompleted, setSubnetIdL1);

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1}>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        transactionHash={pChainTxId || undefined}
      />
    </ValidatorManagerLayout>
  );
}
