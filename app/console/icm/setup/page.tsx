"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import TeleporterMessenger from "../../../../toolbox/src/toolbox/ICM/TeleporterMessenger";
import TeleporterRegistry from "../../../../toolbox/src/toolbox/ICM/TeleporterRegistry";
import ICMRelayer from "../../../../toolbox/src/toolbox/ICM/ICMRelayer";

export default function Page() {
  const steps: StepDefinition[] = [
    {
      type: "single",
      key: "icm-messenger-deployment",
      title: "Deploy ICM Messenger",
      component: TeleporterMessenger,
    },
    {
      type: "single",
      key: "icm-registry-deployment",
      title: "Deploy ICM Registry",
      component: TeleporterRegistry,
    },
    {
      type: "single",
      key: "icm-relayer",
      title: "Setup ICM Relayer",
      component: ICMRelayer,
    },
  ];

  return (
    <ToolboxConsoleWrapper>
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}


