"use client";

import StepFlow from "../../../../../components/console/step-flow";
import { steps } from "../steps";

export default function IcttTokenTransferClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/ictt/token-transfer";
    return (
            <StepFlow
                steps={steps}
                basePath={basePath}
                currentStepKey={currentStepKey}
            />
    );
}
