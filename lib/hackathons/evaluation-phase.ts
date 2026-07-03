import { HackathonEvaluationPhase } from "@prisma/client";

type EvaluationLike = {
  evaluator_id: string;
  score_overall: number | null;
  scores: unknown;
  verdict: string | null;
  comment: string | null;
};

type ProjectLike<E extends EvaluationLike> = {
  evaluations: E[];
};

export function stripEvaluationsForViewer<E extends EvaluationLike, P extends ProjectLike<E>>(
  projects: P[],
  phase: HackathonEvaluationPhase,
  viewerId: string | null,
): P[] {
  if (phase !== HackathonEvaluationPhase.EVALUATION) return projects;
  return projects.map((project) => ({
    ...project,
    evaluations: project.evaluations.map((evaluation) => {
      if (viewerId && evaluation.evaluator_id === viewerId) return evaluation;
      return {
        ...evaluation,
        score_overall: null,
        scores: null,
        verdict: null,
        comment: null,
      };
    }),
  }));
}

export type ParsedIsWinner =
  | { ok: true; isWinner: boolean }
  | { ok: false; error: string };

export function parseIsWinnerBody(body: {
  isWinner?: unknown;
  is_winner?: unknown;
}): ParsedIsWinner {
  const value = body.isWinner ?? body.is_winner;
  if (typeof value === "boolean") return { ok: true, isWinner: value };
  return { ok: false, error: "is_winner (boolean) is required" };
}
