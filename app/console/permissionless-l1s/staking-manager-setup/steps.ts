import { type StepDefinition } from "@/components/console/step-flow";
import ReadContract from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ReadContract";
import DeployStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/DeployStakingManager";
import InitializeStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/InitializeStakingManager";
import DeployExampleRewardCalculator from "@/components/toolbox/console/permissionless-l1s/setup/DeployExampleRewardCalculator";
import DeployExampleERC20 from "@/components/toolbox/console/ictt/setup/DeployExampleERC20";
import TransferOwnershipToStakingManager from "@/components/toolbox/console/permissionless-l1s/setup/TransferOwnershipToStakingManager";
import EnableStakingManagerMinting from "@/components/toolbox/console/permissionless-l1s/setup/EnableStakingManagerMinting";

export const steps: StepDefinition[] = [
    {
        type: "single",
        key: "deploy-staking-manager",
        title: "Deploy Staking Manager",
        component: DeployStakingManager,
    },
    {
        type: "single",
        key: "deploy-example-erc20",
        title: "Deploy Example ERC20 (Optional)",
        component: DeployExampleERC20
    },
    {
        type: "single",
        key: "deploy-example-reward-calculator",
        title: "Deploy Example Reward Calculator",
        component: DeployExampleRewardCalculator
    },
    {
        type: "single",
        key: "initialize-staking-manager",
        title: "Initialize Staking Manager",
        component: InitializeStakingManager,
    },
    {
        type: "single",
        key: "enable-staking-minting",
        title: "Enable Staking Manager Minting",
        component: EnableStakingManagerMinting
    },
    {
        type: "single",
        key: "transfer-ownership",
        title: "Transfer Ownership to Staking Manager",
        component: TransferOwnershipToStakingManager
    },
    {
        type: "single",
        key: "read-contract",
        title: "Read Contract",
        component: ReadContract
    },
];
