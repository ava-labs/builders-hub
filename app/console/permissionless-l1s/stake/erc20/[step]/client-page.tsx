"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useStakeValidatorStore } from "@/components/toolbox/stores/stakeValidatorStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function StakeERC20ClientPage({ currentStepKey }: { currentStepKey: string }) {
  const basePath = "/console/permissionless-l1s/stake/erc20";
  const searchParams = useSearchParams();
  const { subnetIdL1, globalError, pChainTxId, setSubnetIdL1, setTokenType } = useStakeValidatorStore();

  useEffect(() => {
    setTokenType("erc20");
    const subnetId = searchParams.get("subnetId");
    if (subnetId && subnetId !== subnetIdL1) setSubnetIdL1(subnetId);
  }, [searchParams, setSubnetIdL1, setTokenType, subnetIdL1]);

  return (
    <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError} showPoSWarning>
      <StepFlow
        steps={steps}
        basePath={basePath}
        currentStepKey={currentStepKey}
        transactionHash={pChainTxId || undefined}
      />
    </ValidatorManagerLayout>
  );
}
