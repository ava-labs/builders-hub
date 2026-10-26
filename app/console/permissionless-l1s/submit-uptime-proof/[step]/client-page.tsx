"use client";

import StepFlow from "@/components/console/step-flow";
import { steps } from "../steps";
import { useUptimeProofStore } from "@/components/toolbox/stores/uptimeProofStore";
import ValidatorManagerLayout, { validatorManagerPerStep } from "@/components/toolbox/contexts/ValidatorManagerLayout";

export default function SubmitUptimeProofClientPage({ currentStepKey }: { currentStepKey: string }) {
    const basePath = "/console/permissionless-l1s/submit-uptime-proof";
    const { subnetIdL1 } = useUptimeProofStore();

    return (
        <ValidatorManagerLayout subnetIdL1={subnetIdL1} providerPerStep showPoSWarning>
            <StepFlow
                steps={steps}
                basePath={basePath}
                currentStepKey={currentStepKey}
                wrapStep={validatorManagerPerStep(subnetIdL1)}
            />
        </ValidatorManagerLayout>
    );
}
