"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployProxyContract from "../../../../toolbox/src/toolbox/Proxy/DeployProxyContract";
import DeployValidatorManager from "../../../../toolbox/src/toolbox/ValidatorManager/DeployValidatorManager";
import UpgradeProxy from "../../../../toolbox/src/toolbox/Proxy/UpgradeProxy";
import Initialize from "../../../../toolbox/src/toolbox/ValidatorManager/Initialize";
import InitValidatorSet from "../../../../toolbox/src/toolbox/ValidatorManager/InitValidatorSet";
import ReadContract from "@/toolbox/src/toolbox/ValidatorManager/ReadContract";

export default function Page() {
  const steps: StepDefinition[] = [
    { type: "single", key: "deploy-validator-manager", title: "Deploy Validator Manager", component: DeployValidatorManager },
    { type: "single", key: "deploy-proxy", title: "Deploy Proxy", component: DeployProxyContract },
    { type: "single", key: "upgrade-proxy", title: "Upgrade Proxy", component: UpgradeProxy },
    { type: "single", key: "initialize-manager", title: "Initialize Manager", component: Initialize },
    { type: "single", key: "init-validator-set", title: "Initialize Validator Set", component: InitValidatorSet },
    { type: "single", key: "read-contract", title: "Read Contract", component: ReadContract },
  ];

  return (
    <ToolboxConsoleWrapper>
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}


