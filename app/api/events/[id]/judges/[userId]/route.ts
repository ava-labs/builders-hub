import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { withAuthRole, type RouteParams } from "@/lib/protectedRoute";

type Params = RouteParams<{ id: string; userId: string }>;

export const DELETE = withAuthRole<Params>(
  "devrel",
  async (_request: NextRequest, context: Params) => {
    const { id: hackathonId, userId } = await context.params;

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
