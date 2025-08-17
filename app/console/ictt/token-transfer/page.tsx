"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import AddCollateral from "../../../../toolbox/src/toolbox/ICTT/AddCollateral";
import TestSend from "../../../../toolbox/src/toolbox/ICTT/TestSend";

export default function Page() {
  const steps: StepDefinition[] = [
    { type: "single", key: "add-collateral", title: "Add Collateral", component: AddCollateral },
    { type: "single", key: "test-send", title: "Test Send", component: TestSend },
  ];

  return (
    <ToolboxConsoleWrapper>
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}


