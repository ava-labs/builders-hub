"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { getEventConfig, DEFAULT_SCORE_CRITERIA } from "./event-configs";
import { VERDICT_BUTTON_COLORS, VERDICT_BADGE_COLORS, VERDICT_LABELS } from "./colors";
import type { EvaluationData, Verdict } from "./types";

interface Props {
  formDataId: string;
  origin: string;
  evaluations: EvaluationData[];
  currentUserId: string;
  stage: number;
  currentStage: number;
  onEvaluationSaved: (formDataId: string, evaluation: EvaluationData) => void;
}

const VERDICTS: { value: Verdict; label: string; color: string }[] = (
  ["top", "strong", "maybe", "weak", "reject"] as const
).map((v) => ({
  value: v,
  label: VERDICT_LABELS[v],
  color: VERDICT_BUTTON_COLORS[v],
}));

const VERDICT_SCORES: Record<string, number> = {
  top: 5,
  strong: 4,
  maybe: 3,
  weak: 2,
  reject: 1,
};
const SCORE_TO_VERDICT: Record<number, Verdict> = {
  5: "top",
  4: "strong",
  3: "maybe",
  2: "weak",
  1: "reject",
};

const FINAL_SCORE_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const STAGE_LABELS: Record<number, string> = {
  0: "Initial Review",
  1: "Stage 1 - Idea",
  2: "Stage 2 - MVP",
  3: "Stage 3 - GTM",
  4: "Stage 4 - Finals",
};

export function EvaluationPanel({
  formDataId,
  origin,
  evaluations,
  currentUserId,
  stage,
  currentStage,
  onEvaluationSaved,
}: Props) {
  const myEvaluation = evaluations.find(
    (e) => e.evaluatorId === currentUserId && e.stage === stage
  );
  const otherEvaluations = evaluations.filter(
    (e) => e.evaluatorId !== currentUserId && e.stage === stage
  );
  const stageEvaluations = evaluations.filter((e) => e.stage === stage);

  const eventConfig = getEventConfig(origin);
  const scoreCriteria =
    eventConfig?.scoreCriteria ?? DEFAULT_SCORE_CRITERIA;

  const [selectedVerdict, setSelectedVerdict] = useState<Verdict | null>(
    (myEvaluation?.verdict as Verdict) ?? null
  );
  const [comment, setComment] = useState(myEvaluation?.comment ?? "");
  const [finalScore, setFinalScore] = useState<number | null>(
    myEvaluation?.scoreOverall ?? null
  );
  const [scores, setScores] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    for (const c of scoreCriteria) {
      initial[c.key] = myEvaluation?.scores?.[c.key] ?? null;
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedVerdict) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const scoresPayload: Record<string, number> = {};
      for (const [key, val] of Object.entries(scores)) {
        if (val !== null) {
          scoresPayload[key] = val;
        }
      }

      const body: Record<string, unknown> = {
        formDataId,
        verdict: selectedVerdict,
        comment: comment.trim() || undefined,
        scoreOverall: finalScore ?? undefined,
        stage,
      };

      if (Object.keys(scoresPayload).length > 0) {
        body.scores = scoresPayload;
      }

      const data = await apiFetch<{ id: string }>("/api/evaluate", {
        method: "POST",
        body,
      });
      onEvaluationSaved(formDataId, {
        id: data.id,
        formDataId,
        evaluatorId: currentUserId,
        evaluatorName: "You",
        verdict: selectedVerdict,
        comment: comment.trim() || null,
        scoreOverall: finalScore,
        scores:
          Object.keys(scoresPayload).length > 0 ? scoresPayload : null,
        createdAt: new Date().toISOString(),
        stage,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-md mx-4 mt-4">
      {/* Verdict + Comment + Save */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Your Verdict</h3>
        <div className="flex gap-2 flex-wrap items-center">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              onClick={() => setSelectedVerdict(v.value)}
              className={`px-4 py-1.5 text-sm rounded-md border cursor-pointer transition-all duration-200 ${
                selectedVerdict === v.value
                  ? `${v.color} ring-2 ring-offset-1 ring-offset-zinc-900`
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-500"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Optional comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!selectedVerdict || finalScore === null || saving}
            className={saved ? "bg-green-600 hover:bg-green-600" : ""}
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </Button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Final Score */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <div className="flex gap-6 items-start">
          {/* Score criteria */}
          {scoreCriteria.length > 0 && (
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-3">
                Scoring Criteria
              </h3>
              {scoreCriteria.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 w-36 text-right shrink-0">
                    {c.label}
                  </span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setScores((prev) => ({
                            ...prev,
                            [c.key]: prev[c.key] === n ? null : n,
                          }))
                        }
                        className={`w-9 h-9 text-xs rounded-lg cursor-pointer transition-colors duration-200 ${
                          scores[c.key] !== null && scores[c.key]! >= n
                            ? "bg-blue-500 text-white font-bold"
                            : "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-400"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Final Score */}
          <div className="border-l border-zinc-200 dark:border-zinc-800 pl-6 flex flex-col items-center min-w-[220px]">
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-1">
              Final Score
            </span>

            <div className="h-14 flex items-center justify-center">
              {finalScore !== null ? (
                <span className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
                  {finalScore}
                </span>
              ) : (
                <span className="text-sm text-zinc-400 dark:text-zinc-600 italic">Not set</span>
              )}
            </div>

            <div className="flex gap-1.5 mt-1">
              {FINAL_SCORE_VALUES.map((val) => (
                <button
                  key={val}
                  onClick={() =>
                    setFinalScore(finalScore === val ? null : val)
                  }
                  className={`h-9 rounded-lg text-xs cursor-pointer transition-all duration-200 tabular-nums ${
                    Number.isInteger(val) ? "min-w-[36px]" : "min-w-[40px]"
                  } px-1.5 ${
                    finalScore === val
                      ? "bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/25"
                      : "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Other evaluations */}
      {otherEvaluations.length > 0 && (
        <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <h3 className="text-xs text-zinc-500">
            Other evaluations ({otherEvaluations.length})
          </h3>
          <div className="space-y-1">
            {otherEvaluations.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">{e.evaluatorName}:</span>
                <VerdictBadge verdict={e.verdict as Verdict} />
                {e.scoreOverall !== null && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {e.scoreOverall}/5
                  </span>
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
      )}

      {/* Vote summary */}
      {stageEvaluations.length > 0 && <VoteSummary evaluations={stageEvaluations} />}
    </div>
  );
}

function VoteSummary({ evaluations }: { evaluations: EvaluationData[] }) {
  const verdictAvg =
    evaluations.reduce(
      (sum, e) => sum + (VERDICT_SCORES[e.verdict] ?? 0),
      0
    ) / evaluations.length;
  const consensus = SCORE_TO_VERDICT[Math.round(verdictAvg)] ?? "maybe";

  const withScores = evaluations.filter((e) => e.scoreOverall !== null);
  const avgScore =
    withScores.length > 0
      ? Math.round(
          (withScores.reduce((sum, e) => sum + (e.scoreOverall ?? 0), 0) /
            withScores.length) *
            10
        ) / 10
      : null;

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 flex items-center gap-3 flex-wrap">
      <span className="text-xs text-zinc-500">
        {evaluations.length} vote{evaluations.length !== 1 ? "s" : ""}
      </span>
      <span className="text-xs text-zinc-500">&mdash;</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Consensus:</span>
      <VerdictBadge verdict={consensus} />
      {avgScore !== null && (
        <>
          <span className="text-xs text-zinc-500">&mdash;</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Avg Score:</span>
          <span className="text-sm font-mono text-zinc-700 dark:text-zinc-200">
            {avgScore.toFixed(1)}
          </span>
        </>
      )}
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null;

  return (
    <Badge variant="outline" className={`text-xs ${VERDICT_BADGE_COLORS[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </Badge>
  );
}
