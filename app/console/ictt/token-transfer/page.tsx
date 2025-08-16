"use client";

import StepFlow, { type StepDefinition } from "../../components/step-flow";
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
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <StepFlow steps={steps} />
      </div>
    </ToolboxConsoleWrapper>
  );
}


