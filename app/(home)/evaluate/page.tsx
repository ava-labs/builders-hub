import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { EvaluateDashboard } from "@/components/evaluate/EvaluateDashboard";
import type { SubmissionRow, EvaluationData } from "@/components/evaluate/types";

function computeStageProgress(origin: string, data: Record<string, unknown>): number {
  if (origin !== "build_games") return 0;
  const hasData = (keys: string[]) => keys.some((k) => data[k] && String(data[k]).trim());
  if (hasData(["game_metrics", "game_vision"])) return 4;
  if (hasData(["game_acquisition", "game_community", "game_monetization"])) return 3;
  if (hasData(["game_playable_state", "game_smart_contracts", "game_onboarding"])) return 2;
  if (hasData(["game_type", "problem_statement", "proposed_solution", "architecture_overview"])) return 1;
  return 0;
}

export default async function EvaluatePage({
  searchParams,
}: {
  searchParams: Promise<{ hackathonId?: string }>;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/");
  }

  const canAccess =
    session.user?.custom_attributes?.some(
      (attr: string) => attr === "devrel" || attr === "judge"
    ) ?? false;

  if (!canAccess) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedHackathonId = params.hackathonId ?? "";

  try {
    const formDataWhere: Record<string, unknown> = {};
    if (selectedHackathonId) {
      formDataWhere.project = { hackaton_id: selectedHackathonId };
    }

    const [hackathons, formDataRecords] = await Promise.all([
      prisma.hackathon.findMany({
        where: {
          projects: {
            some: {
              formData: { some: {} },
            },
          },
        },
        select: { id: true, title: true },
        orderBy: { start_date: "desc" },
      }),
      prisma.formData.findMany({
        where: formDataWhere,
        include: {
          project: {
            include: {
              hackathon: { select: { id: true, title: true } },
              members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, country: true, github_account: true, telegram_user: true },
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
      }),
    ]);

    const bgApplications = await prisma.buildGamesApplication.findMany();
    const bgAppByEmail = new Map(bgApplications.map((a) => [a.email.toLowerCase(), a]));

    const rows: SubmissionRow[] = formDataRecords.map((fd) => {
      const lead = fd.project.members.find((m) => m.role === "Lead") ?? fd.project.members[0];
      const leadUser = lead?.user;

      const rawFormData = fd.form_data as Record<string, unknown>;
      const bgFormData = (rawFormData?.build_games ?? rawFormData) as Record<string, unknown>;
      const applicantData = (rawFormData?.applicant as Record<string, unknown>) ?? null;

      // Find BG application for lead member (for area, name fallbacks)
      const bgApp = fd.project.members.reduce<(typeof bgApplications)[number] | null>((found, m) => {
        if (found) return found;
        const email = m.user?.email ?? m.email;
        return email ? bgAppByEmail.get(email.toLowerCase()) ?? null : null;
      }, null);

      const areaOfFocus = (applicantData?.area_of_focus as string) ?? bgApp?.area_of_focus ?? null;

      const stageProgress = computeStageProgress(fd.origin, bgFormData);

      const applicationData = applicantData ?? null;

      const applicantName = applicantData
        ? `${applicantData.first_name ?? ""} ${applicantData.last_name ?? ""}`.trim()
        : bgApp ? `${bgApp.first_name} ${bgApp.last_name}` : null;

      // Per-member applications
      const memberApplications = fd.project.members.map((m) => {
        const email = m.user?.email ?? m.email ?? "";
        const memberBgApp = email ? bgAppByEmail.get(email.toLowerCase()) : null;
        return {
          email,
          name: m.user?.name ?? (memberBgApp ? `${memberBgApp.first_name} ${memberBgApp.last_name}` : email),
          role: m.role,
          status: m.status,
          data: memberBgApp ? {
            first_name: memberBgApp.first_name,
            last_name: memberBgApp.last_name,
            email: memberBgApp.email,
            country: memberBgApp.country,
            telegram: memberBgApp.telegram,
            github: memberBgApp.github,
            employment_status: memberBgApp.employment_status,
            current_role: memberBgApp.current_role,
            employment_role: memberBgApp.employment_role,
            university_affiliation: memberBgApp.university_affiliation,
            avalanche_ecosystem_member: memberBgApp.avalanche_ecosystem_member,
            project_name: memberBgApp.project_name,
            project_description: memberBgApp.project_description,
            area_of_focus: memberBgApp.area_of_focus,
            why_you: memberBgApp.why_you,
            ready_to_win: memberBgApp.ready_to_win,
            previous_avalanche_grant: memberBgApp.previous_avalanche_grant,
            hackathon_experience: memberBgApp.hackathon_experience,
            hackathon_details: memberBgApp.hackathon_details,
            how_did_you_hear: memberBgApp.how_did_you_hear,
            how_did_you_hear_specify: memberBgApp.how_did_you_hear_specify,
            referrer_name: memberBgApp.referrer_name,
            referrer_handle: memberBgApp.referrer_handle,
          } as Record<string, unknown> : null,
        };
      });

      return {
        formDataId: fd.id,
        projectId: fd.project_id,
        projectName: fd.project.project_name || (applicantData?.project_name as string) || "",
        shortDescription: fd.project.short_description,
        hackathonId: fd.project.hackaton_id ?? "",
        hackathonTitle: fd.project.hackathon?.title ?? "Unknown",
        origin: fd.origin,
        formData: fd.form_data as Record<string, unknown>,
        finalVerdict: (fd.final_verdict as EvaluationData["verdict"]) ?? null,
        applicantName: leadUser?.name ?? applicantName ?? (bgApp ? `${bgApp.first_name} ${bgApp.last_name}` : "Unknown"),
        applicantEmail: leadUser?.email ?? bgApp?.email ?? (applicantData?.email as string) ?? lead?.email ?? "",
        country: leadUser?.country ?? bgApp?.country ?? (applicantData?.country as string) ?? "",
        telegram: leadUser?.telegram_user ?? bgApp?.telegram ?? (applicantData?.telegram as string) ?? null,
        github: leadUser?.github_account ?? bgApp?.github ?? (applicantData?.github as string) ?? null,
        areaOfFocus,
        stageProgress,
        memberApplications,
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
          verdict: e.verdict as EvaluationData["verdict"],
          comment: e.comment,
          scoreOverall: e.score_overall,
          scores: e.scores as Record<string, number> | null,
          stage: e.stage ?? 0,
          createdAt: e.created_at.toISOString(),
        })),
      };
    });

    const isDevrel = session.user?.custom_attributes?.includes("devrel") ?? false;

    return (
      <main className="container relative px-2 py-4 lg:py-16">
        <EvaluateDashboard
          rows={rows}
          hackathons={hackathons}
          currentUserId={session.user?.id ?? ""}
          selectedHackathonId={selectedHackathonId}
          isDevrel={isDevrel}
        />
      </main>
    );
  } catch {
    return (
      <main className="container relative px-2 py-4 lg:py-16">
        <p className="text-red-400">
          Failed to load data. Please try again later.
        </p>
      </main>
    );
  }
}
