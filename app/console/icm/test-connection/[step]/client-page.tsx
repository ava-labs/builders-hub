"use client";

import StepFlow from "../../../../../components/console/step-flow";
import { steps } from "../steps";

export default function IcmTestConnectionClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/icm/test-connection";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
