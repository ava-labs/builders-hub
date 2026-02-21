import { type StepDefinition } from "@/components/console/step-flow";
import ConfigureUpgrades from "@/components/toolbox/console/layer-1/upgrade/ConfigureUpgrades";
import ExportUpgrade from "@/components/toolbox/console/layer-1/upgrade/ExportUpgrade";

export const steps: StepDefinition[] = [
  {
    type: "single",
    key: "configure-upgrades",
    title: "Configure Upgrades",
    component: ConfigureUpgrades,
  },
  {
    type: "single",
    key: "export",
    title: "Export upgrade.json",
    component: ExportUpgrade,
  },
];
