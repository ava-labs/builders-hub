"use client";

import React from "react";
import SubmitPChainTxRegisterL1Validator from "../SubmitPChainTxRegisterL1Validator";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import { Alert } from "@/components/toolbox/components/Alert";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

export default function PChainRegistrationStep() {
  const store = useAddValidatorStore();
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
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Submit to P-Chain</h2>
        <p className="text-sm text-gray-500 mb-4">
          Aggregate validator signatures and submit{" "}
          <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">
            RegisterL1ValidatorTx
          </code>{" "}
          to P-Chain.
        </p>

        <SubmitPChainTxRegisterL1Validator
          subnetIdL1={store.subnetIdL1}
          validatorBalance={store.validatorBalance}
          blsProofOfPossession={store.blsProofOfPossession}
          evmTxHash={store.evmTxHash}
          onSuccess={(pChainTxId) => {
            store.setPChainTxId(pChainTxId);
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
