import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { canAccessEvaluationTools } from "@/lib/auth/permissions";

function computeStageProgress(origin: string, data: Record<string, unknown>): number {
  if (origin !== "build_games") return 0;
  const hasData = (keys: string[]) => keys.some((k) => data[k] && String(data[k]).trim());
  if (hasData(["game_metrics", "game_vision"])) return 4;
  if (hasData(["game_acquisition", "game_community", "game_monetization"])) return 3;
  if (hasData(["game_playable_state", "game_smart_contracts", "game_onboarding"])) return 2;
  if (hasData(["game_type", "problem_statement", "proposed_solution", "architecture_overview"])) return 1;
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id || !canAccessEvaluationTools(session.user.custom_attributes)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hackathonId = searchParams.get("hackathonId");

    const where: Record<string, unknown> = {};
    if (hackathonId) {
      where.project = { hackaton_id: hackathonId };
    }

    const formDataRecords = await prisma.formData.findMany({
      where,
      include: {
        project: {
          include: {
            hackathon: { select: { id: true, title: true } },
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, country: true, github: true, telegram_user: true },
                },
              },
            },
          },
        },
        evaluations: {
          include: {
            evaluator: { select: { id: true, name: true } },
          },
          orderBy: { created_at: "desc" },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    const submissions = formDataRecords.map((fd) => {
      const lead = fd.project.members.find((m) => m.role === "Lead") ?? fd.project.members[0];
      const leadUser = lead?.user;

      const rawFormData = fd.form_data as Record<string, unknown>;
      const bgFormData = (rawFormData?.build_games ?? rawFormData) as Record<string, unknown>;
      const applicantData = (rawFormData?.applicant as Record<string, unknown>) ?? null;
      const areaOfFocus = (applicantData?.area_of_focus as string) ?? null;

      const stageProgress = computeStageProgress(fd.origin, bgFormData);

      const applicationData = applicantData ?? null;

      const applicantName = applicantData
        ? `${applicantData.first_name ?? ""} ${applicantData.last_name ?? ""}`.trim()
        : null;

      return {
        formDataId: fd.id,
        projectId: fd.project_id,
        projectName: fd.project.project_name || (applicantData?.project_name as string) || "",
        shortDescription: fd.project.short_description,
        hackathonId: fd.project.hackaton_id ?? "",
        hackathonTitle: fd.project.hackathon?.title ?? "Unknown",
        origin: fd.origin,
        formData: fd.form_data as Record<string, unknown>,
        finalVerdict: fd.final_verdict,
        applicantName: leadUser?.name ?? applicantName ?? "Unknown",
        applicantEmail: leadUser?.email ?? (applicantData?.email as string) ?? lead?.email ?? "",
        country: leadUser?.country ?? (applicantData?.country as string) ?? "",
        telegram: leadUser?.telegram_user ?? (applicantData?.telegram as string) ?? null,
        github: leadUser?.github ?? (applicantData?.github as string) ?? null,
        areaOfFocus,
        stageProgress,
        applicationData,
        project: {
          id: fd.project.id,
          projectName: fd.project.project_name,
          shortDescription: fd.project.short_description,
          fullDescription: fd.project.full_description ?? "",
          techStack: fd.project.tech_stack ?? "",
          githubRepository: fd.project.github_repository ?? "",
          demoLink: fd.project.demo_link ?? "",
          demoVideoLink: fd.project.demo_video_link ?? "",
          tracks: fd.project.tracks,
          categories: fd.project.categories,
          isPreexistingIdea: fd.project.is_preexisting_idea,
          createdAt: fd.project.created_at.toISOString(),
          members: fd.project.members.map((m) => ({
            id: m.id,
            email: m.email ?? m.user?.email ?? "",
            role: m.role,
            status: m.status,
          })),
        },
        currentStage: fd.current_stage ?? 0,
        evaluations: fd.evaluations.map((e) => ({
          id: e.id,
          formDataId: e.form_data_id,
          evaluatorId: e.evaluator_id,
          evaluatorName: e.evaluator.name ?? "Unknown",
          verdict: e.verdict,
          comment: e.comment,
          scoreOverall: e.score_overall,
          scores: e.scores as Record<string, number> | null,
          stage: e.stage ?? 0,
          createdAt: e.created_at.toISOString(),
        })),
      };
    });

    return NextResponse.json({ submissions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
