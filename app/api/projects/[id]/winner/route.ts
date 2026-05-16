import { NextRequest, NextResponse } from "next/server";
import { ProjectWinnerRank } from "@prisma/client";
import { withAuthRole, type RouteParams } from "@/lib/protectedRoute";
import {
  SetWinner,
  WinnerOperationError,
} from "@/server/services/set-project-winner";

type Params = RouteParams<{ id: string }>;

type Body = {
  is_winner?: boolean;
  winner_rank?: ProjectWinnerRank | null;
};

const VALID_RANKS = new Set<ProjectWinnerRank>([
  ProjectWinnerRank.FIRST_PLACE,
  ProjectWinnerRank.WINNER,
]);

export const POST = withAuthRole<Params>(
  "devrel",
  async (request: NextRequest, context: Params, session) => {
    const { id: projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Body;

    let winnerRank: ProjectWinnerRank | null;
    if (body.winner_rank !== undefined) {
      if (body.winner_rank === null) {
        winnerRank = null;
      } else if (
        typeof body.winner_rank === "string" &&
        VALID_RANKS.has(body.winner_rank)
      ) {
        winnerRank = body.winner_rank;
      } else {
        return NextResponse.json(
          { error: "winner_rank must be FIRST_PLACE, WINNER, or null" },
          { status: 400 },
        );
      }
    } else if (typeof body.is_winner === "boolean") {
      winnerRank = body.is_winner ? ProjectWinnerRank.WINNER : null;
    } else {
      return NextResponse.json(
        { error: "winner_rank or is_winner is required" },
        { status: 400 },
      );
    }

    try {
      const awardedBy = session.user.name || session.user.email || session.user.id;
      const result = await SetWinner(projectId, winnerRank, awardedBy);
      return NextResponse.json({
        project: {
          id: projectId,
          is_winner: result.isWinner,
          winner_rank: result.winnerRank,
        },
        message: result.message,
      });
    } catch (error) {
      if (error instanceof WinnerOperationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      if (error instanceof Error && error.message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      console.error("Error setting project winner:", error);
      return NextResponse.json(
        { error: "Failed to update project winner status" },
        { status: 500 },
      );
    }
  },
);
