import { HackathonEvaluationPhase, ProjectWinnerRank } from "@prisma/client";

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

const VALID_RANKS = new Set<ProjectWinnerRank>([
  ProjectWinnerRank.FIRST_PLACE,
  ProjectWinnerRank.WINNER,
]);

export type ParsedWinnerRank =
  | { ok: true; rank: ProjectWinnerRank | null }
  | { ok: false; error: string };

export function parseWinnerRankBody(body: {
  winner_rank?: unknown;
  isWinner?: unknown;
  is_winner?: unknown;
}): ParsedWinnerRank {
  if (body.winner_rank !== undefined) {
    if (body.winner_rank === null) return { ok: true, rank: null };
    if (
      typeof body.winner_rank === "string" &&
      VALID_RANKS.has(body.winner_rank as ProjectWinnerRank)
    ) {
      return { ok: true, rank: body.winner_rank as ProjectWinnerRank };
    }
    return { ok: false, error: "winner_rank must be FIRST_PLACE, WINNER, or null" };
  }

  const legacy = body.isWinner ?? body.is_winner;
  if (typeof legacy === "boolean") {
    return { ok: true, rank: legacy ? ProjectWinnerRank.WINNER : null };
  }

  return { ok: false, error: "winner_rank or is_winner is required" };
}
