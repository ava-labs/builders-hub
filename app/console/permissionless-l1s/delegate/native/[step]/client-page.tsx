"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useDelegateStore } from "@/components/toolbox/stores/delegateStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function DelegateNativeClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/delegate/native";
  const { subnetIdL1, globalError, pChainTxId } = useDelegateStore();

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
