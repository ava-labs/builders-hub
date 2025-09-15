"use client";

import StepFlow from "../../../../../components/console/step-flow";
import { steps } from "../steps";

export default function VmcMigrateClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/utilities/vmcMigrateFromV1";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
