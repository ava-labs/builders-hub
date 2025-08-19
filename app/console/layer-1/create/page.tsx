"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";
import CreateChain from "../../../../toolbox/src/toolbox/L1/CreateChain";
import AvalancheGoDockerL1 from "../../../../toolbox/src/toolbox/Nodes/AvalancheGoDockerL1";
import ConvertToL1 from "../../../../toolbox/src/toolbox/L1/ConvertToL1";
import ManagedTestnetNodes from "@/toolbox/src/toolbox/Nodes/ManagedTestnetNodes";

function ManagedTestnetNodesPlaceholder() {
  return (
    <div className="p-4 w-full h-96 text-center flex flex-col items-center justify-center rounded-2xl border">
      <h2 className="text-3xl font-semibold mb-2">🏗️ Managed Testnet L1 Nodes</h2>
      <p className="text-gray-600">This feature is coming soon. Stay tuned!</p>
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
        { key: "l1-node-setup", label: "L1 Node Setup with Docker", component: AvalancheGoDockerL1 },
        { key: "managed-testnet-l1-nodes", label: "Managed Testnet L1 Nodes (coming soon)", component: ManagedTestnetNodesPlaceholder },
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
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}