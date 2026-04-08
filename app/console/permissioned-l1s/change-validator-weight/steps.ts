import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetStep from "@/components/toolbox/console/permissioned-l1s/ChangeWeight/steps/SelectSubnetStep";
import InitiateWeightChangeStep from "@/components/toolbox/console/permissioned-l1s/ChangeWeight/steps/InitiateWeightChangeStep";
import PChainWeightUpdateStep from "@/components/toolbox/console/permissioned-l1s/ChangeWeight/steps/PChainWeightUpdateStep";
import CompleteWeightChangeStep from "@/components/toolbox/console/permissioned-l1s/ChangeWeight/steps/CompleteWeightChangeStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetStep },
  { type: "single", key: "initiate-weight-change", title: "Initiate Weight Change", component: InitiateWeightChangeStep },
  { type: "single", key: "pchain-weight-update", title: "P-Chain Weight Update", component: PChainWeightUpdateStep },
  { type: "single", key: "complete-weight-change", title: "Complete Weight Change", component: CompleteWeightChangeStep },
];
