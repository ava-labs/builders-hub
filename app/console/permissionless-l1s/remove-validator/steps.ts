import { type StepDefinition } from "@/components/console/step-flow";
import RemoveValidatorNative from "@/components/toolbox/console/permissionless-l1s/withdraw/RemoveValidatorNative";
import RemoveValidatorERC20 from "@/components/toolbox/console/permissionless-l1s/withdraw/RemoveValidatorERC20";

export const steps: StepDefinition[] = [
    {
        type: "branch",
        key: "remove-validator",
        title: "Remove Validator",
        options: [
            { key: "native", label: "Native Token", component: RemoveValidatorNative },
            { key: "erc20", label: "ERC20 Token", component: RemoveValidatorERC20 },
        ],
    },
];
