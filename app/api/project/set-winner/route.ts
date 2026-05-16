import { Session } from 'next-auth';
import { ProjectWinnerRank } from "@prisma/client";
import { withAuthRole } from "@/lib/protectedRoute";
import {
  SetWinner,
  WinnerOperationError,
} from "@/server/services/set-project-winner";
import { NextRequest, NextResponse } from "next/server";

const VALID_RANKS = new Set<ProjectWinnerRank>([
  ProjectWinnerRank.FIRST_PLACE,
  ProjectWinnerRank.WINNER,
]);

export const PUT = withAuthRole("badge_admin", async (req: NextRequest, _context: unknown, session: Session) => {
  const body = await req.json();
  const name = session.user.name || "user";

  try {
    if (!body.project_id) {
      return NextResponse.json(
        { success: false, error: "project_id parameter is required" },
        { status: 400 }
      );
    }

    let winnerRank: ProjectWinnerRank | null;
    if (body.winner_rank !== undefined) {
      if (body.winner_rank === null) {
        winnerRank = null;
      } else if (
        typeof body.winner_rank === "string" &&
        VALID_RANKS.has(body.winner_rank as ProjectWinnerRank)
      ) {
        winnerRank = body.winner_rank as ProjectWinnerRank;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "winner_rank must be FIRST_PLACE, WINNER, or null",
          },
          { status: 400 },
        );
      }
    } else if (body.isWinner !== undefined) {
      // Legacy callers still send isWinner. Map true → WINNER, false → null.
      winnerRank =
        body.isWinner === true ? ProjectWinnerRank.WINNER : null;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "winner_rank parameter is required",
        },
        { status: 400 },
      );
    }

    const result = await SetWinner(body.project_id, winnerRank, name);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error setting project winner:", error);

    if (error instanceof WinnerOperationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    // Handle known, safe errors that can be exposed to the client
    if (error instanceof Error && error.message === "Project not found") {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // For all other errors, return a generic message to avoid leaking internal details
    return NextResponse.json(
      { success: false, error: "Failed to update project winner status" },
      { status: 500 }
    );
  }
});
