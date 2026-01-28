import { type StepDefinition } from "@/components/console/step-flow";
import ReadContract from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ReadContract";
import DeployERC20StakingManager from "@/components/toolbox/console/permissionless-l1s/setup/erc20/DeployERC20StakingManager";
import DeployExampleERC20 from "@/components/toolbox/console/permissionless-l1s/setup/erc20/DeployExampleERC20";
import InitializeERC20StakingManager from "@/components/toolbox/console/permissionless-l1s/setup/erc20/InitializeERC20StakingManager";
import EnableERC20StakingManagerMinting from "@/components/toolbox/console/permissionless-l1s/setup/erc20/EnableERC20StakingManagerMinting";
import DeployExampleRewardCalculator from "@/components/toolbox/console/permissionless-l1s/setup/DeployExampleRewardCalculator";
import TransferOwnershipToStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/TransferOwnershipToStakingManager";

export const steps: StepDefinition[] = [
    {
        type: "single",
        key: "deploy-erc20-staking-manager",
        title: "Deploy ERC20 Token Staking Manager",
        component: DeployERC20StakingManager,
    },
    { type: "single", key: "deploy-example-reward-calculator", title: "Deploy Example Reward Calculator", component: DeployExampleRewardCalculator },
    { type: "single", key: "deploy-example-erc20", title: "Deploy Example ERC20 Token", component: DeployExampleERC20 },
    {
        type: "single",
        key: "initialize-erc20-staking-manager",
        title: "Initialize ERC20 Token Staking Manager",
        component: InitializeERC20StakingManager,
    },
    { type: "single", key: "enable-erc20-staking-minting", title: "Enable ERC20 Staking Manager Minting", component: EnableERC20StakingManagerMinting },
    { type: "single", key: "transfer-ownership", title: "Transfer Ownership to Staking Manager", component: TransferOwnershipToStakingManager },
    { type: "single", key: "read-contract", title: "Read Contract", component: ReadContract },
];