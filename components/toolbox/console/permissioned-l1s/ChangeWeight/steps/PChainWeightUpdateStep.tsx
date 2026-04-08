"use client";

import React from "react";
import { Alert } from "@/components/toolbox/components/Alert";
import { useChangeWeightStore } from "@/components/toolbox/stores/changeWeightStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import SubmitPChainTxWeightUpdate from "../../../shared/SubmitPChainTxWeightUpdate";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function PChainWeightUpdateStep() {
  const store = useChangeWeightStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.evmTxHash) {
    return (
      <Alert variant="error">
        Please complete the previous step first.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div>
        <SubmitPChainTxWeightUpdate
          subnetIdL1={store.subnetIdL1}
          initialEvmTxHash={store.evmTxHash}
          signingSubnetId={vmcCtx.signingSubnetId}
          txHashLabel="initiateValidatorWeightUpdate Transaction Hash"
          txHashPlaceholder="Enter the transaction hash from step 2 (0x...)"
          onSuccess={(pChainTxId) => {
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
