"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import { academyBubbleConfig } from '@/components/navigation/configs/academy-bubble.config';

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
