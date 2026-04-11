import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1DelegationStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/SelectL1DelegationStep";
import InitiateDelegatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/InitiateDelegatorRemovalStep";
import PChainDelegationWeightUpdateStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/PChainDelegationWeightUpdateStep";
import CompleteDelegatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/CompleteDelegatorRemovalStep";

export const steps: StepDefinition[] = [
    { type: "single", key: "select-l1", title: "Select L1 Subnet", component: SelectL1DelegationStep },
    { type: "single", key: "initiate-removal", title: "Initiate Delegator Removal", component: InitiateDelegatorRemovalStep },
    { type: "single", key: "pchain-weight-update", title: "P-Chain Weight Update", component: PChainDelegationWeightUpdateStep },
    { type: "single", key: "complete-removal", title: "Complete Delegator Removal", component: CompleteDelegatorRemovalStep },
];
