import { NextRequest, NextResponse } from "next/server";
import { HackathonEvaluationPhase } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { getAuthSession } from "@/lib/auth/authSession";
import { canEvaluateHackathon } from "@/lib/auth/permissions";
import { canEditEvent } from "@/lib/auth/permissions";
import { parsePhaseBody } from "@/lib/hackathons/evaluation-phase";
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

export async function POST(request: NextRequest, context: Params) {
  const { id: hackathonId } = await context.params;

  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Per-event, not platform-wide: devrel on any event, team1_admin
  // only on events they created or cohost. team1_admin's event:manage is
  // scope:"own", so a bare hasPermission would (correctly) be false here.
  if (!(await canEditEvent(session, hackathonId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = parsePhaseBody(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid phase", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const target = parsed.data.phase;

  const current = await loadPhaseWithCounts(hackathonId);
  if (!current) {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }

  if (current.phase === target) {
    return NextResponse.json(current);
  }

  // No review-completeness gate: organizers deliberately run both open judging
  // (reveal early, judges discuss) and blind judging (reveal at the end). The
  // UI warns when scores are revealed mid-review; the choice is theirs.
  await prisma.hackathon.update({
    where: { id: hackathonId },
    data: { evaluation_phase: target },
  });

  return NextResponse.json({
    phase: target,
    reviewed: current.reviewed,
    total: current.total,
  });
}
