import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/build-games/stage-data?project_id=<id>
 *
 * Returns the build_games FormData JSON for the given project.
 * Response: { form_data: { build_games: { ... } } | null }
 */
export const GET = withAuth(async (request: NextRequest, _context, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get("project_id");

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 },
      );
    }

    // Verify the requesting user is a confirmed member of this project
    const project = await prisma.project.findFirst({
      where: {
        id: project_id,
        members: { some: { user_id: session.user.id, status: "Confirmed" } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 403 },
      );
    }

    const formData = await prisma.formData.findFirst({
      where: { project_id, origin: "build_games" },
    });

    return NextResponse.json({ form_data: formData?.form_data ?? null });
  } catch (error: any) {
    console.error("Error GET /api/build-games/stage-data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/build-games/stage-data
 *
 * Upserts the build_games FormData record for a project. The `form_data`
 * body field must be an object with a `build_games` key. Existing keys
 * inside `build_games` are merged (not replaced) so data from different
 * stages accumulates in the same record.
 *
 * Body: { project_id: string, form_data: { build_games: { ... } } }
 * Response: { form_data: { build_games: { ... } } }
 */
export const POST = withAuth(
  async (request: NextRequest, _context, session) => {
    try {
      const body = await request.json();
      const { project_id, form_data } = body as {
        project_id: string;
        form_data: { build_games: Record<string, unknown> };
      };

      if (!project_id) {
        return NextResponse.json(
          { error: "project_id is required" },
          { status: 400 },
        );
      }

      if (!form_data?.build_games) {
        return NextResponse.json(
          { error: "form_data.build_games is required" },
          { status: 400 },
        );
      }

      // Verify ownership
      const project = await prisma.project.findFirst({
        where: {
          id: project_id,
          members: { some: { user_id: session.user.id, status: "Confirmed" } },
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found or unauthorized" },
          { status: 403 },
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.formData.findFirst({
          where: { project_id, origin: "build_games" },
        });

        if (existing) {
          // Deep-merge: preserve existing build_games keys, overwrite with new values
          const existingBuildGames =
            (existing.form_data as Record<string, unknown>)?.build_games ?? {};
          const mergedData: Prisma.InputJsonValue = {
            build_games: {
              ...(existingBuildGames as Record<string, Prisma.InputJsonValue>),
              ...(form_data.build_games as Record<
                string,
                Prisma.InputJsonValue
              >),
              stages:
                existingBuildGames &&
                (existingBuildGames as Record<string, Prisma.InputJsonValue>).stages
                  ? (existingBuildGames as Record<string, Prisma.InputJsonValue>).stages
                  : undefined,
            },
          };

          return tx.formData.update({
            where: { id: existing.id },
            data: { form_data: mergedData, timestamp: new Date() },
          });
        }

        return tx.formData.create({
          data: {
            project_id,
            origin: "build_games",
            form_data: {
              build_games: form_data.build_games as Prisma.InputJsonValue,
              stages: undefined,
            },
            timestamp: new Date(),
          },
        });
      });

      return NextResponse.json({ form_data: result.form_data });
    } catch (error: any) {
      console.error("Error POST /api/build-games/stage-data:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  },
);
