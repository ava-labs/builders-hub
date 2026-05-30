import { Session } from 'next-auth';
import { withAuth, RouteParams } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { isUserProjectMember } from "@/server/services/fileValidation";
import { z } from 'zod';
import {
  GetMembersByProjectId,
  UpdateRoleMember,
} from "@/server/services/memberProject";
import { NextResponse } from "next/server";

export const GET = withAuth<RouteParams<{ project_id: string }>>(async (request, { params }, session: Session) => {
  try {
    const { project_id } = await params;
    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }

    // Check if user is a member of the project
    const isMember = await isUserProjectMember(session.user.id, project_id);
    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this project" },
        { status: 403 }
      );
    }

    const members = await GetMembersByProjectId(project_id);
    return NextResponse.json(members ?? []);
  } catch (error: any) {
    console.error("Error getting members:", error);
    console.error("Error POST /api/[project_id]/members:", error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == "ValidationError" ? 400 : 500 }
    );
  }
});

export const PATCH = withAuth<RouteParams<{ project_id: string }>>(async (request: Request, { params }, session: Session) => {
  try {
    const body = await request.json();
    const { project_id } = await params;

    const patchSchema = z.object({
      member_id: z.string().uuid(),
      role: z.enum(['member', 'admin', 'lead']),
    });
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { member_id, role } = parsed.data;

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }

    // Check if user is a member of the project
    const isMember = await isUserProjectMember(session.user.id, project_id);
    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this project" },
        { status: 403 }
      );
    }

    const callerMembership = await prisma.member.findFirst({
      where: { project_id, user_id: session.user.id },
      select: { role: true },
    });
    if (!callerMembership || !['admin', 'lead'].includes(callerMembership.role)) {
      return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    const updatedMember = await UpdateRoleMember(member_id, role);

    return NextResponse.json(updatedMember);
  } catch (error: any) {
    console.error("Error updating member role:", error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message || "Internal server error" },
      { status: wrappedError.cause === "ValidationError" ? 400 : 500 }
    );
  }
});
