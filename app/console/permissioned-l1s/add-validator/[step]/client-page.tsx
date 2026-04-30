"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useAddValidatorStore } from "@/components/toolbox/stores/addValidatorStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function AddValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissioned-l1s/add-validator";
  const searchParams = useSearchParams();
  const { subnetIdL1, globalError, pChainTxId, setSubnetIdL1 } = useAddValidatorStore();

  useEffect(() => {
    const subnetId = searchParams.get("subnetId");
    if (subnetId && subnetId !== subnetIdL1) setSubnetIdL1(subnetId);
  }, [searchParams, setSubnetIdL1, subnetIdL1]);

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError}>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        transactionHash={pChainTxId || undefined}
      />
    </ValidatorManagerLayout>
  );
}
