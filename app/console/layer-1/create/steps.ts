import { type StepDefinition } from "@/components/console/step-flow";
import CreateChain from "@/components/toolbox/console/layer-1/create/CreateChain";
import AvalancheGoDockerL1 from "@/components/toolbox/console/layer-1/AvalancheGoDockerL1";
import ConvertSubnetToL1 from "@/components/toolbox/console/layer-1/create/ConvertSubnetToL1";
import CreateManagedTestnetNode from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/CreateManagedTestnetNode";

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
        { key: "managed-testnet-l1-nodes", label: "Managed Testnet L1 Nodes", component: CreateManagedTestnetNode },
        { key: "l1-node-setup", label: "L1 Node Setup with Docker", component: AvalancheGoDockerL1 },
      ],
    },
    {
      type: "single",
      key: "convert-to-l1",
      title: "Convert to L1",
      component: ConvertSubnetToL1,
    },
];
