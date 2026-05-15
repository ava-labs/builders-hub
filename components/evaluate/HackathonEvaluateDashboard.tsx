"use client";

import { useMemo, useState } from "react";
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
import { Trophy } from "lucide-react";
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
  created_at: string;
  members: Member[];
  evaluations: Evaluation[];
};

type Props = {
  hackathonId: string;
  viewerId: string;
  canPickWinners: boolean;
  projects: Project[];
};

function toEvaluationData(e: Evaluation): EvaluationData {
  return {
    id: e.id,
    formDataId: "",
    evaluatorId: e.evaluator_id,
    evaluatorName: e.evaluator.name ?? e.evaluator.email,
    verdict: (e.verdict ?? "maybe") as Verdict,
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

export function HackathonEvaluateDashboard({
  hackathonId,
  viewerId,
  canPickWinners,
  projects: initialProjects,
}: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [winnerSaving, setWinnerSaving] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.project_name, p.short_description, p.tech_stack, p.tracks.join(" "), p.tags.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [projects, query]);

  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  async function toggleWinner(projectId: string, next: boolean) {
    setWinnerSaving(projectId);
    const previous = projects;
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, is_winner: next } : p)),
    );
    try {
      const res = await fetch(`/api/projects/${projectId}/winner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_winner: next }),
      });
      if (!res.ok) setProjects(previous);
    } catch {
      setProjects(previous);
    } finally {
      setWinnerSaving(null);
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

  return (
    <>
      <div className="mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="max-w-md"
        />
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%]">Project</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-[120px] text-right">Submitted</TableHead>
              <TableHead className="w-[80px] text-right">Reviews</TableHead>
              <TableHead className="w-[100px] text-right">Avg score</TableHead>
              <TableHead className="w-[110px] text-right">My score</TableHead>
              <TableHead className="w-[100px] text-right">Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-600 dark:text-zinc-500">
                  No projects yet.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const avg = averageScore(p.evaluations);
              const mine = p.evaluations.find((e) => e.evaluator_id === viewerId);
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => setOpenProjectId(p.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt="" className="size-9 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="size-9 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {p.project_name}
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
                    {avg !== null ? `${avg.toFixed(1)} / 5` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {mine?.score_overall ?? "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {canPickWinners ? (
                      <Button
                        variant={p.is_winner ? "default" : "ghost"}
                        size="sm"
                        disabled={winnerSaving === p.id}
                        onClick={() => toggleWinner(p.id, !p.is_winner)}
                        aria-pressed={Boolean(p.is_winner)}
                      >
                        <Trophy
                          className={
                            "size-3.5 " +
                            (p.is_winner ? "text-amber-300" : "text-zinc-500 dark:text-zinc-600 dark:text-zinc-500")
                          }
                        />
                        {p.is_winner ? "Winner" : "Pick"}
                      </Button>
                    ) : p.is_winner ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                        <Trophy className="size-3.5" /> Winner
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-600">—</span>
                    )}
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
    </>
  );
}
