import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import {
  GetMembersByProjectId,
  UpdateRoleMember,
} from "@/server/services/memberProject";
import { NextResponse } from "next/server";

export const GET = withAuth(async (request, context: any) => {
  try {
    const { project_id } = await context.params;
    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
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

export const PATCH = withAuth(async (request: Request, context: any) => {
  try {
    const body = await request.json();
    const { member_id, role } = body;
    console.log("body", member_id);
    if (!member_id || !role) {
      return NextResponse.json(
        { error: "member_id and role are required" },
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
