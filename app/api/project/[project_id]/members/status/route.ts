import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { UpdateStatusMember } from "@/server/services/memberProject";
import { NextResponse } from "next/server";

export const PATCH = withAuth(async (request: Request, context: any) => {
  try {
    const body = await request.json();
    const { user_id,status } = body;
    const { project_id } =await context.params; 
    const updatedMember = UpdateStatusMember(user_id,project_id,status);
    return NextResponse.json(updatedMember);
  } catch (error: any) {
    console.error('Error updating member role:', error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message || "Internal server error" },
      { status: wrappedError.cause === 'ValidationError' ? 400 : 500 }
    );
  }
});