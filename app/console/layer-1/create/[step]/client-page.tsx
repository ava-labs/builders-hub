"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";

export default function CreateL1ClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/layer-1/create";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
