import type { Verdict } from "./types";

export const VERDICT_BADGE_COLORS: Record<Verdict, string> = {
  top: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700",
  strong: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
  maybe: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  weak: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
  reject: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
};

export const VERDICT_BUTTON_COLORS: Record<Verdict, string> = {
  top: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 hover:bg-cyan-200 dark:hover:bg-cyan-800/50",
  strong: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-800/50",
  maybe: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-800/50",
  weak: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800/50",
  reject: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800/50",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  top: "Top",
  strong: "Strong",
  maybe: "Maybe",
  weak: "Weak",
  reject: "Reject",
};

export const STAGE_BADGE_COLORS: Record<number, string> = {
  0: "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300",
  1: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  2: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  3: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
  4: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
};

export const STAGE_LABELS: Record<number, string> = {
  0: "Applied",
  1: "Stage 1",
  2: "Stage 2",
  3: "Stage 3",
  4: "Stage 4",
};

export const STAGE_FULL_LABELS: Record<number, string> = {
  0: "Not Started",
  1: "Stage 1 - Idea",
  2: "Stage 2 - MVP",
  3: "Stage 3 - GTM",
  4: "Stage 4 - Finals",
};
