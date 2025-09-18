import { type StepDefinition } from "@/components/console/step-flow";
import TeleporterMessenger from "@/components/toolbox/console/icm/setup/TeleporterMessenger";
import TeleporterRegistry from "@/components/toolbox/console/icm/setup/TeleporterRegistry";
import ICMRelayer from "@/components/toolbox/console/icm/setup/ICMRelayer";

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
      type: "single",
      key: "icm-relayer",
      title: "Setup ICM Relayer",
      component: ICMRelayer,
    },
];
