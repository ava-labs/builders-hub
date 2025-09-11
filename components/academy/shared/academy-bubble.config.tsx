"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import type { BubbleNavigationConfig } from '@/components/navigation/bubble-navigation.types';

export const academyBubbleConfig: BubbleNavigationConfig = {
    items: [
        { id: "avalanche", label: "Avalanche Developer", href: "/academy" },
        { id: "entrepreneur", label: "Codebase Entrepreneur", href: "/academy/codebase-entrepreneur" },
    ],
    activeColor: "bg-red-600",
    darkActiveColor: "dark:bg-red-500",
    focusRingColor: "focus:ring-red-500",
    pulseColor: "bg-red-200/40",
    darkPulseColor: "dark:bg-red-400/40",
    buttonPadding: "px-3 py-1.5",
    buttonSpacing: "space-x-3",
    buttonScale: "scale-90",
};

export function AcademyBubbleNav() {
    const getActiveItem = (pathname: string, items: typeof academyBubbleConfig.items) => {
        if (pathname === "/academy/codebase-entrepreneur") {
            return "entrepreneur";
        } else if (pathname === "/academy" || pathname.startsWith("/academy/avalanche")) {
            return "avalanche";
        }
        return "avalanche";
    };

    return <BubbleNavigation config={academyBubbleConfig} getActiveItem={getActiveItem} />;
}
