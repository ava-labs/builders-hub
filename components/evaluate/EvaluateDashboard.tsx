"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubmissionDetailPanel } from "./SubmissionDetailPanel";
import { VerdictBadge } from "./EvaluationPanel";
import { JudgeLeaderboard } from "./JudgeLeaderboard";
import { BulkAdvanceButton } from "./BulkAdvanceModal";
import { ExportModal } from "./ExportModal";
import { STAGE_BADGE_COLORS, STAGE_LABELS } from "./colors";
import type {
  SubmissionRow,
  EvaluationData,
  Verdict,
  SortField,
  SortDirection,
} from "./types";

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

function computeConsensusVerdict(evaluations: EvaluationData[]): Verdict | null {
  if (evaluations.length === 0) return null;
  const avg =
    evaluations.reduce((sum, e) => sum + (VERDICT_SCORES[e.verdict] ?? 0), 0) /
    evaluations.length;
  return SCORE_TO_VERDICT[Math.round(avg)] ?? "maybe";
}

function computeAverageScore(evaluations: EvaluationData[]): number | null {
  const withScores = evaluations.filter((e) => e.scoreOverall !== null);
  if (withScores.length === 0) return null;
  const total = withScores.reduce((sum, e) => sum + (e.scoreOverall ?? 0), 0);
  return Math.round((total / withScores.length) * 10) / 10;
}

interface Props {
  rows: SubmissionRow[];
  hackathons: { id: string; title: string }[];
  currentUserId: string;
  selectedHackathonId: string;
  isDevrel?: boolean;
}

export function EvaluateDashboard({
  rows,
  hackathons,
  currentUserId,
  selectedHackathonId,
  isDevrel = false,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [verdictFilter, setVerdictFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllStages, setShowAllStages] = useState(false);
  const [includeAdvanced, setIncludeAdvanced] = useState(false);

  const [evalUpdates, setEvalUpdates] = useState<
    Map<string, EvaluationData[]>
  >(new Map());

  const handleEvaluationSaved = useCallback(
    (formDataId: string, evaluation: EvaluationData) => {
      setEvalUpdates((prev) => {
        const next = new Map(prev);
        const existing =
          next.get(formDataId) ??
          rows.find((r) => r.formDataId === formDataId)?.evaluations ??
          [];
        const without = existing.filter(
          (e) => !(e.evaluatorId === evaluation.evaluatorId && e.stage === evaluation.stage)
        );
        next.set(formDataId, [evaluation, ...without]);
        return next;
      });
    },
    [rows]
  );

  const getEvaluations = useCallback(
    (formDataId: string, original: EvaluationData[]) => {
      return evalUpdates.get(formDataId) ?? original;
    },
    [evalUpdates]
  );

  const [stageUpdates, setStageUpdates] = useState<Map<string, number>>(new Map());

  const handleStageAdvanced = useCallback((formDataId: string, newStage: number) => {
    setStageUpdates((prev) => {
      const next = new Map(prev);
      next.set(formDataId, newStage);
      return next;
    });
  }, []);

  const getCurrentStage = useCallback(
    (formDataId: string, original: number) => {
      return stageUpdates.get(formDataId) ?? original;
    },
    [stageUpdates]
  );

  const allEvaluations = useMemo(
    () =>
      rows.flatMap((r) => getEvaluations(r.formDataId, r.evaluations)),
    [rows, getEvaluations]
  );

  const areasOfFocus = useMemo(
    () => [...new Set(rows.map((r) => r.areaOfFocus).filter(Boolean) as string[])].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const matchesSearch =
          row.projectName.toLowerCase().includes(q) ||
          row.applicantName.toLowerCase().includes(q) ||
          row.applicantEmail.toLowerCase().includes(q) ||
          row.shortDescription.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (areaFilter !== "all" && row.areaOfFocus !== areaFilter) return false;
      if (stageFilter !== "all") {
        const stage = parseInt(stageFilter);
        const cs = getCurrentStage(row.formDataId, row.currentStage);
        if (includeAdvanced ? cs < stage : cs !== stage) return false;
      }
      if (verdictFilter === "not_rated") {
        const evals = getEvaluations(row.formDataId, row.evaluations);
        const cs = getCurrentStage(row.formDataId, row.currentStage);
        const stageEvals = showAllStages ? evals : evals.filter((e) => e.stage === cs);
        const hasMyRating = stageEvals.some((e) => e.evaluatorId === currentUserId);
        if (hasMyRating) return false;
      } else if (verdictFilter !== "all") {
        const evals = getEvaluations(row.formDataId, row.evaluations);
        const cs = getCurrentStage(row.formDataId, row.currentStage);
        const stageEvals = showAllStages ? evals : evals.filter((e) => e.stage === cs);
        const effectiveVerdict = computeConsensusVerdict(stageEvals);
        if (effectiveVerdict !== verdictFilter) return false;
      }
      return true;
    });
  }, [rows, search, areaFilter, stageFilter, includeAdvanced, verdictFilter, currentUserId, getEvaluations, getCurrentStage, showAllStages]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "projectName":
          return dir * a.projectName.localeCompare(b.projectName);
        case "applicant":
          return dir * a.applicantName.localeCompare(b.applicantName);
        case "email":
          return dir * a.applicantEmail.localeCompare(b.applicantEmail);
        case "areaOfFocus":
          return dir * (a.areaOfFocus ?? "").localeCompare(b.areaOfFocus ?? "");
        case "country":
          return dir * a.country.localeCompare(b.country);
        case "stageProgress":
          return dir * (a.stageProgress - b.stageProgress);
        case "hackathon":
          return dir * a.hackathonTitle.localeCompare(b.hackathonTitle);
        case "origin":
          return dir * a.origin.localeCompare(b.origin);
        case "verdict": {
          const evalsA = getEvaluations(a.formDataId, a.evaluations);
          const evalsB = getEvaluations(b.formDataId, b.evaluations);
          const csA = getCurrentStage(a.formDataId, a.currentStage);
          const csB = getCurrentStage(b.formDataId, b.currentStage);
          const filtA = showAllStages ? evalsA : evalsA.filter((e) => e.stage === csA);
          const filtB = showAllStages ? evalsB : evalsB.filter((e) => e.stage === csB);
          const valA = computeAverageScore(filtA) ?? 0;
          const valB = computeAverageScore(filtB) ?? 0;
          return dir * (valA - valB);
        }
        case "teamSize": {
          const sizeA = a.project?.members.length ?? 0;
          const sizeB = b.project?.members.length ?? 0;
          return dir * (sizeA - sizeB);
        }
        case "createdAt": {
          const dateA = a.project ? new Date(a.project.createdAt).getTime() : 0;
          const dateB = b.project ? new Date(b.project.createdAt).getTime() : 0;
          return dir * (dateA - dateB);
        }
        default:
          return 0;
      }
    });
  }, [filtered, sortField, sortDir, getEvaluations, getCurrentStage, showAllStages]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const handleHackathonChange = (value: string) => {
    if (value === "all") {
      router.push("/evaluate");
    } else {
      router.push(`/evaluate?hackathonId=${value}`);
    }
  };

  const totalSubmissions = rows.length;
  const allEvalFormIds = new Set(allEvaluations.map((e) => e.formDataId));
  const evaluated = rows.filter((r) => allEvalFormIds.has(r.formDataId)).length;
  const hasStages = rows.some((r) => r.stageProgress > 0 || r.currentStage > 0);
  const stageCounts = hasStages
    ? [0, 1, 2, 3, 4].map((s) => rows.filter((r) => getCurrentStage(r.formDataId, r.currentStage) === s).length)
    : [];
  const columnCount = hasStages ? 9 : 8;

  // Stage-specific stats when a stage is selected
  const selectedStage = stageFilter === "all" ? null : Number(stageFilter);
  const stageStats = useMemo(() => {
    if (selectedStage === null) return null;
    const stageRows = includeAdvanced
      ? rows.filter((r) => getCurrentStage(r.formDataId, r.currentStage) >= selectedStage)
      : rows.filter((r) => getCurrentStage(r.formDataId, r.currentStage) === selectedStage);
    const stageRowFormIds = new Set(stageRows.map((r) => r.formDataId));
    const stageEvals = allEvaluations.filter((e) => e.stage === selectedStage && stageRowFormIds.has(e.formDataId));
    const stageEvalFormIds = new Set(stageEvals.map((e) => e.formDataId));
    const stageEvaluated = stageRows.filter((r) => stageEvalFormIds.has(r.formDataId)).length;
    const withScores = stageEvals.filter((e) => e.scoreOverall !== null);
    const avgScore = withScores.length > 0
      ? Math.round((withScores.reduce((s, e) => s + (e.scoreOverall ?? 0), 0) / withScores.length) * 10) / 10
      : null;
    // Top area at this stage
    const areaCounts = new Map<string, number>();
    for (const r of stageRows) {
      const area = r.areaOfFocus;
      if (area) {
        areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
      }
    }
    let topArea: string | null = null;
    let topAreaCount = 0;
    for (const [area, count] of areaCounts) {
      if (count > topAreaCount) {
        topArea = area;
        topAreaCount = count;
      }
    }

    return {
      total: stageRows.length,
      evaluated: stageEvaluated,
      notRated: stageRows.length - stageEvaluated,
      totalVotes: stageEvals.length,
      avgScore,
      topArea,
    };
  }, [selectedStage, includeAdvanced, rows, allEvaluations, getCurrentStage]); // includeAdvanced derived from stageFilter

  const [showExport, setShowExport] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Evaluation Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {totalSubmissions} submissions &middot; {evaluated} evaluated
          </p>
        </div>
        <div className="flex gap-2">
          {isDevrel && hasStages && (
            <BulkAdvanceButton
              rows={rows}
              getEvaluations={getEvaluations}
              getCurrentStage={getCurrentStage}
              onAdvanced={handleStageAdvanced}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)} className="cursor-pointer">
            Export
          </Button>
          <JudgeLeaderboard evaluations={allEvaluations} rows={rows} />
        </div>
      </div>

      {/* Stats */}
      {stageStats !== null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="At This Stage" value={stageStats.total} tooltip="Projects currently assigned to this stage" />
          <StatCard label="Evaluated" value={stageStats.evaluated} sub={stageStats.total > 0 ? `${Math.round((stageStats.evaluated / stageStats.total) * 100)}%` : ""} tooltip="Projects at this stage with at least one evaluation" />
          <StatCard label="Avg Score" value={stageStats.avgScore !== null ? stageStats.avgScore.toFixed(1) : "\u2014"} tooltip="Average overall score at this stage" />
          <StatCard label="Total Votes" value={stageStats.totalVotes} tooltip="All evaluations submitted at this stage, including projects that have since advanced" />
          <StatCard label="Not Rated" value={stageStats.notRated} tooltip="Projects at this stage with no evaluations yet" />
          <StatCard label="Top Area" value={stageStats.topArea?.replace(/_/g, " ") ?? "\u2014"} tooltip="Most represented area at this stage" />
        </div>
      ) : hasStages ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Submissions" value={totalSubmissions} />
          <StatCard label="Evaluated" value={evaluated} />
          <StatCard label="Stage 1" value={stageCounts[1]} />
          <StatCard label="Stage 2" value={stageCounts[2]} />
          <StatCard label="Stage 3" value={stageCounts[3]} />
          <StatCard label="Stage 4" value={stageCounts[4]} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Submissions" value={totalSubmissions} />
          <StatCard label="Evaluated" value={evaluated} />
          <StatCard
            label="Not Evaluated"
            value={totalSubmissions - evaluated}
          />
          <StatCard label="Judges Active" value={new Set(allEvaluations.map((e) => e.evaluatorId)).size} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={selectedHackathonId || "all"}
          onValueChange={handleHackathonChange}
        >
          <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 w-56">
            <SelectValue placeholder="Select Hackathon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hackathons</SelectItem>
            {hackathons.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search by name, email, project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
        />

        {areasOfFocus.length > 0 && (
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
              <SelectValue placeholder="Area of Focus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {areasOfFocus.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasStages && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="0">Applied Only</SelectItem>
              <SelectItem value="1">Stage 1 - Idea</SelectItem>
              <SelectItem value="2">Stage 2 - MVP</SelectItem>
              <SelectItem value="3">Stage 3 - GTM</SelectItem>
              <SelectItem value="4">Stage 4 - Finals</SelectItem>
            </SelectContent>
          </Select>
        )}

        {selectedStage !== null && selectedStage < 4 && (
          <button
            onClick={() => setIncludeAdvanced((v) => !v)}
            className={`text-xs cursor-pointer transition-colors ${
              includeAdvanced
                ? "text-zinc-900 dark:text-white font-semibold underline underline-offset-2"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
            title="Include projects that advanced past this stage"
          >
            & above
          </button>
        )}

        <Select value={verdictFilter} onValueChange={setVerdictFilter}>
          <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
            <SelectValue placeholder="Verdict" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verdicts</SelectItem>
            <SelectItem value="not_rated">Not Rated by Me</SelectItem>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="strong">Strong</SelectItem>
            <SelectItem value="maybe">Maybe</SelectItem>
            <SelectItem value="weak">Weak</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-zinc-500 ml-auto">
          Showing {sorted.length} of {totalSubmissions}
        </span>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-950 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50">
              <SortableHead
                field="projectName"
                label="Project"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
              <SortableHead
                field="applicant"
                label="Applicant"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
              <SortableHead
                field="email"
                label="Email"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
              <SortableHead
                field="areaOfFocus"
                label="Area"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
              <SortableHead
                field="country"
                label="Country"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
              {hasStages && (
                <SortableHead
                  field="stageProgress"
                  label="Stage"
                  currentField={sortField}
                  indicator={sortIndicator}
                  onSort={handleSort}
                />
              )}
              <TableHead className="text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <span
                    className={`cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white ${sortField === "verdict" ? "text-zinc-900 dark:text-white" : ""}`}
                    onClick={() => handleSort("verdict")}
                  >
                    Verdict{sortIndicator("verdict")}
                  </span>
                  {hasStages && (
                    <label
                      className="flex items-center gap-1 cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      title="Show verdicts from all stages combined. When unchecked, only shows evaluations for the project's current stage."
                    >
                      <input
                        type="checkbox"
                        checked={showAllStages}
                        onChange={(e) => setShowAllStages(e.target.checked)}
                        className="rounded border-zinc-300 dark:border-zinc-600 bg-zinc-200 dark:bg-zinc-800 w-3 h-3"
                      />
                      All
                    </label>
                  )}
                </div>
              </TableHead>
              <SortableHead
                field="teamSize"
                label="Team"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
              <SortableHead
                field="createdAt"
                label="Created"
                currentField={sortField}
                indicator={sortIndicator}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const mergedEvaluations = getEvaluations(
                row.formDataId,
                row.evaluations
              );
              return (
                <TableRowGroup
                  key={row.formDataId}
                  row={row}
                  evaluations={mergedEvaluations}
                  hasStages={hasStages}
                  showAllStages={showAllStages}
                  onToggle={() => setExpandedId(row.formDataId)}
                  getCurrentStage={getCurrentStage}
                />
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="py-16"
                >
                  <div className="text-center space-y-2">
                    <p className="text-zinc-500">No submissions match the current filters.</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-600">Try adjusting your search or filter criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal for selected project */}
      {expandedId && (() => {
        const selectedRow = rows.find((r) => r.formDataId === expandedId);
        if (!selectedRow) return null;
        const mergedEvals = getEvaluations(selectedRow.formDataId, selectedRow.evaluations);
        const cs = getCurrentStage(selectedRow.formDataId, selectedRow.currentStage);
        return (
          <SubmissionDetailPanel
            row={{ ...selectedRow, currentStage: cs }}
            evaluations={mergedEvals}
            currentUserId={currentUserId}
            isDevrel={isDevrel}
            onClose={() => setExpandedId(null)}
            onEvaluationSaved={handleEvaluationSaved}
            onStageAdvanced={handleStageAdvanced}
          />
        );
      })()}

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          rows={sorted}
          hackathonTitle={hackathons.find((h) => h.id === selectedHackathonId)?.title ?? "All-Hackathons"}
          getEvaluations={getEvaluations}
          getCurrentStage={getCurrentStage}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tooltip }: { label: string; value: number | string; sub?: string; tooltip?: string }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900 px-3 py-2" title={tooltip}>
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{value}</p>
        {sub && <span className="text-xs text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}

function SortableHead({
  field,
  label,
  currentField,
  indicator,
  onSort,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  indicator: (f: SortField) => string;
  onSort: (f: SortField) => void;
}) {
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white ${
        currentField === field ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
      }`}
      onClick={() => onSort(field)}
    >
      {label}
      {indicator(field)}
    </TableHead>
  );
}

function StageBadge({ stage }: { stage: number }) {
  return (
    <Badge variant="outline" className={STAGE_BADGE_COLORS[stage] ?? STAGE_BADGE_COLORS[0]}>
      {STAGE_LABELS[stage] ?? "Applied"}
    </Badge>
  );
}

function TableRowGroup({
  row,
  evaluations,
  hasStages,
  showAllStages,
  onToggle,
  getCurrentStage,
}: {
  row: SubmissionRow;
  evaluations: EvaluationData[];
  hasStages: boolean;
  showAllStages: boolean;
  onToggle: () => void;
  getCurrentStage: (formDataId: string, original: number) => number;
}) {
  const currentStage = getCurrentStage(row.formDataId, row.currentStage);
  const teamSize = row.project?.members.length ?? 0;
  const stageEvals = showAllStages
    ? evaluations
    : evaluations.filter((e) => e.stage === currentStage);
  const consensus = computeConsensusVerdict(stageEvals);
  const avgScore = computeAverageScore(stageEvals);

  return (
      <TableRow
        className="border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900/70"
        onClick={onToggle}
      >
        <TableCell className="font-medium text-zinc-900 dark:text-white max-w-[160px] truncate" title={row.projectName}>
          {row.projectName}
        </TableCell>
        <TableCell className="text-zinc-600 dark:text-zinc-300 max-w-[140px] truncate" title={row.applicantName}>
          {row.applicantName}
        </TableCell>
        <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs max-w-[140px] truncate" title={row.applicantEmail}>
          {row.applicantEmail}
        </TableCell>
        <TableCell>
          {row.areaOfFocus ? (
            <Badge variant="secondary" className="text-xs">
              {row.areaOfFocus}
            </Badge>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">&mdash;</span>
          )}
        </TableCell>
        <TableCell className="text-zinc-500 dark:text-zinc-400 max-w-[100px] truncate" title={row.country}>
          {row.country || "\u2014"}
        </TableCell>
        {hasStages && (
          <TableCell>
            <StageBadge stage={currentStage} />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-1.5">
            {consensus ? (
              <>
                <VerdictBadge verdict={consensus} />
                {avgScore !== null && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {avgScore.toFixed(1)}
                  </span>
                )}
                <span className="text-xs text-zinc-400 dark:text-zinc-600">
                  ({stageEvals.length})
                </span>
              </>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-600">&mdash;</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-zinc-500 dark:text-zinc-400">
          {row.project ? teamSize : "-"}
        </TableCell>
        <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">
          {row.project
            ? new Date(row.project.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "-"}
        </TableCell>
      </TableRow>
  );
}
