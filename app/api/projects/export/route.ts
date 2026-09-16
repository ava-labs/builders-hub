import { z } from "zod";
import { withAuthPermission } from "@/lib/protectedRoute";
import { canEditEvent } from "@/lib/auth/permissions";
import { exportShowcase } from "@/server/services/exportShowcase";
import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";

/**
 * The export includes every project member's email address, so it must be
 * scoped to a single event the caller actually runs. `event` is required for
 * exactly that reason: without it the filter matches platform-wide.
 */
const exportFiltersSchema = z.object({
  event: z.string().min(1, "An event is required to export projects."),
  track: z.string().optional(),
  search: z.string().optional(),
  winningProjects: z.boolean().optional(),
});

export const POST = withAuthPermission(
  { resource: "showcase", action: "export" },
  async (req: NextRequest, _context: unknown, session: Session) => {
    const parsed = exportFiltersSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join(".") || "(body)",
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    // showcase:export says "may export"; it does not say "may export ANY
    // event". Without this a hackathon_creator could export the member emails
    // of every hackathon on the platform.
    if (!(await canEditEvent(session, parsed.data.event))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const buffer = await exportShowcase(parsed.data);
      if (!buffer) {
        return NextResponse.json({ message: "No projects found" }, { status: 404 });
      }
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    } catch (error) {
      // Log server-side; never return stack/cause to the client.
      console.error(
        "Error POST /api/projects/export:",
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        { error: "Internal server error", message: "Failed to export projects." },
        { status: 500 },
      );
    }
  },
);
