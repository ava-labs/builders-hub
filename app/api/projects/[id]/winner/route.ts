import { NextRequest, NextResponse } from "next/server";
import { withAuthRole, type RouteParams } from "@/lib/protectedRoute";
import { parseIsWinnerBody } from "@/lib/hackathons/evaluation-phase";
import {
  SetWinner,
  WinnerOperationError,
} from "@/server/services/set-project-winner";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

const winnerBodySchema = z.object({
  isWinner: z.boolean().nullish(),
  is_winner: z.boolean().nullish(),
});

type Params = RouteParams<{ id: string }>;

export const POST = withAuthRole<Params>(
  "devrel",
  async (request: NextRequest, context: Params, session) => {
    const { id: projectId } = await context.params;
    const body = await readJsonBody(request, winnerBodySchema);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = parseIsWinnerBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const awardedBy = session.user.name || session.user.email || session.user.id;
      const result = await SetWinner(projectId, parsed.isWinner, awardedBy);
      return NextResponse.json({
        project: {
          id: projectId,
          is_winner: result.isWinner,
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
