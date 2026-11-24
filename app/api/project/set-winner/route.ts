import { Session } from 'next-auth';
import { withAuthRole } from "@/lib/protectedRoute";
import { parseIsWinnerBody } from "@/lib/hackathons/evaluation-phase";
import {
  SetWinner,
  WinnerOperationError,
} from "@/server/services/set-project-winner";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

const setWinnerBodySchema = z.object({
  project_id: z.string().optional(),
  isWinner: z.boolean().nullish(),
  is_winner: z.boolean().nullish(),
});

export const PUT = withAuthRole("badge_admin", async (req: NextRequest, _context: unknown, session: Session) => {
  const body = await readJsonBody(req, setWinnerBodySchema);
  if (!body) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
  const name = session.user.name || "user";

  try {
    if (!body.project_id) {
      return NextResponse.json(
        { success: false, error: "project_id parameter is required" },
        { status: 400 }
      );
    }

    const parsed = parseIsWinnerBody(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    const result = await SetWinner(body.project_id, parsed.isWinner, name);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error setting project winner:", error);

    if (error instanceof WinnerOperationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof Error && error.message === "Project not found") {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update project winner status" },
      { status: 500 }
    );
  }
});
