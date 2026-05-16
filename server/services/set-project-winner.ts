import {
  HackathonEvaluationPhase,
  ProjectWinnerRank,
} from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { badgeAssignmentService } from "./badgeAssignmentService";
import { AssignBadgeResult, BadgeCategory } from "./badge";

export class WinnerOperationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WinnerOperationError";
  }
}

export async function SetWinner(
  project_id: string,
  winnerRank: ProjectWinnerRank | null,
  awardedBy: string,
) {
  const existingProject = await prisma.project.findUnique({
    where: { id: project_id },
    select: { is_winner: true, winner_rank: true, hackaton_id: true },
  });

  if (!existingProject) {
    throw new Error("Project not found");
  }

  if (!existingProject.hackaton_id) {
    throw new WinnerOperationError(
      "Project is not attached to a hackathon",
      400,
    );
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: existingProject.hackaton_id },
    select: { id: true, evaluation_phase: true },
  });
  if (!hackathon) {
    throw new WinnerOperationError("Hackathon not found", 404);
  }
  if (hackathon.evaluation_phase !== HackathonEvaluationPhase.PICKING) {
    throw new WinnerOperationError(
      "Winners can only be set once the hackathon is in the picking phase",
      409,
    );
  }

  if (winnerRank === ProjectWinnerRank.FIRST_PLACE) {
    await prisma.project.updateMany({
      where: {
        hackaton_id: existingProject.hackaton_id,
        winner_rank: ProjectWinnerRank.FIRST_PLACE,
        NOT: { id: project_id },
      },
      data: { winner_rank: ProjectWinnerRank.WINNER },
    });
  }

  const isWinner = winnerRank !== null;
  const wasWinner = existingProject.is_winner === true;

  const project = await prisma.project.update({
    where: { id: project_id },
    data: { winner_rank: winnerRank, is_winner: isWinner },
  });

  let result: AssignBadgeResult & { alreadyWinner?: boolean } = {
    success: true,
    message: isWinner
      ? "Project winner status updated successfully"
      : "Project winner status cleared",
    badge_id: "",
    user_id: "",
    badges: [],
  };

  if (isWinner && !wasWinner) {
    const badge = await badgeAssignmentService.assignBadge(
      {
        projectId: project_id,
        userId: "",
        hackathonId: project.hackaton_id ?? undefined,
        category: BadgeCategory.project,
      },
      awardedBy,
    );
    result = { ...badge, success: true };
  }

  return {
    ...result,
    winnerRank: project.winner_rank,
    isWinner: project.is_winner ?? false,
  };
}
