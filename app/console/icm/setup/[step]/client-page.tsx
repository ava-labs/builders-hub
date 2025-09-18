"use client";

import StepFlow from "../../../../../components/console/step-flow";
import { steps } from "../steps";

export default function IcmSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/icm/setup";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
