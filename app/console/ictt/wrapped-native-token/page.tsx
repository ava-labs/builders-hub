"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployWrappedNativeToken from "../../../../toolbox/src/toolbox/ICTT/DeployWrappedNativeToken";

export default function Page() {
    const steps: StepDefinition[] = [
        { type: "single", key: "deploy-wrapped-native-token", title: "Deploy Wrapped Native Token", component: DeployWrappedNativeToken },
    ];

    return (
        <ToolboxConsoleWrapper>
            <StepFlow steps={steps} />
        </ToolboxConsoleWrapper>
    );
}


