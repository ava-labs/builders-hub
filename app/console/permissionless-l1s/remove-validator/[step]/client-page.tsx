"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useRemovePoSValidatorStore } from "@/components/toolbox/stores/removePoSValidatorStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function RemoveValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/remove-validator";
    const { subnetIdL1, globalError, pChainTxId } = useRemovePoSValidatorStore();

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
