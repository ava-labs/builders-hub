"use client";

import StepFlow from "../../../../../components/console/step-flow";
import { steps } from "../steps";

export default function IcttSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/ictt/setup";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
