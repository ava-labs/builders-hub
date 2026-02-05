import { type StepDefinition } from "@/components/console/step-flow";
import DelegateNative from "@/components/toolbox/console/permissionless-l1s/delegate/DelegateNative";
import DelegateERC20 from "@/components/toolbox/console/permissionless-l1s/delegate/DelegateERC20";

export const steps: StepDefinition[] = [
    {
        type: "branch",
        key: "delegate-to-validator",
        title: "Delegate to Validator",
        options: [
            { key: "native", label: "Native Token", component: DelegateNative },
            { key: "erc20", label: "ERC20 Token", component: DelegateERC20 },
        ],
    },
];
