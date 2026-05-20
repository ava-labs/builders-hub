"use client";

import { useMemo, useState } from "react";
import { HackathonEvaluationPhase, ProjectWinnerRank } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, EyeOff, Lock, Trophy, Unlock } from "lucide-react";
import { SubmissionDetailPanel } from "./SubmissionDetailPanel";
import type { EvaluationData, SubmissionRow, Verdict } from "./types";

type Evaluator = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

type Evaluation = {
  id: string;
  evaluator_id: string;
  verdict: string | null;
  score_overall: number | null;
  scores: unknown;
  comment: string | null;
  created_at: string;
  updated_at: string;
  evaluator: Evaluator;
};

type Member = {
  id: string;
  user_id: string | null;
  email: string | null;
  status: string;
  role: string;
};

type Project = {
  id: string;
  project_name: string;
  short_description: string;
  full_description: string | null;
  tech_stack: string | null;
  github_repository: string | null;
  demo_link: string | null;
  demo_video_link: string | null;
  logo_url: string | null;
  cover_url: string | null;
  tracks: string[];
  categories: string[];
  tags: string[];
  is_winner: boolean | null;
  winner_rank: ProjectWinnerRank | null;
  created_at: string;
  members: Member[];
  evaluations: Evaluation[];
};

type Props = {
  hackathonId: string;
  viewerId: string;
  canPickWinners: boolean;
  canManagePhase: boolean;
  initialPhase: HackathonEvaluationPhase;
  initialReviewed: number;
  projects: Project[];
};

function toEvaluationData(e: Evaluation): EvaluationData {
  return {
    id: e.id,
    formDataId: "",
    evaluatorId: e.evaluator_id,
    evaluatorName: e.evaluator.name ?? e.evaluator.email,
    verdict: (e.verdict ?? null) as Verdict | null,
    comment: e.comment,
    scoreOverall: e.score_overall,
    scores: (e.scores as Record<string, number> | null) ?? null,
    createdAt: e.created_at,
    stage: 0,
  };
}

function teamLead(members: Member[]): Member | null {
  return members.find((m) => m.role === "Lead") ?? members[0] ?? null;
}

function toSubmissionRow(project: Project, hackathonId: string): SubmissionRow {
  const lead = teamLead(project.members);
  return {
    formDataId: project.id,
    projectId: project.id,
    projectName: project.project_name,
    shortDescription: project.short_description,
    hackathonId,
    hackathonTitle: "",
    origin: "hackathon",
    formData: {},
    finalVerdict: null,
    project: {
      id: project.id,
      projectName: project.project_name,
      shortDescription: project.short_description,
      fullDescription: project.full_description ?? "",
      techStack: project.tech_stack ?? "",
      githubRepository: project.github_repository ?? "",
      demoLink: project.demo_link ?? "",
      demoVideoLink: project.demo_video_link ?? "",
      tracks: project.tracks,
      categories: project.categories,
      isPreexistingIdea: false,
      createdAt: project.created_at,
      members: project.members.map((m) => ({
        id: m.id,
        email: m.email ?? "",
        role: m.role,
        status: m.status,
      })),
    },
    evaluations: project.evaluations.map(toEvaluationData),
    applicantName: lead?.email ?? "Team",
    applicantEmail: lead?.email ?? "",
    country: "",
    telegram: null,
    github: null,
    areaOfFocus: null,
    stageProgress: 0,
    currentStage: 0,
    memberApplications: [],
    applicationData: null,
  };
}

function averageScore(evals: Evaluation[]): number | null {
  const scored = evals.filter((e) => typeof e.score_overall === "number");
  if (scored.length === 0) return null;
  return scored.reduce((a, e) => a + (e.score_overall ?? 0), 0) / scored.length;
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  const justify = align === "left" ? "justify-start -ml-2" : "justify-end -mr-2";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex w-full items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors " +
        justify +
        " " +
        (active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400")
      }
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <Icon className={"size-3.5 " + (active ? "opacity-100" : "opacity-50")} />
    </button>
  );
}

const RANK_STYLES: Record<
  ProjectWinnerRank,
  { label: string; iconClass: string; chipClass: string }
> = {
  [ProjectWinnerRank.FIRST_PLACE]: {
    label: "1st place",
    iconClass: "text-amber-300",
    chipClass: "bg-amber-500/15 text-amber-300",
  },
  [ProjectWinnerRank.WINNER]: {
    label: "Winner",
    iconClass: "text-zinc-300",
    chipClass: "bg-zinc-500/20 text-zinc-200",
  },
};

export function HackathonEvaluateDashboard({
  hackathonId,
  viewerId,
  canPickWinners,
  canManagePhase,
  initialPhase,
  initialReviewed,
  projects: initialProjects,
}: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [winnerSaving, setWinnerSaving] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "evaluated">("all");
  const [sort, setSort] = useState<{
    key: "project" | "reviews" | "avg" | "mine" | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "desc" });

  function toggleSort(key: "project" | "reviews" | "avg" | "mine") {
    setSort((prev) => {
      if (prev.key !== key) {
        return { key, direction: key === "project" ? "asc" : "desc" };
      }
      if (prev.direction === "desc") return { key, direction: "asc" };
      return { key: null, direction: "desc" };
    });
  }

  const evaluatedCount = useMemo(
    () => projects.filter((p) => p.evaluations.some((e) => e.evaluator_id === viewerId)).length,
    [projects, viewerId],
  );
  const pendingCount = projects.length - evaluatedCount;
  const [phase, setPhase] = useState<HackathonEvaluationPhase>(initialPhase);
  const [phaseConfirmOpen, setPhaseConfirmOpen] = useState(false);
  const [phaseAdvancing, setPhaseAdvancing] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  const isEvaluation = phase === HackathonEvaluationPhase.EVALUATION;
  const totalProjects = projects.length;
  const reviewedCount = useMemo(
    () => projects.filter((p) => p.evaluations.length > 0).length,
    [projects],
  );
  const reviewed = projects.length === 0 ? initialReviewed : reviewedCount;
  const allReviewed = totalProjects > 0 && reviewed >= totalProjects;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const hasMine = p.evaluations.some((e) => e.evaluator_id === viewerId);
      if (statusFilter === "evaluated" && !hasMine) return false;
      if (statusFilter === "pending" && hasMine) return false;
      if (!q) return true;
      return [p.project_name, p.short_description, p.tech_stack, p.tracks.join(" "), p.tags.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [projects, query, statusFilter, viewerId]);

  const sorted = useMemo(() => {
    if (sort.key === null) return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "project") {
      return [...filtered].sort(
        (a, b) =>
          a.project_name.localeCompare(b.project_name, undefined, { sensitivity: "base" }) * dir,
      );
    }
    const valueOf = (p: Project): number | null => {
      if (sort.key === "reviews") return p.evaluations.length;
      if (sort.key === "avg") return averageScore(p.evaluations);
      if (sort.key === "mine") {
        const mine = p.evaluations.find((e) => e.evaluator_id === viewerId);
        return mine?.score_overall ?? null;
      }
      return null;
    };
    return [...filtered].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [filtered, sort, viewerId]);

  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  async function setWinnerRank(
    projectId: string,
    next: ProjectWinnerRank | null,
  ) {
    setWinnerSaving(projectId);
    const previous = projects;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) {
          if (
            next === ProjectWinnerRank.FIRST_PLACE &&
            p.winner_rank === ProjectWinnerRank.FIRST_PLACE
          ) {
            return { ...p, winner_rank: ProjectWinnerRank.WINNER, is_winner: true };
          }
          return p;
        }
        return { ...p, winner_rank: next, is_winner: next !== null };
      }),
    );
    try {
      const res = await fetch(`/api/projects/${projectId}/winner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ winner_rank: next }),
      });
      if (!res.ok) setProjects(previous);
    } catch {
      setProjects(previous);
    } finally {
      setWinnerSaving(null);
    }
  }

  async function confirmAdvancePhase() {
    setPhaseAdvancing(true);
    setPhaseError(null);
    try {
      const res = await fetch(
        `/api/events/${hackathonId}/evaluation-phase`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPhaseError(body.error ?? "Failed to advance phase");
        return;
      }
      setPhase(HackathonEvaluationPhase.PICKING);
      setPhaseConfirmOpen(false);
    } catch {
      setPhaseError("Network error — please try again");
    } finally {
      setPhaseAdvancing(false);
    }
  }

  function handleEvaluationSaved(_projectKey: string, evaluation: EvaluationData) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== openProjectId) return p;
        const others = p.evaluations.filter((e) => e.evaluator_id !== evaluation.evaluatorId);
        const fresh: Evaluation = {
          id: evaluation.id,
          evaluator_id: evaluation.evaluatorId,
          verdict: evaluation.verdict,
          score_overall: evaluation.scoreOverall,
          scores: evaluation.scores,
          comment: evaluation.comment,
          created_at: evaluation.createdAt,
          updated_at: evaluation.createdAt,
          evaluator: {
            id: evaluation.evaluatorId,
            name: evaluation.evaluatorName === "You" ? "You" : evaluation.evaluatorName,
            email: "",
            image: null,
          },
        };
        return { ...p, evaluations: [fresh, ...others] };
      }),
    );
  }

  const advanceButton = canManagePhase && isEvaluation ? (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              size="sm"
              onClick={() => setPhaseConfirmOpen(true)}
              disabled={!allReviewed}
              className="gap-1.5"
            >
              <Unlock className="size-3.5" />
              Move to picking phase
            </Button>
          </span>
        </TooltipTrigger>
        {!allReviewed && (
          <TooltipContent>
            {reviewed}/{totalProjects} projects reviewed — every project needs
            at least one evaluation before scores can be revealed.
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  ) : null;

  return (
    <>
      <div
        className={
          "mb-4 flex flex-col gap-2 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between " +
          (isEvaluation
            ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200"
            : "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200")
        }
      >
        <div className="flex items-start gap-2">
          {isEvaluation ? (
            <EyeOff className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Lock className="mt-0.5 size-4 shrink-0" />
          )}
          <div>
            <div className="font-medium">
              {isEvaluation ? "Evaluation phase" : "Picking phase"}
            </div>
            <div className="text-xs opacity-90">
              {isEvaluation
                ? "Scores are hidden between judges until devrel moves to the picking phase."
                : "All judges' scores are visible. Devrel can now select winners."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {reviewed}/{totalProjects} reviewed
          </span>
          {advanceButton}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="max-w-md"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "all", label: "All", count: projects.length },
              { key: "pending", label: "Pending", count: pendingCount },
              { key: "evaluated", label: "Evaluated", count: evaluatedCount },
            ] as const
          ).map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                aria-pressed={active}
                className={
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                  (active
                    ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 bg-transparent text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900")
                }
              >
                {opt.key === "evaluated" && <CheckCircle2 className="size-3.5" />}
                {opt.label}
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                    (active
                      ? "bg-zinc-50/20 text-zinc-50 dark:bg-zinc-900/20 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")
                  }
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%] min-w-[200px]">
                <SortHeader
                  label="Project"
                  align="left"
                  active={sort.key === "project"}
                  direction={sort.direction}
                  onClick={() => toggleSort("project")}
                />
              </TableHead>
              <TableHead className="w-[100px]">Team</TableHead>
              <TableHead className="w-[110px] text-right">Submitted</TableHead>
              <TableHead className="w-[80px] text-right">
                <SortHeader
                  label="Reviews"
                  active={sort.key === "reviews"}
                  direction={sort.direction}
                  onClick={() => toggleSort("reviews")}
                />
              </TableHead>
              <TableHead className="w-[100px] text-right">
                <SortHeader
                  label="Avg score"
                  active={sort.key === "avg"}
                  direction={sort.direction}
                  onClick={() => toggleSort("avg")}
                />
              </TableHead>
              <TableHead className="w-[100px] text-right">
                <SortHeader
                  label="My score"
                  active={sort.key === "mine"}
                  direction={sort.direction}
                  onClick={() => toggleSort("mine")}
                />
              </TableHead>
              <TableHead className="w-[110px] text-right">Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-600 dark:text-zinc-500">
                  No projects yet.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((p) => {
              const avg = averageScore(p.evaluations);
              const mine = p.evaluations.find((e) => e.evaluator_id === viewerId);
              const evaluatedByMe = Boolean(mine);
              const rankStyles = p.winner_rank ? RANK_STYLES[p.winner_rank] : null;
              return (
                <TableRow
                  key={p.id}
                  className={
                    "cursor-pointer " +
                    (evaluatedByMe ? "bg-emerald-50/40 dark:bg-emerald-500/5" : "")
                  }
                  onClick={() => setOpenProjectId(p.id)}
                >
                  <TableCell className="overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt="" className="size-9 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="size-9 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {p.project_name}
                          </div>
                          {evaluatedByMe && (
                            <span
                              title="You have evaluated this project"
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="size-3" />
                              Evaluated
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-zinc-500 dark:text-zinc-600 dark:text-zinc-500">
                          {p.short_description}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 dark:text-zinc-600 dark:text-zinc-400">
                    {p.members.length} member{p.members.length === 1 ? "" : "s"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-zinc-500 dark:text-zinc-600 dark:text-zinc-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right text-sm text-zinc-700 dark:text-zinc-300">
                    {p.evaluations.length}
                  </TableCell>
                  <TableCell className="text-right text-sm text-zinc-700 dark:text-zinc-300">
                    {isEvaluation ? "—" : avg !== null ? `${avg.toFixed(1)} / 5` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {mine?.score_overall ?? "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <WinnerControl
                      project={p}
                      canPickWinners={canPickWinners}
                      isPickingPhase={!isEvaluation}
                      isSaving={winnerSaving === p.id}
                      onSelect={(rank) => setWinnerRank(p.id, rank)}
                      rankStyles={rankStyles}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {openProject && (
        <SubmissionDetailPanel
          row={toSubmissionRow(openProject, hackathonId)}
          currentUserId={viewerId}
          isDevrel={canPickWinners}
          showStages={false}
          projectId={openProject.id}
          onClose={() => setOpenProjectId(null)}
          onEvaluationSaved={handleEvaluationSaved}
        />
      )}

      <AlertDialog open={phaseConfirmOpen} onOpenChange={setPhaseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to picking phase?</AlertDialogTitle>
            <AlertDialogDescription>
              All judges' scores will become visible to every judge and to
              devrel. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {phaseError && (
            <p className="text-sm text-red-500">{phaseError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={phaseAdvancing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={phaseAdvancing}
              onClick={(e) => {
                e.preventDefault();
                void confirmAdvancePhase();
              }}
            >
              {phaseAdvancing ? "Advancing…" : "Move to picking phase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type WinnerControlProps = {
  project: Project;
  canPickWinners: boolean;
  isPickingPhase: boolean;
  isSaving: boolean;
  onSelect: (rank: ProjectWinnerRank | null) => void;
  rankStyles: { label: string; iconClass: string; chipClass: string } | null;
};

function WinnerControl({
  project,
  canPickWinners,
  isPickingPhase,
  isSaving,
  onSelect,
  rankStyles,
}: WinnerControlProps) {
  if (!canPickWinners || !isPickingPhase) {
    if (rankStyles) {
      return (
        <span
          className={
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium " +
            rankStyles.chipClass
          }
        >
          <Trophy className={"size-3.5 " + rankStyles.iconClass} />
          {rankStyles.label}
        </span>
      );
    }
    return <span className="text-xs text-zinc-500 dark:text-zinc-600">—</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={rankStyles ? "default" : "ghost"}
          size="sm"
          disabled={isSaving}
          className="gap-1.5"
        >
          <Trophy
            className={
              "size-3.5 " +
              (rankStyles?.iconClass ??
                "text-zinc-500 dark:text-zinc-600 dark:text-zinc-500")
            }
          />
          {rankStyles ? rankStyles.label : "Pick"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => onSelect(ProjectWinnerRank.FIRST_PLACE)}
        >
          <Trophy className="size-3.5 text-amber-300" />
          1st place
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect(ProjectWinnerRank.WINNER)}>
          <Trophy className="size-3.5 text-zinc-300" />
          Winner
        </DropdownMenuItem>
        {project.winner_rank !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onSelect(null)}
              className="text-red-500 focus:text-red-500"
            >
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
