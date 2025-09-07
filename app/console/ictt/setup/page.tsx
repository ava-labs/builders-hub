"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployExampleERC20 from "../../../../toolbox/src/toolbox/ICTT/DeployExampleERC20";
import DeployTokenHome from "../../../../toolbox/src/toolbox/ICTT/DeployTokenHome";
import DeployERC20TokenRemote from "../../../../toolbox/src/toolbox/ICTT/DeployERC20TokenRemote";
import DeployNativeTokenRemote from "../../../../toolbox/src/toolbox/ICTT/DeployNativeTokenRemote";
import RegisterWithHome from "../../../../toolbox/src/toolbox/ICTT/RegisterWithHome";
import AddCollateral from "../../../../toolbox/src/toolbox/ICTT/AddCollateral";
import DeployWrappedNative from "@/toolbox/src/toolbox/ICTT/DeployWrappedNative";

export default function Page() {
  const steps: StepDefinition[] = [
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

  return (
    <ToolboxConsoleWrapper>
        <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}


