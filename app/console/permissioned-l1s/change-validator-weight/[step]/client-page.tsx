"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useChangeWeightStore } from "@/components/toolbox/stores/changeWeightStore";
import ValidatorManagerLayout, { validatorManagerPerStep } from "@/components/toolbox/contexts/ValidatorManagerLayout";
import { useSubnetIdQuery } from "@/components/toolbox/hooks/useSubnetIdQuery";

export default function ChangeWeightClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissioned-l1s/change-validator-weight";
  const { subnetIdL1, pChainTxId, flowCompleted, setSubnetIdL1 } = useChangeWeightStore();
  useSubnetIdQuery(subnetIdL1, flowCompleted, setSubnetIdL1);

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} providerPerStep>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        wrapStep={validatorManagerPerStep(subnetIdL1)}
        transactionHash={pChainTxId || undefined}
      />
    </ValidatorManagerLayout>
  );
}
