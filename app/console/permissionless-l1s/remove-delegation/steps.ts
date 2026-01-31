import { type StepDefinition } from "@/components/console/step-flow";
import RemoveDelegationNative from "@/components/toolbox/console/permissionless-l1s/withdraw/RemoveDelegationNative";
import RemoveDelegationERC20 from "@/components/toolbox/console/permissionless-l1s/withdraw/RemoveDelegationERC20";

export const steps: StepDefinition[] = [
    {
        type: "branch",
        key: "remove-delegation",
        title: "Remove Delegation",
        options: [
            { key: "native", label: "Native Token", component: RemoveDelegationNative },
            { key: "erc20", label: "ERC20 Token", component: RemoveDelegationERC20 },
        ],
    },
];
