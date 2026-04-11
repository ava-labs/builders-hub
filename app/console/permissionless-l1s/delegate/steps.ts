import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1NativeStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/SelectL1NativeStep";
import SelectL1ERC20Step from "@/components/toolbox/console/permissionless-l1s/delegate/steps/SelectL1ERC20Step";
import InitiateDelegationStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/InitiateDelegationStep";
import PChainWeightUpdateStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/PChainWeightUpdateStep";
import CompleteDelegationStep from "@/components/toolbox/console/permissionless-l1s/delegate/steps/CompleteDelegationStep";

export const steps: StepDefinition[] = [
  {
    type: "branch",
    key: "select-l1",
    title: "Select L1 & Token Type",
    options: [
      { key: "native", label: "Native Token Delegation", component: SelectL1NativeStep },
      { key: "erc20", label: "ERC20 Token Delegation", component: SelectL1ERC20Step },
    ],
  },
  { type: "single", key: "initiate-delegation", title: "Initiate Delegation", component: InitiateDelegationStep },
  { type: "single", key: "pchain-weight-update", title: "P-Chain Weight Update", component: PChainWeightUpdateStep },
  { type: "single", key: "complete-delegation", title: "Complete Delegation", component: CompleteDelegationStep },
];
