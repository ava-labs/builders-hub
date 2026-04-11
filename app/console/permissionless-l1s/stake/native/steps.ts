import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetNativeStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/SelectSubnetNativeStep";
import InitiateNativeRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/InitiateNativeRegistrationStep";
import PChainRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/PChainRegistrationStep";
import CompleteRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/CompleteRegistrationStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetNativeStep },
  { type: "single", key: "initiate-registration", title: "Initiate Registration", component: InitiateNativeRegistrationStep },
  { type: "single", key: "pchain-registration", title: "P-Chain Registration", component: PChainRegistrationStep },
  { type: "single", key: "complete-registration", title: "Complete Registration", component: CompleteRegistrationStep },
];
