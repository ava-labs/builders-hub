// Compact number formatter shared across the ICM page (and ChartCard).
// Returns "N/A" for empty/non-numeric inputs, otherwise scales to K/M/B/T.
export function formatNumber(num: number | string): string {
  if (num === "N/A" || num === "") return "N/A";
  const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
  if (isNaN(numValue)) return "N/A";

  if (numValue >= 1e12) return `${(numValue / 1e12).toFixed(2)}T`;
  if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(2)}B`;
  if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(2)}M`;
  if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(2)}K`;
  return numValue.toLocaleString();
}

const CATEGORY_STYLES: Record<string, string> = {
  DeFi: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  Finance: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  Gaming: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  Institutions:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  RWAs: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  Payments: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  Telecom: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
  SocialFi: "bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
  Sports: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  Fitness: "bg-lime-50 text-lime-600 dark:bg-lime-950 dark:text-lime-400",
  AI: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  "AI Agents":
    "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  Loyalty: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  Ticketing: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
  General: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function getCategoryStyle(category: string): string {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.General;
}
