"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployProxyContract from "../../../../toolbox/src/toolbox/Proxy/DeployProxyContract";
import DeployValidatorManager from "../../../../toolbox/src/toolbox/ValidatorManager/DeployValidatorManager";
import UpgradeProxy from "../../../../toolbox/src/toolbox/Proxy/UpgradeProxy";
import Initialize from "../../../../toolbox/src/toolbox/ValidatorManager/Initialize";
import InitValidatorSet from "../../../../toolbox/src/toolbox/ValidatorManager/InitValidatorSet";

export default function Page() {
  const steps: StepDefinition[] = [
    { type: "single", key: "deploy-validator-manager", title: "Deploy Validator Manager", component: DeployValidatorManager },
    { type: "single", key: "deploy-proxy", title: "Deploy Proxy", component: DeployProxyContract },
    { type: "single", key: "upgrade-proxy", title: "Upgrade Proxy", component: UpgradeProxy },
    { type: "single", key: "initialize-manager", title: "Initialize Manager", component: Initialize },
    { type: "single", key: "init-validator-set", title: "Initialize Validator Set", component: InitValidatorSet },
  ];

  return (
    <ToolboxConsoleWrapper>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <StepFlow steps={steps} />
      </div>
    </ToolboxConsoleWrapper>
  );
}


