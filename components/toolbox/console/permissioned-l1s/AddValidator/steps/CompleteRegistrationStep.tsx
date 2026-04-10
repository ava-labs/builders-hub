"use client";

import React from "react";
import CompletePChainRegistration from "@/components/toolbox/console/shared/CompletePChainRegistration";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import { Alert } from "@/components/toolbox/components/Alert";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function CompleteRegistrationStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.pChainTxId) {
    return (
      <Alert variant="error">
        Please complete the previous step first.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Complete Registration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Call{" "}
          <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">
            completeValidatorRegistration
          </code>{" "}
          on the Validator Manager contract.
        </p>

        <CompletePChainRegistration
          subnetIdL1={store.subnetIdL1}
          pChainTxId={store.pChainTxId}
          signingSubnetId={vmcCtx.signingSubnetId}
          managerType="PoA"
          managerAddress={vmcCtx.validatorManagerAddress}
          ownershipState={vmcCtx.ownershipStatus}
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
        activeStep={4}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
