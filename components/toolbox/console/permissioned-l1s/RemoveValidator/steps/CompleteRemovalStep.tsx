"use client";

import React from "react";
import { Alert } from "@/components/toolbox/components/Alert";
import { useRemoveValidatorStore } from "@/components/toolbox/stores/removeValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import CompleteValidatorRemoval from "../CompleteValidatorRemoval";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function CompleteRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.pChainTxId) {
    return (
      <Alert variant="warning">
        Please complete the previous step first.
      </Alert>
    );
  }

  const isContractOwner =
    vmcCtx.ownershipStatus === "currentWallet"
      ? true
      : vmcCtx.ownershipStatus === "differentEOA"
        ? false
        : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div>
        <CompleteValidatorRemoval
          subnetIdL1={store.subnetIdL1}
          validationId={store.validationId}
          pChainTxId={store.pChainTxId}
          eventData={null}
          isContractOwner={isContractOwner}
          validatorManagerAddress={vmcCtx.validatorManagerAddress}
          signingSubnetId={vmcCtx.signingSubnetId}
          contractOwner={vmcCtx.contractOwner}
          isLoadingOwnership={vmcCtx.isLoadingOwnership}
          ownerType={vmcCtx.ownerType}
          onSuccess={(message) => {
            store.setGlobalSuccess(message);
            store.setGlobalError(null);
          }}
          onError={(message) => store.setGlobalError(message)}
        />
      </div>
      <StepCodeViewer
        activeStep={3}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
