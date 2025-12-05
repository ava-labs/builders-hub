"use client";

import BubbleNavigation from '@/components/navigation/BubbleNavigation';
import type { BubbleNavigationConfig } from '@/components/navigation/bubble-navigation.types';
import { ChartArea, Compass, Users } from 'lucide-react';

export interface L1BubbleNavProps {
  chainSlug: string;
  themeColor?: string;
  rpcUrl?: string;
  isCustomChain?: boolean;
}

export function L1BubbleNav({
  chainSlug,
  rpcUrl,
  isCustomChain = false,
}: L1BubbleNavProps) {
  // Don't render the bubble navigation if there's no RPC URL
  if (!rpcUrl) {
    return null;
  }

  // Don't render bubble navigation for custom chains
  if (isCustomChain) {
    return null;
  }

  const l1BubbleConfig: BubbleNavigationConfig = {
    items: [
      { id: "stats", label: "Stats", href: `/stats/l1/${chainSlug}`, icon: ChartArea },
      { id: "explorer", label: "Explorer", href: `/explorer/${chainSlug}`, icon: Compass },
      { id: "validators", label: "Validators", href: `/stats/validators/${chainSlug}`, icon: Users },
    ],
    activeColor: "bg-zinc-200 dark:bg-zinc-700",
    darkActiveColor: "",
    activeTextColor: "text-zinc-900 dark:text-white",
    focusRingColor: "focus:ring-zinc-500",
    pulseColor: "bg-zinc-200/40",
    darkPulseColor: "dark:bg-zinc-400/40",
  };

  const getActiveItem = (pathname: string) => {
    if (pathname.includes("/explorer")) {
      return "explorer";
    }
    if (pathname.includes("/validators")) {
      return "validators";
    }
    return "stats";
  };

  return <BubbleNavigation config={l1BubbleConfig} getActiveItem={getActiveItem} />;
}

