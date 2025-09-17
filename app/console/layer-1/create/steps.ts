import { type StepDefinition } from "@/components/console/step-flow";
import CreateChain from "@/components/toolbox/console/layer-1/create/CreateChain";
import AvalancheGoDockerL1 from "@/components/toolbox/console/layer-1/AvalancheGoDockerL1";
import ConvertToL1 from "@/components/toolbox/console/layer-1/create/ConvertToL1";
import ManagedTestnetNodes from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes";

export const steps: StepDefinition[] = [
    {
      type: "single",
      key: "create-chain",
      title: "Create Chain",
      component: CreateChain,
    },
    {
      type: "branch",
      key: "node-setup",
      title: "Set Up a Node",
      options: [
        { key: "l1-node-setup", label: "L1 Node Setup with Docker", component: AvalancheGoDockerL1 },
        { key: "managed-testnet-l1-nodes", label: "Managed Testnet L1 Nodes", component: ManagedTestnetNodes },
      ],
    },
    {
      type: "single",
      key: "convert-to-l1",
      title: "Convert to L1",
      component: ConvertToL1,
    },
];
