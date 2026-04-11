"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useRemoveDelegationStore } from "@/components/toolbox/stores/removeDelegationStore";
import { Alert } from "@/components/toolbox/components/Alert";

export default function RemoveDelegationClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/remove-delegation";
    const { globalError, pChainTxId } = useRemoveDelegationStore();

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
