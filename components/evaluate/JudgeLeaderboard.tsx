"use client";

import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VerdictBadge } from "./EvaluationPanel";
import type { SubmissionRow, EvaluationData, Verdict } from "./types";

interface Props {
  evaluations: EvaluationData[];
  rows: SubmissionRow[];
}

type SortKey = "total" | "lastActive" | "avgScore";

interface JudgeStats {
  evaluatorId: string;
  name: string;
  total: number;
  top: number;
  strong: number;
  maybe: number;
  weak: number;
  reject: number;
  lastActive: string | null;
  avgScore: number | null;
}

const VERDICTS: Verdict[] = ["top", "strong", "maybe", "weak", "reject"];

const VERDICT_LABELS: Record<Verdict, string> = {
  top: "Top",
  strong: "Strong",
  maybe: "Maybe",
  weak: "Weak",
  reject: "Reject",
};

const VERDICT_SHORT: Record<Verdict, string> = {
  top: "T",
  strong: "S",
  maybe: "M",
  weak: "W",
  reject: "R",
};

const VERDICT_BAR_COLORS: Record<Verdict, string> = {
  top: "bg-cyan-500",
  strong: "bg-green-500",
  maybe: "bg-yellow-500",
  weak: "bg-orange-500",
  reject: "bg-red-500",
};

const VERDICT_TEXT_COLORS: Record<Verdict, string> = {
  top: "text-cyan-300",
  strong: "text-green-300",
  maybe: "text-yellow-300",
  weak: "text-orange-300",
  reject: "text-red-300",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function JudgeLeaderboard({ evaluations, rows }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<number | null>(null);

  const availableStages = useMemo(
    () => [...new Set(evaluations.map((e) => e.stage))].sort(),
    [evaluations]
  );
  const hasMultipleStages = availableStages.length > 1;

  const filteredEvaluations = useMemo(
    () => stageFilter !== null ? evaluations.filter((e) => e.stage === stageFilter) : evaluations,
    [evaluations, stageFilter]
  );

  const judgeStats = useMemo(
    () => buildJudgeStats(filteredEvaluations),
    [filteredEvaluations]
  );

  const sorted = useMemo(() => {
    return [...judgeStats].sort((a, b) => {
      switch (sortKey) {
        case "total":
          return b.total - a.total;
        case "lastActive": {
          const tA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
          const tB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
          return tB - tA;
        }
        case "avgScore":
          return (b.avgScore ?? 0) - (a.avgScore ?? 0);
        default:
          return 0;
      }
    });
  }, [judgeStats, sortKey]);

  const insights = useMemo(
    () => computeInsights(rows, filteredEvaluations, stageFilter),
    [rows, filteredEvaluations, stageFilter]
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="cursor-pointer">
        Judge Activity ({judgeStats.length})
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Judge Activity Leaderboard
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {hasMultipleStages && (
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <button
                    onClick={() => setStageFilter(null)}
                    className={`cursor-pointer transition-colors ${
                      stageFilter === null
                        ? "text-zinc-900 dark:text-white font-semibold"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    All Stages
                  </button>
                  {availableStages.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStageFilter(stageFilter === s ? null : s)}
                      className={`cursor-pointer transition-colors ${
                        stageFilter === s
                          ? "text-zinc-900 dark:text-white font-semibold"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      Stage {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-auto max-h-[75vh] p-4 space-y-4">
              <InsightsSection insights={insights} />

              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-200 dark:border-zinc-800">
                    <TableHead className="text-zinc-500 dark:text-zinc-400">Judge</TableHead>
                    <SortableHead
                      label="Rated"
                      sortKey="total"
                      currentKey={sortKey}
                      onSort={setSortKey}
                    />
                    <SortableHead
                      label="Last Active"
                      sortKey="lastActive"
                      currentKey={sortKey}
                      onSort={setSortKey}
                    />
                    <SortableHead
                      label="Avg Score"
                      sortKey="avgScore"
                      currentKey={sortKey}
                      onSort={setSortKey}
                    />
                    <TableHead className="text-zinc-500 dark:text-zinc-400">
                      Distribution
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((judge) => {
                    const isExpanded = expandedJudge === judge.evaluatorId;
                    return (
                      <React.Fragment key={judge.evaluatorId}>
                        <TableRow
                          className="border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900/70"
                          onClick={() => setExpandedJudge(isExpanded ? null : judge.evaluatorId)}
                        >
                          <TableCell className="text-zinc-700 dark:text-zinc-200 font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className="text-zinc-400 dark:text-zinc-600 text-xs">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                              {judge.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            <span className="text-zinc-900 dark:text-white font-bold">{judge.total}</span>
                            {insights.total > 0 && (
                              <span className="text-zinc-500 text-xs ml-1">
                                ({Math.round((new Set(filteredEvaluations.filter(e => e.evaluatorId === judge.evaluatorId).map(e => e.formDataId)).size / insights.total) * 100)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-500 dark:text-zinc-400">
                            {judge.lastActive
                              ? relativeTime(judge.lastActive)
                              : "\u2014"}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {judge.avgScore !== null ? (
                              <span className="text-zinc-900 dark:text-white font-mono">
                                {judge.avgScore.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-600">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <VerdictDistributionBar
                              stats={judge}
                              total={judge.total}
                            />
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="border-zinc-200 dark:border-zinc-800">
                            <TableCell colSpan={5} className="p-0">
                              <JudgeDetailPanel
                                evaluatorId={judge.evaluatorId}
                                evaluations={filteredEvaluations}
                                rows={rows}
                                stageFilter={stageFilter}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-zinc-500 py-8"
                      >
                        No evaluations yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Insights */

interface CategoryStats {
  name: string;
  apps: number;
  evaluated: number;
  avgScore: number | null;
  verdictCounts: Record<Verdict, number>;
}

interface Insights {
  total: number;
  evaluated: number;
  avgScore: number | null;
  verdictCounts: Record<Verdict, number>;
  totalEvaluations: number;
  categories: CategoryStats[];
}

function InsightsSection({ insights }: { insights: Insights }) {
  const { total, evaluated, avgScore, verdictCounts, totalEvaluations } =
    insights;
  const evalPct = total > 0 ? Math.round((evaluated / total) * 100) : 0;

  const topVerdict = VERDICTS.reduce<Verdict | null>((best, v) => {
    if (!best) return verdictCounts[v] > 0 ? v : null;
    return verdictCounts[v] > verdictCounts[best] ? v : best;
  }, null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat
          label="Evaluated"
          value={`${evaluated} / ${total}`}
          sub={`${evalPct}%`}
        />
        <MiniStat
          label="Total Evaluations"
          value={String(totalEvaluations)}
        />
        <MiniStat
          label="Avg Score"
          value={avgScore !== null ? avgScore.toFixed(1) : "\u2014"}
        />
        <MiniStat
          label="Most Common"
          value={topVerdict ? VERDICT_LABELS[topVerdict] : "\u2014"}
          valueColor={
            topVerdict ? VERDICT_TEXT_COLORS[topVerdict] : undefined
          }
        />
      </div>

      {totalEvaluations > 0 && (
        <div className="bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 space-y-2">
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
            Verdict Breakdown
          </span>
          <div className="flex w-full h-5 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-800">
            {VERDICTS.map((v) => {
              const pct = (verdictCounts[v] / totalEvaluations) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={v}
                  className={`${VERDICT_BAR_COLORS[v]} h-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="flex gap-4 flex-wrap">
            {VERDICTS.map((v) => (
              <span
                key={v}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-sm ${VERDICT_BAR_COLORS[v]}`}
                />
                <span className="text-zinc-500 dark:text-zinc-400">
                  {VERDICT_LABELS[v]}
                </span>
                <span
                  className={`font-bold tabular-nums ${VERDICT_TEXT_COLORS[v]}`}
                >
                  {verdictCounts[v]}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {insights.categories.length > 0 && (
        <AreaBreakdown categories={insights.categories} />
      )}
    </div>
  );
}

function AreaBreakdown({ categories }: { categories: CategoryStats[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="font-medium uppercase tracking-wide">
          By Area ({categories.length})
        </span>
        <span>{isOpen ? "\u25B2" : "\u25BC"}</span>
      </button>
      {isOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left px-3 py-1.5 font-medium">Area</th>
                <th className="text-right px-3 py-1.5 font-medium">Projects</th>
                <th className="text-right px-3 py-1.5 font-medium">Evaluated</th>
                <th className="text-right px-3 py-1.5 font-medium">Avg Score</th>
                <th className="px-3 py-1.5 font-medium">Verdicts</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const total = VERDICTS.reduce((s, v) => s + cat.verdictCounts[v], 0);
                return (
                  <tr key={cat.name} className="border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0">
                    <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-300 capitalize">
                      {cat.name.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400 text-right tabular-nums">
                      {cat.apps}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400 text-right tabular-nums">
                      {cat.evaluated}
                      {cat.apps > 0 && (
                        <span className="text-zinc-400 dark:text-zinc-600 ml-1">
                          ({Math.round((cat.evaluated / cat.apps) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cat.avgScore !== null ? (
                        <span className="text-zinc-700 dark:text-zinc-200">{cat.avgScore.toFixed(1)}</span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {total > 0 ? (
                        <div className="flex w-20 h-3 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                          {VERDICTS.map((v) => {
                            const pct = (cat.verdictCounts[v] / total) * 100;
                            if (pct === 0) return null;
                            return (
                              <div
                                key={v}
                                className={`${VERDICT_BAR_COLORS[v]} h-full`}
                                style={{ width: `${pct}%` }}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span
          className={`text-lg font-bold tabular-nums ${valueColor ?? "text-zinc-900 dark:text-white"}`}
        >
          {value}
        </span>
        {sub && <span className="text-xs text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}

/* Distribution Bar */

function VerdictDistributionBar({
  stats,
  total,
}: {
  stats: JudgeStats;
  total: number;
}) {
  if (total === 0) return <span className="text-zinc-400 dark:text-zinc-600">&mdash;</span>;

  return (
    <div className="group relative flex items-center">
      <div className="flex w-full h-4 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        {VERDICTS.map((v) => {
          const pct = (stats[v] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={v}
              className={`${VERDICT_BAR_COLORS[v]} h-full`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex gap-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 shadow-lg z-10 whitespace-nowrap">
        {VERDICTS.map((v) => {
          if (stats[v] === 0) return null;
          return (
            <span
              key={v}
              className={`text-xs font-medium tabular-nums ${VERDICT_TEXT_COLORS[v]}`}
            >
              {VERDICT_SHORT[v]}:{stats[v]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* Sortable Header */

function SortableHead({
  label,
  sortKey,
  currentKey,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white transition-colors ${
        isActive ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
      }`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {isActive && " \u2193"}
    </TableHead>
  );
}

/* Data Helpers */

function computeInsights(
  rows: SubmissionRow[],
  evaluations: EvaluationData[],
  stageFilter: number | null
): Insights {
  const evaluatedFormDataIds = new Set(evaluations.map((e) => e.formDataId));
  // When stage-filtered, relevant rows = projects at that stage OR with evaluations at that stage
  const relevantRows = stageFilter !== null
    ? rows.filter((r) => r.currentStage >= stageFilter || evaluatedFormDataIds.has(r.formDataId))
    : rows;
  const total = relevantRows.length;
  const evaluated = relevantRows.filter((r) => evaluatedFormDataIds.has(r.formDataId)).length;

  const verdictCounts: Record<Verdict, number> = {
    top: 0,
    strong: 0,
    maybe: 0,
    weak: 0,
    reject: 0,
  };
  for (const e of evaluations) {
    const v = e.verdict as Verdict;
    if (v in verdictCounts) {
      verdictCounts[v] += 1;
    }
  }

  const withScores = evaluations.filter((e) => e.scoreOverall !== null);
  const avgScore =
    withScores.length > 0
      ? Math.round(
          (withScores.reduce((s, e) => s + (e.scoreOverall ?? 0), 0) /
            withScores.length) *
            10
        ) / 10
      : null;

  // Group by area
  const catMap = new Map<string, { apps: number; evaluated: number; scoreSum: number; scoreCount: number; verdicts: Record<Verdict, number> }>();
  for (const row of relevantRows) {
    const area = row.areaOfFocus || "unknown";
    const entry = catMap.get(area) ?? {
      apps: 0,
      evaluated: 0,
      scoreSum: 0,
      scoreCount: 0,
      verdicts: { top: 0, strong: 0, maybe: 0, weak: 0, reject: 0 },
    };
    entry.apps += 1;
    if (evaluatedFormDataIds.has(row.formDataId)) entry.evaluated += 1;
    const rowEvals = evaluations.filter((e) => e.formDataId === row.formDataId);
    for (const e of rowEvals) {
      const v = e.verdict as Verdict;
      if (v in entry.verdicts) entry.verdicts[v] += 1;
      if (e.scoreOverall !== null) {
        entry.scoreSum += e.scoreOverall;
        entry.scoreCount += 1;
      }
    }
    catMap.set(area, entry);
  }

  const categories: CategoryStats[] = [...catMap.entries()]
    .filter(([name]) => name !== "unknown")
    .map(([name, data]) => ({
      name,
      apps: data.apps,
      evaluated: data.evaluated,
      avgScore: data.scoreCount > 0
        ? Math.round((data.scoreSum / data.scoreCount) * 10) / 10
        : null,
      verdictCounts: { ...data.verdicts },
    }))
    .sort((a, b) => b.apps - a.apps);

  return {
    total,
    evaluated,
    avgScore,
    verdictCounts,
    totalEvaluations: evaluations.length,
    categories,
  };
}

function buildJudgeStats(evaluations: EvaluationData[]): JudgeStats[] {
  const map = new Map<
    string,
    JudgeStats & { scoreSum: number; scoreCount: number }
  >();

  for (const e of evaluations) {
    const existing = map.get(e.evaluatorId);
    if (existing) {
      existing.total += 1;
      if (e.verdict === "top") existing.top += 1;
      else if (e.verdict === "strong") existing.strong += 1;
      else if (e.verdict === "maybe") existing.maybe += 1;
      else if (e.verdict === "weak") existing.weak += 1;
      else if (e.verdict === "reject") existing.reject += 1;

      if (e.scoreOverall !== null) {
        existing.scoreSum += e.scoreOverall;
        existing.scoreCount += 1;
      }

      if (
        e.createdAt &&
        (!existing.lastActive || e.createdAt > existing.lastActive)
      ) {
        existing.lastActive = e.createdAt;
      }
    } else {
      map.set(e.evaluatorId, {
        evaluatorId: e.evaluatorId,
        name: e.evaluatorName,
        total: 1,
        top: e.verdict === "top" ? 1 : 0,
        strong: e.verdict === "strong" ? 1 : 0,
        maybe: e.verdict === "maybe" ? 1 : 0,
        weak: e.verdict === "weak" ? 1 : 0,
        reject: e.verdict === "reject" ? 1 : 0,
        lastActive: e.createdAt ?? null,
        avgScore: null,
        scoreSum: e.scoreOverall ?? 0,
        scoreCount: e.scoreOverall !== null ? 1 : 0,
      });
    }
  }

  return [...map.entries()].map(([evaluatorId, judge]) => ({
    evaluatorId,
    name: judge.name,
    total: judge.total,
    top: judge.top,
    strong: judge.strong,
    maybe: judge.maybe,
    weak: judge.weak,
    reject: judge.reject,
    lastActive: judge.lastActive,
    avgScore:
      judge.scoreCount > 0
        ? Math.round((judge.scoreSum / judge.scoreCount) * 10) / 10
        : null,
  }));
}

/* Judge Detail Panel */

function JudgeDetailPanel({
  evaluatorId,
  evaluations,
  rows,
  stageFilter,
}: {
  evaluatorId: string;
  evaluations: EvaluationData[];
  rows: SubmissionRow[];
  stageFilter: number | null;
}) {
  const judgeEvals = evaluations.filter((e) => e.evaluatorId === evaluatorId);
  const judgeFormDataIds = new Set(judgeEvals.map((e) => e.formDataId));
  const relevantRows = stageFilter !== null
    ? rows.filter((r) => r.currentStage >= stageFilter || judgeFormDataIds.has(r.formDataId))
    : rows;
  const evaluatedRows = relevantRows.filter((r) => judgeFormDataIds.has(r.formDataId));
  const coverage = relevantRows.length > 0
    ? Math.round((evaluatedRows.length / relevantRows.length) * 100)
    : 0;

  return (
    <div className="bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 space-y-3">
      {/* Projects list */}
      <div className="max-h-60 overflow-auto pr-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-1.5 font-medium">Project</th>
              <th className="text-left py-1.5 font-medium">Area</th>
              <th className="text-left py-1.5 font-medium">Verdict</th>
              <th className="text-left py-1.5 font-medium">Score</th>
              <th className="text-left py-1.5 font-medium">Stage</th>
              <th className="text-right py-1.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {judgeEvals.map((eval_) => {
              const row = rows.find((r) => r.formDataId === eval_.formDataId);
              return (
                <tr key={eval_.id} className="border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0">
                  <td className="py-1.5 text-zinc-700 dark:text-zinc-200 max-w-[200px] truncate">
                    {row?.projectName ?? "Unknown"}
                  </td>
                  <td className="py-1.5 text-zinc-500 text-xs">
                    {row?.areaOfFocus ?? "\u2014"}
                  </td>
                  <td className="py-1.5">
                    <VerdictBadge verdict={eval_.verdict} />
                  </td>
                  <td className="py-1.5 text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                    {eval_.scoreOverall !== null ? eval_.scoreOverall.toFixed(1) : "\u2014"}
                  </td>
                  <td className="py-1.5 text-zinc-500">
                    {eval_.stage > 0 ? `S${eval_.stage}` : "S0"}
                  </td>
                  <td className="py-1.5 text-zinc-500 text-right">
                    {relativeTime(eval_.createdAt)}
                  </td>
                </tr>
              );
            })}
            {judgeEvals.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-zinc-500">
                  No projects evaluated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
