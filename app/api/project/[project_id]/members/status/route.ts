import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { NextResponse } from "next/server";

export const PATCH = withAuth(async (request: Request, context: any) => {
  try {
    const body = await request.json();
    const { user_id,status } = body;
    const { project_id } =await context.params; 
    if (!user_id || !project_id) {
      return NextResponse.json({ error: "user_id and project_id are required" }, { status: 400 });
    }
    const updatedMember = await prisma.member.update({
      where: { user_id_project_id: { user_id: user_id as string, project_id: project_id as string } },
      data: { status: status },
    });
    
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