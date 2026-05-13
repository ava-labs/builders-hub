"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import StepFlow, { type StepDefinition } from "@/components/console/step-flow";
import { steps as fullSteps } from "../steps";
import { useRemoveValidatorStore } from "@/components/toolbox/stores/removeValidatorStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";
import { useValidatorManagerContext } from "@/components/toolbox/contexts/ValidatorManagerContext";

/**
 * Inner component — has access to ValidatorManagerContext (since it's rendered
 * inside <ValidatorManagerLayout>), which is where manager-type detection
 * resolves. The steps list is derived from the detected ownerType so we hide
 * claim-fees entirely for PoA flows (no delegations → nothing to claim).
 *
 * While detection is loading we keep the full PoS-including list so a deep
 * link to /claim-fees doesn't 404 on a refresh before context resolves; the
 * step itself still has an "n/a for PoA" placeholder as a backstop.
 */
function RemoveValidatorFlow({
  basePath,
  currentStepKey,
  pChainTxId,
}: {
  basePath: string;
  currentStepKey: string;
  pChainTxId?: string;
}) {
  const vmcCtx = useValidatorManagerContext();

  const steps = useMemo<StepDefinition[]>(() => {
    // PoA flows (EOA-owned or PoAManager-owned VMCs) have no delegation fees
    // to claim — strip the claim-fees step entirely.
    const isPoA = vmcCtx.ownerType === "EOA" || vmcCtx.ownerType === "PoAManager";
    if (!isPoA) return fullSteps;
    return fullSteps.filter((step) => !(step.type === "single" && step.key === "claim-fees"));
  }, [vmcCtx.ownerType]);

  return (
    <StepFlow
      steps={steps}
      basePath={basePath}
      currentStepKey={currentStepKey}
      transactionHash={pChainTxId || undefined}
    />
  );
}

export default function RemoveValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/remove-validator";
  const searchParams = useSearchParams();
  const { subnetIdL1, globalError, pChainTxId, setSubnetIdL1 } = useRemoveValidatorStore();

  useEffect(() => {
    const subnetId = searchParams.get("subnetId");
    if (subnetId && subnetId !== subnetIdL1) setSubnetIdL1(subnetId);
  }, [searchParams, setSubnetIdL1, subnetIdL1]);

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError}>
      <RemoveValidatorFlow basePath={basePath} currentStepKey={currentStepKey} pChainTxId={pChainTxId} />
    </ValidatorManagerLayout>
  );
}
