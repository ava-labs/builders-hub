"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";

export default function StakeClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/stake";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
