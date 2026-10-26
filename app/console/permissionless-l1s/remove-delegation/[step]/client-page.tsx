"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useRemoveDelegationStore } from "@/components/toolbox/stores/removeDelegationStore";
import ValidatorManagerLayout, { validatorManagerPerStep } from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function RemoveDelegationClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/remove-delegation";
    const { subnetIdL1, pChainTxId } = useRemoveDelegationStore();

    return (
        <ValidatorManagerLayout subnetIdL1={subnetIdL1} providerPerStep showPoSWarning>
            <StepFlow
                steps={steps}
                basePath={basePath}
                currentStepKey={currentStepKey}
                wrapStep={validatorManagerPerStep(subnetIdL1)}
                transactionHash={pChainTxId || undefined}
            />
        </ValidatorManagerLayout>
    );
}
