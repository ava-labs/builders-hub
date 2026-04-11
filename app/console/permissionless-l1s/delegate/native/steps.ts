import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1NativeStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/SelectL1NativeStep";
import InitiateDelegationStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/InitiateDelegationStep";
import PChainWeightUpdateStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/PChainWeightUpdateStep";
import CompleteDelegationStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/CompleteDelegationStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-l1", title: "Select L1 Subnet", component: SelectL1NativeStep },
  { type: "single", key: "initiate-delegation", title: "Initiate Delegation", component: InitiateDelegationStep },
  { type: "single", key: "pchain-weight-update", title: "P-Chain Weight Update", component: PChainWeightUpdateStep },
  { type: "single", key: "complete-delegation", title: "Complete Delegation", component: CompleteDelegationStep },
];
