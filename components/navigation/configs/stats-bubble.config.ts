import type { BubbleNavigationConfig } from './bubble-navigation.types';

export const statsBubbleConfig: BubbleNavigationConfig = {
    items: [
        { id: "validators", label: "Validators", href: "/stats/primary-network/validators" },
        { id: "c-chain", label: "C-Chain", href: "/stats/primary-network/c-chain" },
        { id: "avalanche-l1s", label: "Avalanche L1s", href: "/stats/overview" },
    ],
    activeColor: "bg-blue-600",
    darkActiveColor: "dark:bg-blue-500",
    focusRingColor: "focus:ring-blue-500",
    pulseColor: "bg-blue-200/40",
    darkPulseColor: "dark:bg-blue-400/40",
};
