"use client";

import { useState, useMemo, useEffect } from "react";
import { X, ChevronRight } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_FULL_LABELS, STAGE_BADGE_COLORS } from "./colors";
import type { SubmissionRow, EvaluationData, Verdict } from "./types";

interface Props {
  rows: SubmissionRow[];
  getEvaluations: (formDataId: string, original: EvaluationData[]) => EvaluationData[];
  getCurrentStage: (formDataId: string, original: number) => number;
  onAdvanced: (formDataId: string, newStage: number) => void;
}

const VERDICT_SCORES: Record<string, number> = {
  top: 5, strong: 4, maybe: 3, weak: 2, reject: 1,
};

const VERDICT_OPTIONS: { value: Verdict; label: string }[] = [
  { value: "top", label: "Top (5)" },
  { value: "strong", label: "Strong (4)" },
  { value: "maybe", label: "Maybe (3)" },
  { value: "weak", label: "Weak (2)" },
  { value: "reject", label: "Reject (1)" },
];

function computeAvgVerdictScore(evaluations: EvaluationData[]): number | null {
  if (evaluations.length === 0) return null;
  return evaluations.reduce((sum, e) => sum + (VERDICT_SCORES[e.verdict] ?? 0), 0) / evaluations.length;
}

function computeAvgOverallScore(evaluations: EvaluationData[]): number | null {
  const withScores = evaluations.filter((e) => e.scoreOverall !== null);
  if (withScores.length === 0) return null;
  return withScores.reduce((sum, e) => sum + (e.scoreOverall ?? 0), 0) / withScores.length;
}

export function BulkAdvanceButton({
  rows,
  getEvaluations,
  getCurrentStage,
  onAdvanced,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="cursor-pointer">
        Advance Stage
      </Button>

      {isOpen && (
        <BulkAdvanceModal
          rows={rows}
          getEvaluations={getEvaluations}
          getCurrentStage={getCurrentStage}
          onAdvanced={onAdvanced}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function BulkAdvanceModal({
  rows,
  getEvaluations,
  getCurrentStage,
  onAdvanced,
  onClose,
}: Props & { onClose: () => void }) {
  // Smart default: pick the stage with the most projects
  const defaultFromStage = useMemo(() => {
    let bestStage = "0";
    let bestCount = 0;
    for (const s of [0, 1, 2, 3]) {
      const count = rows.filter((r) => getCurrentStage(r.formDataId, r.currentStage) === s).length;
      if (count > bestCount) {
        bestCount = count;
        bestStage = String(s);
      }
    }
    return bestStage;
  }, [rows, getCurrentStage]);

  const [criteriaType, setCriteriaType] = useState<"score" | "verdict">("score");
  const [minScore, setMinScore] = useState("3.0");
  const [minVerdict, setMinVerdict] = useState<Verdict>("maybe");
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [maxProjects, setMaxProjects] = useState("20");
  const [fromStage, setFromStage] = useState(defaultFromStage);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const targetStage = Number(fromStage) + 1;

  // Auto-dismiss success/error message after 8 seconds
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 8000);
    return () => clearTimeout(timer);
  }, [result]);

  // Reset confirmation when parameters change
  useEffect(() => {
    setConfirming(false);
  }, [fromStage, criteriaType, minScore, minVerdict, limitEnabled, maxProjects]);

  const eligible = useMemo(() => {
    const from = Number(fromStage);
    return rows
      .filter((r) => {
        const cs = getCurrentStage(r.formDataId, r.currentStage);
        return cs === from || (cs === 0 && r.stageProgress >= from);
      })
      .map((r) => {
        const stageEvals = getEvaluations(r.formDataId, r.evaluations)
          .filter((e) => e.stage === from);
        const avgVerdictScore = computeAvgVerdictScore(stageEvals);
        const avgOverallScore = computeAvgOverallScore(stageEvals);
        return { row: r, evals: stageEvals, avgVerdictScore, avgOverallScore };
      })
      .filter(({ evals }) => evals.length > 0);
  }, [rows, fromStage, getEvaluations, getCurrentStage]);

  const threshold = criteriaType === "score" ? parseFloat(minScore) : (VERDICT_SCORES[minVerdict] ?? 3);

  const qualifying = useMemo(() => {
    let filtered = eligible;

    if (criteriaType === "score") {
      if (!isNaN(threshold)) {
        filtered = filtered.filter(({ avgOverallScore }) =>
          avgOverallScore !== null && avgOverallScore >= threshold
        );
      }
    } else {
      filtered = filtered.filter(({ avgVerdictScore }) =>
        avgVerdictScore !== null && avgVerdictScore >= threshold
      );
    }

    filtered.sort((a, b) => {
      const scoreA = a.avgOverallScore ?? a.avgVerdictScore ?? 0;
      const scoreB = b.avgOverallScore ?? b.avgVerdictScore ?? 0;
      return scoreB - scoreA;
    });

    if (limitEnabled) {
      const max = parseInt(maxProjects);
      if (!isNaN(max) && max > 0) {
        filtered = filtered.slice(0, max);
      }
    }

    return filtered;
  }, [eligible, criteriaType, threshold, limitEnabled, maxProjects]);

  const tiedCount = useMemo(() => {
    if (!limitEnabled || qualifying.length === 0) return 0;
    const lastItem = qualifying[qualifying.length - 1];
    const lastScore = lastItem.avgOverallScore ?? lastItem.avgVerdictScore ?? 0;
    return eligible.filter((p) => {
      const s = p.avgOverallScore ?? p.avgVerdictScore ?? 0;
      return s === lastScore && !qualifying.includes(p);
    }).length;
  }, [qualifying, eligible, limitEnabled]);

  const handleAdvance = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    if (qualifying.length === 0) return;
    setSaving(true);
    setResult(null);

    try {
      const ids = qualifying.map((q) => q.row.formDataId);
      const data = await apiFetch<{ updated: number }>("/api/evaluate/advance-stage", {
        method: "POST",
        body: { formDataIds: ids, stage: targetStage },
      });
      for (const q of qualifying) {
        onAdvanced(q.row.formDataId, targetStage);
      }
      setResult(`Advanced ${data.updated} projects to Stage ${targetStage}`);
      setConfirming(false);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            Advance Projects
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5 overflow-auto max-h-[70vh]">
          {/* Stage progression */}
          <div className="flex items-center gap-3">
            <Select value={fromStage} onValueChange={setFromStage}>
              <SelectTrigger className={`bg-zinc-50 dark:bg-zinc-900 flex-1 ${STAGE_BADGE_COLORS[Number(fromStage)] ?? "border-zinc-300 dark:border-zinc-700"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Stage 0 - Applied</SelectItem>
                <SelectItem value="1">Stage 1 - Idea</SelectItem>
                <SelectItem value="2">Stage 2 - MVP</SelectItem>
                <SelectItem value="3">Stage 3 - GTM</SelectItem>
              </SelectContent>
            </Select>
            <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-600 shrink-0" />
            <Badge variant="outline" className={`text-xs shrink-0 py-1 px-3 ${STAGE_BADGE_COLORS[targetStage] ?? ""}`}>
              {STAGE_FULL_LABELS[targetStage] ?? `Stage ${targetStage}`}
            </Badge>
          </div>

          {/* Criteria + Threshold (left) — Limit (right) */}
          <div className="flex items-end gap-3">
            {/* Criteria + Threshold grouped */}
            <div className="flex gap-2 items-end">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500">Criteria</label>
                <Select value={criteriaType} onValueChange={(v) => setCriteriaType(v as "score" | "verdict")}>
                  <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Min Overall Score</SelectItem>
                    <SelectItem value="verdict">Min Avg Verdict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500">Threshold</label>
                {criteriaType === "score" ? (
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    className="w-20 bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  />
                ) : (
                  <Select value={minVerdict} onValueChange={(v) => setMinVerdict(v as Verdict)}>
                    <SelectTrigger className="w-[7.5rem] bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERDICT_OPTIONS.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Limit pushed right */}
            <div className="space-y-1.5 ml-auto">
              <label className="text-xs text-zinc-500">Limit</label>
              <div className="flex items-center gap-2">
                <Select
                  value={limitEnabled ? "top" : "all"}
                  onValueChange={(v) => setLimitEnabled(v === "top")}
                >
                  <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 w-[9.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All qualifying</SelectItem>
                    <SelectItem value="top">Top N</SelectItem>
                  </SelectContent>
                </Select>
                {limitEnabled && (
                  <Input
                    type="number"
                    min="1"
                    value={maxProjects}
                    onChange={(e) => setMaxProjects(e.target.value)}
                    className="w-16 bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/30">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                Preview
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
                {qualifying.length} of {eligible.length} eligible
              </span>
            </div>

            {qualifying.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                No projects match the criteria.
              </p>
            ) : (
              <div className="max-h-48 overflow-auto divide-y divide-zinc-200/50 dark:divide-zinc-800/50">
                {qualifying.map(({ row, evals, avgOverallScore }) => {
                  const score = avgOverallScore ?? 0;
                  const aboveThreshold = score >= threshold;
                  return (
                    <div
                      key={row.formDataId}
                      className="flex items-center justify-between text-sm px-3 py-1.5"
                    >
                      <span className="text-zinc-700 dark:text-zinc-200 truncate max-w-[220px]">
                        {row.projectName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 dark:text-zinc-600 tabular-nums">
                          {evals.length} eval{evals.length !== 1 ? "s" : ""}
                        </span>
                        <span className={`text-xs font-mono tabular-nums ${aboveThreshold ? "text-green-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                          {avgOverallScore !== null ? avgOverallScore.toFixed(1) : "\u2014"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {tiedCount > 0 && (
              <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {tiedCount} more project{tiedCount !== 1 ? "s" : ""} with the same score at the cutoff. Consider increasing the limit.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {confirming ? (
              <>
                <Button
                  onClick={handleAdvance}
                  disabled={qualifying.length === 0 || saving}
                  className="bg-blue-600/80 hover:bg-blue-500/80 text-blue-100"
                >
                  {saving ? "Advancing..." : `Confirm: Advance ${qualifying.length} to Stage ${targetStage}`}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Back
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleAdvance}
                  disabled={qualifying.length === 0}
                >
                  Advance {qualifying.length} Projects
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </>
            )}
            {result && (
              <span className={`text-xs ${result.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
                {result}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
