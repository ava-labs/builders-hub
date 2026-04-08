"use client";

import React from "react";
import { Alert } from "@/components/toolbox/components/Alert";
import { useChangeWeightStore } from "@/components/toolbox/stores/changeWeightStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import InitiateChangeWeight from "../InitiateChangeWeight";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function InitiateWeightChangeStep() {
  const store = useChangeWeightStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.subnetIdL1) {
    return (
      <Alert variant="error">
        Please complete the previous step first.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div>
        <InitiateChangeWeight
          subnetId={store.subnetIdL1}
          validatorManagerAddress={vmcCtx.validatorManagerAddress}
          resetForm={false}
          initialNodeId={store.nodeId}
          initialValidationId={store.validationId}
          initialWeight={store.newWeight}
          ownershipState={vmcCtx.ownershipStatus}
          refetchOwnership={vmcCtx.refetchOwnership}
          ownershipError={vmcCtx.ownershipError}
          contractTotalWeight={vmcCtx.contractTotalWeight}
          onSuccess={(data) => {
            store.setNodeId(data.nodeId);
            store.setValidationId(data.validationId);
            store.setNewWeight(data.weight);
            store.setEvmTxHash(data.txHash);
            store.setGlobalError(null);
          }}
          onError={(message) => store.setGlobalError(message)}
        />
      </div>
      <StepCodeViewer
        activeStep={1}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
