"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import type { BubbleNavigationConfig } from '@/components/navigation/bubble-navigation.types';
import type { AcademyPathType } from './academy-types';

export const academyBubbleConfig: BubbleNavigationConfig = {
    items: [
        { id: "avalanche", label: "Avalanche L1", href: "/academy/avalanche-l1" },
        { id: "blockchain", label: "Blockchain", href: "/academy/blockchain" },
        { id: "entrepreneur", label: "Entrepreneur", href: "/academy/entrepreneur" },
    ],
    activeColor: "bg-red-600",
    darkActiveColor: "dark:bg-red-500",
    focusRingColor: "focus:ring-red-500",
    pulseColor: "bg-red-200/40",
    darkPulseColor: "dark:bg-red-400/40",
    buttonPadding: "px-4 py-2",
    buttonSpacing: "space-x-3",
};

interface AcademyBubbleNavProps {
    activePath?: AcademyPathType;
    onChange?: (path: AcademyPathType) => void;
}

export function AcademyBubbleNav(props: AcademyBubbleNavProps = {}) {
    const { activePath, onChange } = props;

    if (!activePath || !onChange) {
    const getActiveItem = (pathname: string, items: typeof academyBubbleConfig.items) => {
        if (pathname === "/academy/entrepreneur" || pathname.startsWith("/academy/entrepreneur/")) {
            return "entrepreneur";
        } else if (pathname === "/academy/blockchain" || pathname.startsWith("/academy/blockchain/")) {
            return "blockchain";
        } else if (
            pathname === "/academy" ||
            pathname === "/academy/avalanche-l1" ||
            pathname.startsWith("/academy/avalanche-l1/") ||
            (pathname.startsWith("/academy/") &&
                !pathname.startsWith("/academy/blockchain") &&
                !pathname.startsWith("/academy/entrepreneur"))
        ) {
            return "avalanche";
        }
        return "avalanche";
    };

    return <BubbleNavigation config={academyBubbleConfig} getActiveItem={getActiveItem} />;
    }

    return (
        <BubbleNavigation
            config={academyBubbleConfig}
            activeItem={activePath}
            onSelect={(item) => onChange(item.id as AcademyPathType)}
        />
    );
}
