"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";

export default function ValidatorManagerSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissioned-l1s/validator-manager-setup";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
