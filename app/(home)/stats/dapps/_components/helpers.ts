import type { DAppCategory } from "@/types/dapps";

// Compact number formatter (K/M/B/T). Returns "N/A" when the value is missing.
export function formatNumber(num: number | undefined | null): string {
  if (num === null || num === undefined) return "N/A";
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatCurrency(num: number | undefined | null): string {
  if (num === null || num === undefined) return "N/A";
  return `$${formatNumber(num)}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  dex: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  lending:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  nft: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  gaming: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  bridge: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
  yield: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
  derivatives: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  launchpad: "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-400",
  other: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-400",
  All: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
};

export function getCategoryColor(category: DAppCategory | string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}
