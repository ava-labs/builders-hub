"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import type { BubbleNavigationConfig } from '@/components/navigation/bubble-navigation.types';

export const statsBubbleConfig: BubbleNavigationConfig = {
    items: [
        { id: "avalanche-l1s", label: "Avalanche L1s", href: "/stats/overview" },
        { id: "c-chain", label: "C-Chain", href: "/stats/primary-network/c-chain" },
        { id: "validators", label: "Validators", href: "/stats/primary-network/validators" },
    ],
    activeColor: "bg-blue-600",
    darkActiveColor: "dark:bg-blue-500",
    focusRingColor: "focus:ring-blue-500",
    pulseColor: "bg-blue-200/40",
    darkPulseColor: "dark:bg-blue-400/40",
};

export function StatsBubbleNav() {
    const getActiveItem = (pathname: string, items: typeof statsBubbleConfig.items) => {
        const currentItem = items.find((item) => pathname === item.href);
        if (currentItem) {
            return currentItem.id;
        } else if (pathname.startsWith("/stats/l1/")) {
            return "";
        }
        return "overview";
    };

    return <BubbleNavigation config={statsBubbleConfig} getActiveItem={getActiveItem} />;
}
