import { NextRequest, NextResponse } from "next/server";
import { HackathonEvaluationPhase } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canEvaluateHackathon,
  canManageEvaluationPhase,
} from "@/lib/auth/permissions";
import {
  countReviewProgress,
  projectHasNoLinks,
} from "@/lib/hackathons/project-links";
import type { RouteParams } from "@/lib/protectedRoute";

type Params = RouteParams<{ id: string }>;

async function loadPhaseWithCounts(hackathonId: string) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, evaluation_phase: true },
  });
  if (!hackathon) return null;

  // Hidden projects (rejected or link-less) never reach judges, so only
  // eligible projects count toward the review gate.
  const projects = await prisma.project.findMany({
    where: { hackaton_id: hackathonId },
    select: {
      is_rejected: true,
      github_repository: true,
      demo_link: true,
      demo_video_link: true,
      website: true,
      socials: true,
      deployed_addresses: true,
      evaluations: { select: { id: true }, take: 1 },
    },
  });
  const { reviewed, total } = countReviewProgress(
    projects.map((p) => ({ ...p, auto_hidden: projectHasNoLinks(p) })),
  );

  return {
    phase: hackathon.evaluation_phase,
    reviewed,
    total,
  };
}

export async function GET(_request: NextRequest, context: Params) {
  const { id: hackathonId } = await context.params;

  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorized = await canEvaluateHackathon(session, hackathonId);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await loadPhaseWithCounts(hackathonId);
  if (!data) {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function POST(_request: NextRequest, context: Params) {
  const { id: hackathonId } = await context.params;

  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageEvaluationPhase(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = await loadPhaseWithCounts(hackathonId);
  if (!current) {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }

  if (current.phase === HackathonEvaluationPhase.PICKING) {
    return NextResponse.json(current);
  }

  if (current.total === 0 || current.reviewed < current.total) {
    return NextResponse.json(
      {
        error:
          current.total === 0
            ? "No eligible projects to review — every submission is hidden or has no links"
            : "Not all projects have been reviewed",
        reviewed: current.reviewed,
        total: current.total,
      },
      { status: 400 },
    );
  }

  await prisma.hackathon.update({
    where: { id: hackathonId },
    data: { evaluation_phase: HackathonEvaluationPhase.PICKING },
  });

  return NextResponse.json({
    phase: HackathonEvaluationPhase.PICKING,
    reviewed: current.reviewed,
    total: current.total,
  });
}
