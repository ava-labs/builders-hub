"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import type { BubbleNavigationConfig } from '@/components/navigation/bubble-navigation.types';

export interface L1BubbleNavProps {
  chainSlug: string;
  themeColor?: string;
  rpcUrl?: string;
}

export function L1BubbleNav({ chainSlug, themeColor = "#E57373", rpcUrl }: L1BubbleNavProps) {
  // Don't render the bubble navigation if there's no RPC URL
  // (only Overview page would be available, no need for navigation)
  if (!rpcUrl) {
    return null;
  }

  const l1BubbleConfig: BubbleNavigationConfig = {
    items: [
      { id: "stats", label: "Stats", href: `/stats/l1/${chainSlug}/stats` },
      { id: "explorer", label: "Explorer", href: `/stats/l1/${chainSlug}/explorer` },
      { id: "validators", label: "Validators", href: `/stats/validators/${chainSlug === "c-chain" ? "primary-network" : chainSlug}` },
    ],
    activeColor: "bg-zinc-900 dark:bg-white",
    darkActiveColor: "",
    darkTextColor: "dark:text-zinc-900",
    focusRingColor: "focus:ring-zinc-500",
    pulseColor: "bg-zinc-200/40",
    darkPulseColor: "dark:bg-zinc-400/40",
  };

  const getActiveItem = (pathname: string) => {
    // Match /explorer and all sub-pages like /explorer/block/123, /explorer/tx/0x...
    if (pathname.includes('/explorer')) {
      return "explorer";
    }
    // Match /validators page
    if (pathname.includes('/validators')) {
      return "validators";
    }
    // Match /stats page
    if (pathname.includes('/stats')) {
      return "stats";
    }
    return "stats";
  };

  return <BubbleNavigation config={l1BubbleConfig} getActiveItem={getActiveItem} />;
}

