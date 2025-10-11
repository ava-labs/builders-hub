"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";

export default function NativeStakingManagerSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/native-staking-manager-setup";
    return (
        <StepFlow
            steps={steps}
            basePath={basePath}
            currentStepKey={currentStepKey}
        />
    );
}
