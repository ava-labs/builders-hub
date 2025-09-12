"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";

export default function StakingManagerSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/staking-manager-setup";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
