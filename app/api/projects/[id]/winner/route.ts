import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { withAuthPermission, type RouteParams } from "@/lib/protectedRoute";

type Params = RouteParams<{ id: string }>;

type Body = { is_winner?: boolean };

export const POST = withAuthPermission<Params>(
  { resource: "hackathon", action: "manage" },
  async (request: NextRequest, context: Params) => {
    const { id: projectId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Body;
    if (typeof body.is_winner !== "boolean") {
      return NextResponse.json(
        { error: "is_winner (boolean) is required" },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { is_winner: body.is_winner },
      select: { id: true, is_winner: true },
    });

    return NextResponse.json({ project: updated });
  },
);
