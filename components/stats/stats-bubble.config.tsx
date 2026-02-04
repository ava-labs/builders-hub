"use client";

import BubbleNavigation from "@/components/navigation/BubbleNavigation";
import type { BubbleNavigationConfig } from "@/components/navigation/bubble-navigation.types";
import { Globe, List, ChartArea, Command, MessageCircleMore } from "lucide-react";

export const statsBubbleConfig: BubbleNavigationConfig = {
  items: [
    { id: "overview", label: "Overview", href: "/stats/overview", icon: Globe },
    { id: "chain-list", label: "Chain List", href: "/stats/chain-list", icon: List },
    { id: "stats", label: "Stats", href: "/stats/network-metrics", icon: ChartArea },
    { id: "playground", label: "Playground", href: "/stats/playground", icon: Command },
    { id: "icm", label: "ICM", href: "/stats/interchain-messaging", icon: MessageCircleMore },
  ],
  activeColor: "bg-red-100 dark:bg-red-500/20",
  darkActiveColor: "",
  activeTextColor: "text-red-600 dark:text-red-400",
  focusRingColor: "focus:ring-red-500",
  pulseColor: "bg-red-200/40",
  darkPulseColor: "dark:bg-red-400/40",
};

const getActiveItem = (
  pathname: string,
  items: typeof statsBubbleConfig.items
) => {
  const currentItem = items.find((item) => pathname === item.href);
  if (currentItem) {
    return currentItem.id;
  } else if (pathname.startsWith("/stats/chain-list")) {
    return "chain-list";
  } else if (pathname.startsWith("/stats/network-metrics")) {
    return "stats"; // All chains stats page
  } else if (pathname.startsWith("/stats/interchain-messaging")) {
    return "icm";
  } else if (pathname.startsWith("/stats/playground")) {
    return "playground";
  }
  return "overview";
};

export function StatsBubbleNav() {
  return (
    <BubbleNavigation
      config={statsBubbleConfig}
      getActiveItem={getActiveItem}
    />
  );
}
