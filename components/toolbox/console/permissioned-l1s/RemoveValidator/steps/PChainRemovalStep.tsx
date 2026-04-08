"use client";

import React from "react";
import { Alert } from "@/components/toolbox/components/Alert";
import { useRemoveValidatorStore } from "@/components/toolbox/stores/removeValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import SubmitPChainTxRemoval from "../SubmitPChainTxRemoval";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function PChainRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.initiateRemovalTxHash) {
    return (
      <Alert variant="warning">
        Please complete the previous step first.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div>
        <SubmitPChainTxRemoval
          subnetIdL1={store.subnetIdL1}
          initialEvmTxHash={store.initiateRemovalTxHash}
          signingSubnetId={vmcCtx.signingSubnetId}
          onSuccess={(pChainTxId, _eventData) => {
            store.setPChainTxId(pChainTxId);
            store.setGlobalError(null);
          }}
          onError={(message) => store.setGlobalError(message)}
        />
      </div>
      <StepCodeViewer
        activeStep={2}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
