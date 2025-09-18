import { type StepDefinition } from "@/components/console/step-flow";
import DeployExampleERC20 from "@/components/toolbox/console/ictt/setup/DeployExampleERC20";
import DeployTokenHome from "@/components/toolbox/console/ictt/setup/DeployTokenHome";
import DeployERC20TokenRemote from "@/components/toolbox/console/ictt/setup/DeployERC20TokenRemote";
import DeployNativeTokenRemote from "@/components/toolbox/console/ictt/setup/DeployNativeTokenRemote";
import RegisterWithHome from "@/components/toolbox/console/ictt/setup/RegisterWithHome";
import AddCollateral from "@/components/toolbox/console/ictt/setup/AddCollateral";
import DeployWrappedNative from "@/components/toolbox/console/ictt/setup/DeployWrappedNative";

export const steps: StepDefinition[] = [
    {
      type: "branch",
      key: "deploy-source-token",
      title: "Deploy Source Token",
      optional: true,
      options: [
        { key: "deploy-test-erc20", label: "Deploy Test ERC20", component: DeployExampleERC20 },
        { key: "deploy-wrapped-native", label: "Deploy Wrapped Native Token", component: DeployWrappedNative },
      ],
    },
    {
      type: "single",
      key: "deploy-token-home",
      title: "Deploy Token Home",
      component: DeployTokenHome,
    },
    {
      type: "branch",
      key: "deploy-remote",
      title: "Deploy Remote",
      options: [
        { key: "erc20-remote", label: "Deploy ERC20 Token Remote", component: DeployERC20TokenRemote },
        { key: "native-remote", label: "Deploy Native Token Remote", component: DeployNativeTokenRemote },
      ],
    },
    {
      type: "single",
      key: "register-with-home",
      title: "Register With Home",
      component: RegisterWithHome,
    },
    {
      type: "single",
      key: "add-collateral",
      title: "Add Collateral",
      component: AddCollateral,
    },
];
