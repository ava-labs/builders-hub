import { type StepDefinition } from "@/components/console/step-flow-switcher";
import TeleporterMessenger from "@/components/toolbox/console/icm/setup/TeleporterMessenger";
import TeleporterRegistry from "@/components/toolbox/console/icm/setup/TeleporterRegistry";
import ICMRelayer from "@/components/toolbox/console/icm/setup/ICMRelayer";
import CreateManagedTestnetRelayer from "@/components/toolbox/console/testnet-infra/ManagedTestnetRelayers/CreateManagedTestnetRelayer";
import DeployICMDemo from "@/components/toolbox/console/icm/test-connection/DeployICMDemo";
import SendICMMessage from "@/components/toolbox/console/icm/test-connection/SendICMMessage";

export const steps: StepDefinition[] = [
    {
      type: "single",
      key: "icm-messenger",
      title: "Deploy Teleporter Messenger",
      component: TeleporterMessenger,
    },
    {
      type: "single",
      key: "icm-registry",
      title: "Deploy Teleporter Registry",
      component: TeleporterRegistry,
    },
    {
      type: "branch",
      key: "icm-relayer-type",
      title: "Setup ICM Relayer",
      options: [
        { key: "self-hosted-relayer", label: "Setup Self Hosted ICM Relayer", component: ICMRelayer },
        { key: "managed-testnet-relayer", label: "Managed Testnet Relayer", component: CreateManagedTestnetRelayer },
      ],
    },
    {
      type: "single",
      key: "deploy-icm-demo",
      title: "Deploy ICM Demo",
      component: DeployICMDemo,
    },
    {
      type: "single",
      key: "send-icm-demo-message",
      title: "Send ICM Message",
      component: SendICMMessage,
    },
];
