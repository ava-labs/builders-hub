import { NextRequest, NextResponse } from "next/server";
import { withAuthRole, type RouteParams } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";

type Params = RouteParams<{ id: string }>;

export const POST = withAuthRole<Params>(
  "devrel",
  async (request: NextRequest, context: Params) => {
    const { id: projectId } = await context.params;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.is_rejected !== "boolean") {
      return NextResponse.json(
        { error: "is_rejected must be a boolean" },
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
      data: { is_rejected: body.is_rejected },
      select: { id: true, is_rejected: true },
    });

    return NextResponse.json({ project: updated });
  },
);
