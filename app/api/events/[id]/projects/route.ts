import { NextRequest, NextResponse } from "next/server";
import { HackathonEvaluationPhase } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canEvaluateHackathon,
  verifyHackathonProjectsApiKey,
} from "@/lib/auth/permissions";
import type { RouteParams } from "@/lib/protectedRoute";

type Params = RouteParams<{ id: string }>;

const projectMetaSelect = {
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
  screenshots: true,
  tracks: true,
  categories: true,
  tags: true,
  website: true,
  socials: true,
  is_winner: true,
  winner_rank: true,
  created_at: true,
  updated_at: true,
} as const;

export async function GET(request: NextRequest, context: Params) {
  const { id: hackathonId } = await context.params;

  const apiKeyHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  const hasApiKey = verifyHackathonProjectsApiKey(apiKeyHeader);

  let internalAuthorized = false;
  if (!hasApiKey) {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    internalAuthorized = await canEvaluateHackathon(session, hackathonId);
    if (!internalAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, title: true, evaluation_phase: true },
  });
  if (!hackathon) {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }

  if (internalAuthorized) {
    const session = await getAuthSession();
    const viewerId = session?.user?.id ?? null;

    const projects = await prisma.project.findMany({
      where: { hackaton_id: hackathonId },
      orderBy: { created_at: "asc" },
      select: {
        ...projectMetaSelect,
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
            score_overall: true,
            scores: true,
            verdict: true,
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

    // Invisible judging: while the hackathon is in the EVALUATION phase,
    // strip every other judge's scoring data so reviewers cannot anchor on
    // each other. The viewer's own evaluation remains intact, and the
    // evaluator stub stays so "X judges reviewed" counts work. Once devrel
    // advances to PICKING, every judge + devrel sees the full picture.
    const isEvaluationPhase =
      hackathon.evaluation_phase === HackathonEvaluationPhase.EVALUATION;

    const projectsForViewer = projects.map((project) => {
      if (!isEvaluationPhase) return project;
      return {
        ...project,
        evaluations: project.evaluations.map((evaluation) => {
          if (viewerId && evaluation.evaluator_id === viewerId) {
            return evaluation;
          }
          return {
            ...evaluation,
            score_overall: null,
            scores: null,
            verdict: null,
            comment: null,
          };
        }),
      };
    });

    return NextResponse.json({
      hackathon,
      projects: projectsForViewer,
      scope: "internal",
      evaluation_phase: hackathon.evaluation_phase,
    });
  }

  const projects = await prisma.project.findMany({
    where: { hackaton_id: hackathonId },
    orderBy: { created_at: "asc" },
    select: {
      ...projectMetaSelect,
      members: {
        select: {
          id: true,
          status: true,
          role: true,
        },
      },
    },
  });
  return NextResponse.json({ hackathon, projects, scope: "external" });
}
