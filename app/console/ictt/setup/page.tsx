"use client";

import StepFlow, { type StepDefinition } from "../../components/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";

import DeployExampleERC20 from "../../../../toolbox/src/toolbox/ICTT/DeployExampleERC20";
import DeployTokenHome from "../../../../toolbox/src/toolbox/ICTT/DeployTokenHome";
import DeployERC20TokenRemote from "../../../../toolbox/src/toolbox/ICTT/DeployERC20TokenRemote";
import DeployNativeTokenRemote from "../../../../toolbox/src/toolbox/ICTT/DeployNativeTokenRemote";
import RegisterWithHome from "../../../../toolbox/src/toolbox/ICTT/RegisterWithHome";

export default function Page() {
  const steps: StepDefinition[] = [
    {
      type: "single",
      key: "deploy-example-erc20",
      title: "Deploy Example ERC20",
      component: DeployExampleERC20,
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
  ];

  return (
    <ToolboxConsoleWrapper>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <StepFlow steps={steps} />
      </div>
    </ToolboxConsoleWrapper>
  );
}


