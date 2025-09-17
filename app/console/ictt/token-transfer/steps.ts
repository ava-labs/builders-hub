import { type StepDefinition } from "@/components/console/step-flow";
import AddCollateral from "@/components/toolbox/console/ictt/setup/AddCollateral";
import TestSend from "@/components/toolbox/console/ictt/token-transfer/TestSend";

export const steps: StepDefinition[] = [
    { type: "single", key: "add-collateral", title: "Add Collateral", component: AddCollateral },
    { type: "single", key: "test-send", title: "Test Send", component: TestSend },
];
