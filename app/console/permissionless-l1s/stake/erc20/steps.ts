import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetERC20Step from "@/components/toolbox/console/permissionless-l1s/stake/steps/SelectSubnetERC20Step";
import InitiateERC20RegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/InitiateERC20RegistrationStep";
import PChainRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/PChainRegistrationStep";
import CompleteRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/CompleteRegistrationStep";
import VerifyValidatorSetStep from "@/components/toolbox/console/permissioned-l1s/shared/VerifyValidatorSetStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetERC20Step },
  { type: "single", key: "initiate-registration", title: "Initiate Registration", component: InitiateERC20RegistrationStep },
  { type: "single", key: "pchain-registration", title: "P-Chain Registration", component: PChainRegistrationStep },
  { type: "single", key: "complete-registration", title: "Complete Registration", component: CompleteRegistrationStep },
  { type: "single", key: "verify-validator-set", title: "Verify Validator Set", optional: true, component: VerifyValidatorSetStep },
];
