import { type StepDefinition } from "@/components/console/step-flow";
import ReadContract from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ReadContract";
import DeployNativeTokenStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/native/DeployNativeStakingManager";
import InitializeNativeTokenStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/native/InitializeNativeStakingManager";
import DeployERC20StakingManager from "@/components/toolbox/console/permissionless-l1s/setup/erc20/DeployERC20StakingManager";
import InitializeERC20StakingManager from "@/components/toolbox/console/permissionless-l1s/setup/erc20/InitializeERC20StakingManager";
import DeployExampleRewardCalculator from "@/components/toolbox/console/permissionless-l1s/setup/DeployExampleRewardCalculator";
import TransferOwnership from "@/components/toolbox/console/permissioned-l1s/multisig-setup/TransferOwnership";
import EnableStakingManagerMinting from "@/components/toolbox/console/permissionless-l1s/setup/native/EnableStakingManagerMinting";

export const steps: StepDefinition[] = [
    {
        type: "single",
        key: "deploy-native-token-staking-manager",
        title: "Deploy Staking Manager",
        component: DeployNativeTokenStakingManager,
    },
    { type: "single", key: "deploy-example-reward-calculator", title: "Deploy Example Reward Calculator", component: DeployExampleRewardCalculator },
    {
        type: "single",
        key: "initialize-native-staking-manager",
        title: "Initialize Staking Manager",
        component: InitializeNativeTokenStakingManager,
    },
    { type: "single", key: "enable-staking-minting", title: "Enable StakingManager in Native Minter", component: EnableStakingManagerMinting },
    { type: "single", key: "transfer-ownership", title: "Transfer Ownership", component: TransferOwnership },
    { type: "single", key: "read-contract", title: "Read Contract", component: ReadContract },
];
