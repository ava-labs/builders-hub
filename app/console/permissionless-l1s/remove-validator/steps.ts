import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1ValidatorNativeStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/SelectL1ValidatorNativeStep";
import SelectL1ValidatorERC20Step from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/SelectL1ValidatorERC20Step";
import InitiateValidatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/InitiateValidatorRemovalStep";
import PChainValidatorWeightUpdateStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/PChainValidatorWeightUpdateStep";
import CompleteValidatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/CompleteValidatorRemovalStep";
import ClaimDelegationFeesStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/ClaimDelegationFeesStep";

export const steps: StepDefinition[] = [
    {
        type: "branch",
        key: "select-l1",
        title: "Select L1 & Token Type",
        options: [
            { key: "native", label: "Native Token", component: SelectL1ValidatorNativeStep },
            { key: "erc20", label: "ERC20 Token", component: SelectL1ValidatorERC20Step },
        ],
    },
    {
        type: "single",
        key: "initiate-removal",
        title: "Initiate Removal",
        component: InitiateValidatorRemovalStep,
    },
    {
        type: "single",
        key: "pchain-weight-update",
        title: "P-Chain Weight Update",
        component: PChainValidatorWeightUpdateStep,
    },
    {
        type: "single",
        key: "complete-removal",
        title: "Complete Removal",
        component: CompleteValidatorRemovalStep,
    },
    {
        type: "single",
        key: "claim-fees",
        title: "Claim Delegation Fees",
        optional: true,
        component: ClaimDelegationFeesStep,
    },
];
