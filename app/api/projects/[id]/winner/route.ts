import { NextRequest, NextResponse } from "next/server";
import { withAuthRole, type RouteParams } from "@/lib/protectedRoute";
import { parseWinnerRankBody } from "@/lib/hackathons/evaluation-phase";
import {
  SetWinner,
  WinnerOperationError,
} from "@/server/services/set-project-winner";

type Params = RouteParams<{ id: string }>;

export const POST = withAuthRole<Params>(
  "devrel",
  async (request: NextRequest, context: Params, session) => {
    const { id: projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const parsed = parseWinnerRankBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const awardedBy = session.user.name || session.user.email || session.user.id;
      const result = await SetWinner(projectId, parsed.rank, awardedBy);
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
