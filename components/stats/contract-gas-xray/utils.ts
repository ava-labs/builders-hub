// Shared helpers for Contract Gas X-Ray components

import { ArrowRightLeft, Flame, Zap } from "lucide-react";

export function formatGas(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatAvax(num: number): string {
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.001) return num.toFixed(3);
  return num.toFixed(4);
}

export function estimateXrayLoadTime(days: number): number {
  if (days <= 1) return 5;
  if (days <= 7) return 10;
  if (days <= 30) return 20;
  return 30;
}

export function shortAddr(addr: string): string {
  if (addr === "others") return "Others";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function snowtraceUrl(addr: string): string {
  return `https://snowtrace.io/address/${addr}`;
}

export const CLASSIFICATION_CONFIG = {
  entry_point: { label: "Entry Point (Router)", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: ArrowRightLeft },
  gas_burner: { label: "Gas Burner", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", icon: Flame },
  mixed: { label: "Mixed", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", icon: Zap },
} as const;
