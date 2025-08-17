"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";
import CreateChain from "../../../../toolbox/src/toolbox/L1/CreateChain";
import AvalancheGoDockerL1 from "../../../../toolbox/src/toolbox/Nodes/AvalancheGoDockerL1";
import ConvertToL1 from "../../../../toolbox/src/toolbox/L1/ConvertToL1";

function BuilderHubNodePlaceholder() {
  return (
    <div className="flex items-center justify-center py-12 text-zinc-600 dark:text-zinc-300">
      BuilderHub Node setup coming soon.
    </div>
  );
}

export default function Page() {
  const steps: StepDefinition[] = [
    {
      type: "single",
      key: "create-chain",
      title: "Create Chain",
      description: "Create a Subnet and add a blockchain with custom parameters.",
      component: CreateChain,
    },
    {
      type: "branch",
      key: "node-setup",
      title: "Set Up a Node",
      description: "Choose how you want to run your node.",
      options: [
        { key: "avalanchego", label: "AvalancheGo Docker", component: AvalancheGoDockerL1 },
        { key: "builderhub", label: "BuilderHub Node (coming soon)", component: BuilderHubNodePlaceholder },
      ],
    },
    {
      type: "single",
      key: "convert-to-l1",
      title: "Convert to L1",
      description: "Convert your Subnet to an L1.",
      component: ConvertToL1,
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