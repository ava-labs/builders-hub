import { type StepDefinition } from "@/components/console/step-flow-switcher";
import StakeNative from "@/components/toolbox/console/permissionless-l1s/Stake/StakeNative";
import StakeERC20 from "@/components/toolbox/console/permissionless-l1s/Stake/StakeERC20";

export const steps: StepDefinition[] = [
    {
        type: "branch",
        key: "stake-validator",
        title: "Stake Validator",
        options: [
            { key: "native", label: "Native Token", component: StakeNative },
            { key: "erc20", label: "ERC20 Token", component: StakeERC20 },
        ],
    },
];
