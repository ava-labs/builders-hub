"use client";

import React from "react";
import {
  ValidatorListInput,
  type ConvertToL1Validator,
} from "@/components/toolbox/components/ValidatorListInput";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { Alert } from "@/components/toolbox/components/Alert";
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

function serializeValidators(
  validators: ConvertToL1Validator[]
): ReturnType<typeof useAddValidatorStore>["validators"] {
  return validators.map((v) => ({
    ...v,
    validatorWeight: v.validatorWeight.toString(),
    validatorBalance: v.validatorBalance.toString(),
  }));
}

export default function ValidatorDetailsStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { pChainAddress } = useWalletStore();

  if (!store.subnetIdL1) {
    return (
      <Alert variant="error">
        Please select a subnet first.
      </Alert>
    );
  }

  const validators = deserializeValidators(store.validators);

  const handleChange = (newValidators: ConvertToL1Validator[]) => {
    store.setValidators(serializeValidators(newValidators));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Add Validator Details</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add the validator details including node credentials and configuration.
        </p>

        <ValidatorListInput
          validators={validators}
          onChange={handleChange}
          defaultAddress={pChainAddress ?? ""}
          label=""
          l1TotalInitializedWeight={
            !vmcCtx.l1WeightError && vmcCtx.contractTotalWeight > 0n
              ? vmcCtx.contractTotalWeight
              : null
          }
          maxValidators={1}
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
