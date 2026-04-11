"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useDelegateStore } from "@/components/toolbox/stores/delegateStore";
import PermissionedFlowLayout from "@/components/toolbox/console/permissioned-l1s/shared/PermissionedFlowLayout";

export default function DelegateClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/delegate";
  const { subnetIdL1, globalError, pChainTxId } = useDelegateStore();

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
