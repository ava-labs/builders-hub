"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployPoAManager from "../../../../toolbox/src/toolbox/ValidatorManager/DeployPoAManager";
import TransferOwnership from "../../../../toolbox/src/toolbox/StakingManager/TransferOwnership";

import ReadContract from "@/toolbox/src/toolbox/ValidatorManager/ReadContract";

export default function Page() {
  const steps: StepDefinition[] = [
    { type: "single", key: "deploy-poa", title: "Deploy POA Manager", component: DeployPoAManager },
    { type: "single", key: "transfer-ownership", title: "Transfer Ownership", component: TransferOwnership },
    { type: "single", key: "read-contract", title: "Read Contract", component: ReadContract },
  ];

  return (
    <ToolboxConsoleWrapper>
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}

