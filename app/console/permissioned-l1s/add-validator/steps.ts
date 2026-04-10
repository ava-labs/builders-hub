import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetStep from "@/components/toolbox/console/permissioned-l1s/AddValidator/steps/SelectSubnetStep";
import ValidatorDetailsStep from "@/components/toolbox/console/permissioned-l1s/AddValidator/steps/ValidatorDetailsStep";
import InitiateRegistrationStep from "@/components/toolbox/console/permissioned-l1s/AddValidator/steps/InitiateRegistrationStep";
import PChainRegistrationStep from "@/components/toolbox/console/permissioned-l1s/AddValidator/steps/PChainRegistrationStep";
import CompleteRegistrationStep from "@/components/toolbox/console/permissioned-l1s/AddValidator/steps/CompleteRegistrationStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetStep },
  { type: "single", key: "validator-details", title: "Validator Details", component: ValidatorDetailsStep },
  { type: "single", key: "initiate-registration", title: "Initiate Registration", component: InitiateRegistrationStep },
  { type: "single", key: "pchain-registration", title: "P-Chain Registration", component: PChainRegistrationStep },
  { type: "single", key: "complete-registration", title: "Complete Registration", component: CompleteRegistrationStep },
];
