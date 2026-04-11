"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useRemovePoSValidatorStore } from "@/components/toolbox/stores/removePoSValidatorStore";
import { Alert } from "@/components/toolbox/components/Alert";

export default function RemoveValidatorClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/remove-validator";
    const { globalError, pChainTxId } = useRemovePoSValidatorStore();

    return (
        <div>
            {globalError && (
                <Alert variant="error" className="mb-4">
                    Error: {globalError}
                </Alert>
            )}
            <StepFlow
                steps={steps}
                basePath={basePath}
                currentStepKey={currentStepKey}
                transactionHash={pChainTxId || undefined}
            />
        </div>
    );
}
