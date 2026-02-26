"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";

export default function DelegateClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/delegate";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
