import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { withAuth, type RouteParams } from "@/lib/protectedRoute";
import { canManageHackathonJudges } from "@/lib/auth/permissions";

type Params = RouteParams<{ id: string; userId: string }>;

export const DELETE = withAuth<Params>(
  async (_request: NextRequest, context: Params, session) => {
    const { id: hackathonId, userId } = await context.params;
    if (!(await canManageHackathonJudges(session, hackathonId))) {
      return NextResponse.json(
        { error: "Forbidden", message: "Access denied." },
        { status: 403 },
      );
    }

    const result = await prisma.hackathonJudge.deleteMany({
      where: { hackathon_id: hackathonId, user_id: userId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Judge assignment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  },
);
