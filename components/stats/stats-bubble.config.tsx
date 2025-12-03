"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import type { BubbleNavigationConfig } from '@/components/navigation/bubble-navigation.types';

export const statsBubbleConfig: BubbleNavigationConfig = {
    items: [
        { id: "overview", label: "Overview", href: "/stats/overview" },
        { id: "stats", label: "Stats", href: "/stats/network-metrics" },
        { id: "playground", label: "Playground", href: "/stats/playground" },
        { id: "validators", label: "Validators", href: "/stats/validators" },
    ],
    activeColor: "bg-red-600",
    darkActiveColor: "dark:bg-red-500",
    focusRingColor: "focus:ring-red-500",
    pulseColor: "bg-red-200/40",
    darkPulseColor: "dark:bg-red-400/40",
};

export function StatsBubbleNav() {
    const getActiveItem = (pathname: string, items: typeof statsBubbleConfig.items) => {
        const currentItem = items.find((item) => pathname === item.href);
        if (currentItem) {
            return currentItem.id;
        } else if (pathname.startsWith("/stats/network-metrics")) {
            return "stats"; // All chains stats page
        } else if (pathname.startsWith("/stats/playground")) {
            return "playground";
        } else if (pathname.startsWith("/stats/validators")) {
            return "validators"; // All validator pages including c-chain and L1s
        }
        return "overview";
    };

    return <BubbleNavigation config={statsBubbleConfig} getActiveItem={getActiveItem} />;
}
