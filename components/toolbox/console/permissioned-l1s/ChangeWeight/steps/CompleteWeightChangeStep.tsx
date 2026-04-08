"use client";

import React from "react";
import { Alert } from "@/components/toolbox/components/Alert";
import { useChangeWeightStore } from "@/components/toolbox/stores/changeWeightStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import CompletePChainWeightUpdate from "../../../shared/CompletePChainWeightUpdate";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function CompleteWeightChangeStep() {
  const store = useChangeWeightStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.pChainTxId) {
    return (
      <Alert variant="error">
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
        <CompletePChainWeightUpdate
          subnetIdL1={store.subnetIdL1}
          pChainTxId={store.pChainTxId}
          signingSubnetId={vmcCtx.signingSubnetId}
          updateType="ChangeWeight"
          managerAddress={vmcCtx.validatorManagerAddress}
          isContractOwner={isContractOwner}
          contractOwner={vmcCtx.contractOwner}
          isLoadingOwnership={vmcCtx.isLoadingOwnership}
          ownerType={vmcCtx.ownerType}
          onSuccess={(data) => {
            store.setGlobalSuccess(data.message);
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
