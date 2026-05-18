import { Session } from 'next-auth';
import { withAuth, RouteParams } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { isUserProjectMember } from "@/server/services/fileValidation";
import {
  GetMembersByProjectId,
  UpdateMemberVisibility,
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
    const { member_id, role, visibility } = body;
    const { project_id } = await params;

    if (!member_id) {
      return NextResponse.json(
        { error: "member_id is required" },
        { status: 400 }
      );
    }

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

    // Visibility updates are scoped to the member themselves — never let one
    // teammate edit another teammate's contact-visibility flags.
    if (visibility !== undefined) {
      const targetMember = await prisma.member.findUnique({
        where: { id: member_id },
        select: { user_id: true },
      });
      if (!targetMember || targetMember.user_id !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden: You can only update your own visibility settings" },
          { status: 403 }
        );
      }
      const updated = await UpdateMemberVisibility(member_id, visibility);
      // If a role was sent in the same request, apply it after visibility so the
      // response reflects both changes.
      if (role) {
        await UpdateRoleMember(member_id, role);
      }
      return NextResponse.json(updated);
    }

    if (!role) {
      return NextResponse.json(
        { error: "role or visibility is required" },
        { status: 400 }
      );
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
