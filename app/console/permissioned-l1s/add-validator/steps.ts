import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetStep from "@/components/toolbox/console/permissioned-l1s/add-validator/steps/SelectSubnetStep";
import ValidatorDetailsStep from "@/components/toolbox/console/permissioned-l1s/add-validator/steps/ValidatorDetailsStep";
import PChainRegistrationStep from "@/components/toolbox/console/permissioned-l1s/add-validator/steps/PChainRegistrationStep";
import CompleteRegistrationStep from "@/components/toolbox/console/permissioned-l1s/add-validator/steps/CompleteRegistrationStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetStep },
  { type: "single", key: "validator-details", title: "Initiate Validator Registration", component: ValidatorDetailsStep },
  { type: "single", key: "pchain-registration", title: "P-Chain Registration", component: PChainRegistrationStep },
  { type: "single", key: "complete-registration", title: "Complete Registration", component: CompleteRegistrationStep },
];
