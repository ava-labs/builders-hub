"use client";

import React from "react";
import InitiateValidatorRegistration from "../InitiateValidatorRegistration";
import { useAddValidatorStore, deserializeValidators } from "@/components/toolbox/stores/addValidatorStore";
import { useValidatorManagerContext } from "@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext";
import { Alert } from "@/components/toolbox/components/Alert";
import { StepCodeViewer } from "@/components/console/step-code-viewer";
import { STEP_CONFIG } from "../codeConfig";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

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
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
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
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initiateValidatorRegistration()</span>
          <a
            href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            @{ICM_COMMIT.slice(0, 7)}
          </a>
        </div>
      </div>
      <StepCodeViewer
        activeStep={2}
        steps={STEP_CONFIG}
        className="lg:sticky lg:top-4 lg:self-start"
      />
    </div>
  );
}
