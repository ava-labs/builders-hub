import { NextRequest, NextResponse } from "next/server";
import { HackathonEvaluationPhase } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canEvaluateHackathon,
  canManageEvaluationPhase,
} from "@/lib/auth/permissions";
import type { RouteParams } from "@/lib/protectedRoute";

type Params = RouteParams<{ id: string }>;

async function loadPhaseWithCounts(hackathonId: string) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, evaluation_phase: true },
  });
  if (!hackathon) return null;

  const total = await prisma.project.count({
    where: { hackaton_id: hackathonId },
  });

  const reviewedRows = await prisma.evaluation.findMany({
    where: { project: { hackaton_id: hackathonId } },
    select: { project_id: true },
    distinct: ["project_id"],
  });
  const reviewed = reviewedRows.filter((r) => r.project_id !== null).length;

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
        error: "Not all projects have been reviewed",
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
