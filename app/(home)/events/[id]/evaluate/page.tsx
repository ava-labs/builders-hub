import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import {
  canEvaluateHackathon,
  canManageHackathonJudges,
} from "@/lib/auth/permissions";
import { HackathonEvaluateDashboard } from "@/components/evaluate/HackathonEvaluateDashboard";

export default async function HackathonEvaluatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const { id: hackathonId } = await params;

  const authorized = await canEvaluateHackathon(session, hackathonId);
  if (!authorized) {
    redirect("/");
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, title: true, start_date: true, end_date: true },
  });
  if (!hackathon) {
    redirect("/events");
  }

  const projects = await prisma.project.findMany({
    where: { hackaton_id: hackathonId },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      project_name: true,
      short_description: true,
      full_description: true,
      tech_stack: true,
      github_repository: true,
      demo_link: true,
      demo_video_link: true,
      logo_url: true,
      cover_url: true,
      tracks: true,
      categories: true,
      tags: true,
      is_winner: true,
      created_at: true,
      members: {
        select: {
          id: true,
          user_id: true,
          email: true,
          status: true,
          role: true,
        },
      },
      evaluations: {
        where: { project_id: { not: null } },
        orderBy: { updated_at: "desc" },
        select: {
          id: true,
          evaluator_id: true,
          verdict: true,
          score_overall: true,
          scores: true,
          comment: true,
          created_at: true,
          updated_at: true,
          evaluator: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  return (
    <main className="container relative px-4 py-8 lg:py-12">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Evaluate
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-800 dark:text-zinc-200">{hackathon.title}</span>{" "}
          · {projects.length}{" "}
          {projects.length === 1 ? "project" : "projects"} submitted
        </p>
      </div>
      <HackathonEvaluateDashboard
        hackathonId={hackathon.id}
        viewerId={session!.user!.id}
        canPickWinners={canManageHackathonJudges(session)}
        projects={projects.map((p) => ({
          ...p,
          created_at: p.created_at.toISOString(),
          evaluations: p.evaluations.map((e) => ({
            ...e,
            created_at: e.created_at.toISOString(),
            updated_at: e.updated_at.toISOString(),
          })),
        }))}
      />
    </main>
  );
}
