import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { Prisma } from "@prisma/client";
import { MemberStatus } from "@/types/project";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

// An ID is text. Prisma reads a JSON object in its place as a filter
// (for example { not: "" }), which matches rows of other projects.
const saveStageBodySchema = z.object({
  project_id: z.string().optional(),
  form_data: z.object({ build_games: z.record(z.string(), z.unknown()) }).optional(),
});

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
        members: { some: { user_id: session.user.id, status: MemberStatus.CONFIRMED } },
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
      const body = await readJsonBody(request, saveStageBodySchema);
      if (!body) {
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 },
        );
      }
      const { project_id, form_data } = body;

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
          members: { some: { user_id: session.user.id, status: MemberStatus.CONFIRMED } },
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found or unauthorized" },
          { status: 403 },
        );
      }

      // The review result of a stage (stage1_result, stages) is in the same record. The reviewers write it, and a
      // member's body cannot: the two keys are left out of what a member sends.
      const submitted = { ...(form_data.build_games as Record<string, Prisma.InputJsonValue>) };
      delete submitted.stage1_result;
      delete submitted.stages;

      const result = await prisma.$transaction(async (tx) => {
        // Every query below uses the ID of the project the membership check returned
        const existing = await tx.formData.findFirst({
          where: { project_id: project.id, origin: "build_games" },
        });

        if (existing) {
          // Deep-merge: preserve existing build_games keys, overwrite with new values
          const existingBuildGames =
            (existing.form_data as Record<string, unknown>)?.build_games ?? {};
          const mergedData: Prisma.InputJsonValue = {
            build_games: {
              ...(existingBuildGames as Record<string, Prisma.InputJsonValue>),
              ...submitted,
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
            project_id: project.id,
            origin: "build_games",
            form_data: {
              build_games: submitted,
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
