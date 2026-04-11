import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1ValidatorStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/SelectL1ValidatorStep";
import InitiateValidatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/InitiateValidatorRemovalStep";
import PChainValidatorWeightUpdateStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/PChainValidatorWeightUpdateStep";
import CompleteValidatorRemovalStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/CompleteValidatorRemovalStep";
import ClaimDelegationFeesStep from "@/components/toolbox/console/permissionless-l1s/withdraw/steps/ClaimDelegationFeesStep";

export const steps: StepDefinition[] = [
    { type: "single", key: "select-l1", title: "Select L1 Subnet", component: SelectL1ValidatorStep },
    { type: "single", key: "initiate-removal", title: "Initiate Removal", component: InitiateValidatorRemovalStep },
    { type: "single", key: "pchain-weight-update", title: "P-Chain Weight Update", component: PChainValidatorWeightUpdateStep },
    { type: "single", key: "complete-removal", title: "Complete Removal", component: CompleteValidatorRemovalStep },
    { type: "single", key: "claim-fees", title: "Claim Delegation Fees", optional: true, component: ClaimDelegationFeesStep },
];
