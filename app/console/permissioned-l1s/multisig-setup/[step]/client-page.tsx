"use client";

import StepFlow from "../../../../../components/console/step-flow";
import { steps } from "../steps";

export default function MultisigSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissioned-l1s/multisig-setup";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
