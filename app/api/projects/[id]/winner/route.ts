import { NextRequest, NextResponse } from "next/server";
import { withAuth, type RouteParams } from "@/lib/protectedRoute";
import { canManageProjectOutcome } from "@/lib/auth/permissions";
import { parseIsWinnerBody } from "@/lib/hackathons/evaluation-phase";
import {
  SetWinner,
  WinnerOperationError,
} from "@/server/services/set-project-winner";
import { Session } from "next-auth";

type Params = RouteParams<{ id: string }>;

export const POST = withAuth<Params>(
  async (request: NextRequest, context: Params, session: Session) => {
    const { id: projectId } = await context.params;

    // Per-event, not platform-wide: team1_admin's event:manage is scope:"own",
    // so ownership of THIS project's event has to be resolved against the DB.
    if (!(await canManageProjectOutcome(session, projectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

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
