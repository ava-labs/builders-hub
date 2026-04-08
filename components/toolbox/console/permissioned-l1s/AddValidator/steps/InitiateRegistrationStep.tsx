"use client";

import React from "react";
import InitiateValidatorRegistration from "../InitiateValidatorRegistration";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import { Alert } from "@/components/toolbox/components/Alert";
import type { ConvertToL1Validator } from "@/components/toolbox/components/ValidatorListInput";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../code-config";

function deserializeValidators(
  serialized: ReturnType<typeof useAddValidatorStore>["validators"]
): ConvertToL1Validator[] {
  return serialized.map((v) => ({
    ...v,
    validatorWeight: BigInt(v.validatorWeight),
    validatorBalance: BigInt(v.validatorBalance),
  }));
}

export default function InitiateRegistrationStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  if (!store.subnetIdL1 || store.validators.length === 0) {
    return (
      <Alert variant="error">
        Please complete the previous steps first.
      </Alert>
    );
  }

  const validators = deserializeValidators(store.validators);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Call{" "}
          <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">
            initiateValidatorRegistration
          </code>{" "}
          on the Validator Manager contract.
        </p>

        <InitiateValidatorRegistration
          subnetId={store.subnetIdL1}
          validatorManagerAddress={vmcCtx.validatorManagerAddress}
          validators={validators}
          ownershipState={vmcCtx.ownershipStatus}
          refetchOwnership={vmcCtx.refetchOwnership}
          ownershipError={vmcCtx.ownershipError}
          contractTotalWeight={vmcCtx.contractTotalWeight}
          l1WeightError={vmcCtx.l1WeightError}
          onSuccess={(data) => {
            store.setEvmTxHash(data.txHash);
            store.setValidatorBalance(data.validatorBalance);
            store.setBlsProofOfPossession(data.blsProofOfPossession);
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
