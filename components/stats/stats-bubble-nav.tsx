"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import { statsBubbleConfig } from '@/components/navigation/configs/stats-bubble.config';

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
