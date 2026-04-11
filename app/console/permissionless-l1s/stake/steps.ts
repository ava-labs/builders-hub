import { type StepDefinition } from "@/components/console/step-flow";
import SelectL1NativeStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/SelectL1NativeStep";
import SelectL1ERC20Step from "@/components/toolbox/console/permissionless-l1s/stake/steps/SelectL1ERC20Step";
import InitiateRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/InitiateRegistrationStep";
import PChainRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/PChainRegistrationStep";
import CompleteRegistrationStep from "@/components/toolbox/console/permissionless-l1s/stake/steps/CompleteRegistrationStep";

export const steps: StepDefinition[] = [
  {
    type: "branch",
    key: "select-l1",
    title: "Select L1 & Token Type",
    options: [
      { key: "native", label: "Native Token Staking", component: SelectL1NativeStep },
      { key: "erc20", label: "ERC20 Token Staking", component: SelectL1ERC20Step },
    ],
  },
  { type: "single", key: "initiate-registration", title: "Initiate Validator Registration", component: InitiateRegistrationStep },
  { type: "single", key: "pchain-registration", title: "P-Chain Registration", component: PChainRegistrationStep },
  { type: "single", key: "complete-registration", title: "Complete Registration", component: CompleteRegistrationStep },
];
