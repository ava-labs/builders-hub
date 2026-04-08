"use client";

import React from "react";
import { Alert } from "@/components/toolbox/components/Alert";
import { useRemoveValidatorStore } from "@/components/toolbox/stores/removeValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import InitiateValidatorRemoval from "../InitiateValidatorRemoval";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function InitiateRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.subnetIdL1) {
    return (
      <Alert variant="warning">
        Please complete the previous step first.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div>
        <InitiateValidatorRemoval
          subnetId={store.subnetIdL1}
          validatorManagerAddress={vmcCtx.validatorManagerAddress}
          resetForm={false}
          initialNodeId={store.nodeId}
          initialValidationId={store.validationId}
          ownershipState={vmcCtx.ownershipStatus}
          refetchOwnership={vmcCtx.refetchOwnership}
          ownershipError={vmcCtx.ownershipError}
          onSuccess={(data) => {
            store.setNodeId(data.nodeId);
            store.setValidationId(data.validationId);
            store.setInitiateRemovalTxHash(data.txHash);
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
