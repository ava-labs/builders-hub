"use client";

import { Badge } from "@/components/ui/badge";
import { VerdictBadge } from "./EvaluationPanel";
import type { EvaluationData, Verdict } from "./types";

interface Props {
  evaluations: EvaluationData[];
  currentStage: number;
}

const STAGE_LABELS: Record<number, string> = {
  0: "Initial Review",
  1: "Stage 1 - Idea",
  2: "Stage 2 - MVP",
  3: "Stage 3 - GTM",
  4: "Stage 4 - Finals",
};

const VERDICT_SCORES: Record<string, number> = {
  top: 5, strong: 4, maybe: 3, weak: 2, reject: 1,
};
const SCORE_TO_VERDICT: Record<number, Verdict> = {
  5: "top", 4: "strong", 3: "maybe", 2: "weak", 1: "reject",
};

export function StageHistory({ evaluations, currentStage }: Props) {
  if (currentStage <= 0) return null;

  const stageGroups = new Map<number, EvaluationData[]>();
  for (const e of evaluations) {
    if (e.stage >= currentStage) continue;
    const group = stageGroups.get(e.stage) ?? [];
    stageGroups.set(e.stage, [...group, e]);
  }

  if (stageGroups.size === 0) return null;

  const stages = [...stageGroups.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      <h3 className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">
        Previous Stage Evaluations
      </h3>
      {stages.map(([stage, evals]) => {
        const avg = evals.reduce((sum, e) => sum + (VERDICT_SCORES[e.verdict] ?? 0), 0) / evals.length;
        const consensus = SCORE_TO_VERDICT[Math.round(avg)] ?? "maybe";

        const withScores = evals.filter((e) => e.scoreOverall !== null);
        const avgScore = withScores.length > 0
          ? Math.round(withScores.reduce((s, e) => s + (e.scoreOverall ?? 0), 0) / withScores.length * 10) / 10
          : null;

        return (
          <div key={stage} className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {STAGE_LABELS[stage] ?? `Stage ${stage}`}
                </Badge>
                <VerdictBadge verdict={consensus} />
                {avgScore !== null && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{avgScore.toFixed(1)}</span>
                )}
                <span className="text-xs text-zinc-400 dark:text-zinc-600">
                  ({evals.length} vote{evals.length !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
            <div className="px-3 py-2 space-y-1">
              {evals.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs w-28 shrink-0 truncate">{e.evaluatorName}</span>
                  <VerdictBadge verdict={e.verdict as Verdict} />
                  {e.scoreOverall !== null && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{e.scoreOverall}/5</span>
                  )}
                  {e.comment && (
                    <span className="text-zinc-500 text-xs truncate">
                      &mdash; &ldquo;{e.comment}&rdquo;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
