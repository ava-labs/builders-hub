import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetStep from "@/components/toolbox/console/add-validator/steps/SelectSubnetStep";
import InitiateRegistrationStep from "@/components/toolbox/console/add-validator/steps/InitiateRegistrationStep";
import PChainRegistrationStep from "@/components/toolbox/console/add-validator/steps/PChainRegistrationStep";
import CompleteRegistrationStep from "@/components/toolbox/console/add-validator/steps/CompleteRegistrationStep";
import VerifyValidatorSetStep from "@/components/toolbox/console/permissioned-l1s/shared/VerifyValidatorSetStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetStep },
  { type: "single", key: "initiate-registration", title: "Initiate Validator Registration", component: InitiateRegistrationStep },
  { type: "single", key: "pchain-registration", title: "P-Chain Registration", component: PChainRegistrationStep },
  { type: "single", key: "complete-registration", title: "Complete Registration", component: CompleteRegistrationStep },
  { type: "single", key: "verify-validator-set", title: "Verify Validator Set", optional: true, component: VerifyValidatorSetStep },
];
