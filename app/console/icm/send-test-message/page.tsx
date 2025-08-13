"use client";

import StepFlow, { type StepDefinition } from "../../components/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployICMDemo from "../../../../toolbox/src/toolbox/ICM/DeployICMDemo";
import SendICMMessage from "../../../../toolbox/src/toolbox/ICM/SendICMMessage";

export default function Page() {
  const steps: StepDefinition[] = [
    {
      type: "single",
      key: "deploy-icm-demo",
      title: "Deploy ICM Demo",
      component: DeployICMDemo,
    },
    {
      type: "single",
      key: "send-icm-message",
      title: "Send ICM Message",
      component: SendICMMessage,
    },
  ];

  return (
    <ToolboxConsoleWrapper>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <StepFlow steps={steps} />
      </div>
    </ToolboxConsoleWrapper>
  );
}


