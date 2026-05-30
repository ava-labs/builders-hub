"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useRemoveDelegationStore } from "@/components/toolbox/stores/removeDelegationStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function RemoveDelegationClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/remove-delegation";
    const { subnetIdL1, globalError, pChainTxId } = useRemoveDelegationStore();

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
