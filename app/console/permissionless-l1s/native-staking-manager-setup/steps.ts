import { type StepDefinition } from "@/components/console/step-flow";
import ReadContract from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ReadContract";
import DeployNativeTokenStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/native/DeployNativeStakingManager";
import InitializeNativeTokenStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/native/InitializeNativeStakingManager";
import DeployExampleRewardCalculator from "@/components/toolbox/console/permissionless-l1s/setup/DeployExampleRewardCalculator";
import TransferOwnershipToStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/TransferOwnershipToStakingManager";
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
    { type: "single", key: "transfer-ownership", title: "Transfer Ownership to Staking Manager", component: TransferOwnershipToStakingManager },
    { type: "single", key: "read-contract", title: "Read Contract", component: ReadContract },
];
