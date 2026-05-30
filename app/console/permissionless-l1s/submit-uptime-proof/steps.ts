import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1UptimeStep from "@/components/toolbox/console/permissionless-l1s/uptime/steps/SelectL1UptimeStep";
import UptimeDashboardStep from "@/components/toolbox/console/permissionless-l1s/uptime/steps/UptimeDashboardStep";

export const steps: StepDefinition[] = [
    { type: "single", key: "select-l1", title: "Select L1 Subnet", component: SelectL1UptimeStep },
    { type: "single", key: "dashboard", title: "Validator Uptimes", component: UptimeDashboardStep },
];
