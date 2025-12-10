import { type StepDefinition } from "@/components/console/step-flow";
import TeleporterMessenger from "@/components/toolbox/console/icm/setup/TeleporterMessenger";
import TeleporterRegistry from "@/components/toolbox/console/icm/setup/TeleporterRegistry";
import ICMRelayer from "@/components/toolbox/console/icm/setup/ICMRelayer";
import CreateManagedTestnetRelayer from "@/components/toolbox/console/testnet-infra/ManagedTestnetRelayers/CreateManagedTestnetRelayer";

export const steps: StepDefinition[] = [
    {
      type: "single",
      key: "icm-messenger",
      title: "Deploy Teleporter Messenger",
      component: TeleporterMessenger,
      description: "Deploy the core Teleporter Messenger contract that handles cross-chain message passing with built-in security guarantees. This contract manages message verification, execution, and receipt handling between chains.",
      outcomes: [
        "Teleporter Messenger contract deployed on your L1",
        "Foundation for cross-chain communication established",
      ],
    },
    {
      type: "single",
      key: "icm-registry",
      title: "Deploy Teleporter Registry",
      component: TeleporterRegistry,
      description: "Deploy the Teleporter Registry contract that tracks different versions of the Teleporter Messenger and enables seamless upgrades. This ensures your cross-chain communication can evolve without disrupting existing integrations.",
      outcomes: [
        "Registry contract deployed with version tracking capabilities",
        "Upgrade path configured for future Teleporter versions",
      ],
    },
    {
      type: "branch",
      key: "icm-relayer-type",
      title: "Setup ICM Relayer",
      description: "Configure a relayer to automatically deliver cross-chain messages. Choose between running your own infrastructure for full control, or using managed services for simplified deployment and maintenance.",
      options: [
        {
          key: "self-hosted-relayer",
          label: "Setup Self Hosted ICM Relayer",
          component: ICMRelayer,
          outcomes: [
            "Full control over relayer infrastructure and configuration",
            "Ability to customize message delivery and monitoring",
          ],
        },
        {
          key: "managed-testnet-relayer",
          label: "Managed Testnet Relayer",
          component: CreateManagedTestnetRelayer,
          outcomes: [
            "Quick setup with zero infrastructure management",
            "Automated message delivery for testnet development",
          ],
        },
      ],
    },
];
