"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useDelegateStore } from "@/components/toolbox/stores/delegateStore";
import ValidatorManagerLayout, { validatorManagerPerStep } from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function DelegateERC20ClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/delegate/erc20";
  const { subnetIdL1, pChainTxId } = useDelegateStore();

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} providerPerStep showPoSWarning>
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
