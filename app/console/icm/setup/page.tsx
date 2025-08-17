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
      key: "teleporter-messenger",
      title: "Deploy TeleporterMessenger",
      component: TeleporterMessenger,
    },
    {
      type: "single",
      key: "teleporter-registry",
      title: "Deploy Teleporter Registry",
      component: TeleporterRegistry,
    },
    {
      type: "single",
      key: "icm-relayer",
      title: "Configure ICM Relayer",
      component: ICMRelayer,
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


