import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1DelegationNativeStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/SelectL1DelegationNativeStep";
import SelectL1DelegationERC20Step from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/SelectL1DelegationERC20Step";
import InitiateDelegatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/InitiateDelegatorRemovalStep";
import PChainDelegationWeightUpdateStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/PChainDelegationWeightUpdateStep";
import CompleteDelegatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/CompleteDelegatorRemovalStep";

export const steps: StepDefinition[] = [
    {
        type: "branch",
        key: "select-l1",
        title: "Select L1 & Token Type",
        options: [
            { key: "native", label: "Native Token", component: SelectL1DelegationNativeStep },
            { key: "erc20", label: "ERC20 Token", component: SelectL1DelegationERC20Step },
        ],
    },
    {
        type: "single",
        key: "initiate-removal",
        title: "Initiate Delegator Removal",
        component: InitiateDelegatorRemovalStep,
    },
    {
        type: "single",
        key: "pchain-weight-update",
        title: "P-Chain Weight Update",
        component: PChainDelegationWeightUpdateStep,
    },
    {
        type: "single",
        key: "complete-removal",
        title: "Complete Delegator Removal",
        component: CompleteDelegatorRemovalStep,
    },
];
