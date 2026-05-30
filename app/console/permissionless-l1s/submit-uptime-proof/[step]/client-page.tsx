"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useUptimeProofStore } from "@/components/toolbox/stores/uptimeProofStore";
import ValidatorManagerLayout from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function SubmitUptimeProofClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/submit-uptime-proof";
    const { subnetIdL1, globalError } = useUptimeProofStore();

    return (
        <ValidatorManagerLayout subnetIdL1={subnetIdL1} globalError={globalError} showPoSWarning>
            <StepFlow
                steps={steps}
                basePath={basePath}
                currentStepKey={currentStepKey}
            />
        </ValidatorManagerLayout>
    );
}
