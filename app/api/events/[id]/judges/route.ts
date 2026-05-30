import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { withAuthRole, type RouteParams } from "@/lib/protectedRoute";

type Params = RouteParams<{ id: string }>;

export const GET = withAuthRole<Params>(
  "devrel",
  async (_request: NextRequest, context: Params) => {
    const { id: hackathonId } = await context.params;

    const judges = await prisma.hackathonJudge.findMany({
      where: { hackathon_id: hackathonId },
      orderBy: { assigned_at: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            user_name: true,
            custom_attributes: true,
          },
        },
      },
    });

    return NextResponse.json({ judges });
  },
);

export const POST = withAuthRole<Params>(
  "devrel",
  async (request: NextRequest, context: Params, session) => {
    const { id: hackathonId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const hackathon = await prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: { id: true },
    });
    if (!hackathon) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const judge = await prisma.hackathonJudge.upsert({
      where: { hackathon_id_user_id: { hackathon_id: hackathonId, user_id: userId } },
      create: {
        hackathon_id: hackathonId,
        user_id: userId,
        assigned_by: session.user.id,
      },
      update: {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            user_name: true,
            custom_attributes: true,
          },
        },
      },
    });

    return NextResponse.json({ judge }, { status: 201 });
  },
);
