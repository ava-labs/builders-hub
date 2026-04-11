import { type StepDefinition } from "@/components/console/step-flow";
import DeployStep from "@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/DeployStep";
import DeployRewardCalculatorStep from "@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/DeployRewardCalculatorStep";
import InitializeStep from "@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/InitializeStep";
import EnableMintingStep from "@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/EnableMintingStep";
import TransferOwnershipStep from "@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/TransferOwnershipStep";
import ReadContractStep from "@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/ReadContractStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "deploy", title: "Deploy Native Staking Manager", component: DeployStep },
  { type: "single", key: "deploy-reward-calculator", title: "Deploy Reward Calculator", component: DeployRewardCalculatorStep },
  { type: "single", key: "initialize", title: "Initialize Staking Manager", component: InitializeStep },
  { type: "single", key: "enable-minting", title: "Enable Staking Manager Minting", component: EnableMintingStep },
  { type: "single", key: "transfer-ownership", title: "Transfer Ownership", component: TransferOwnershipStep },
  { type: "single", key: "read-contract", title: "Read Contract", component: ReadContractStep },
];
