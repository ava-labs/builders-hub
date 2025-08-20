"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
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
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}


