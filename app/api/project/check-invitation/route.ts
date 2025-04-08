import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { NextResponse } from "next/server";
import mermaid from 'mermaid';

export const GET = withAuth(async (request,context ,session) => {
  const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');
  if (!invitationId) {
    return NextResponse.json({ error: 'invitationId parameter is required' }, { status: 400 });
  }

  try {
    const member = await prisma.member.findFirst({
      where: { id:invitationId },  include: {
        project: true, 
      },})
    return NextResponse.json({ invitation:{isValid: !!member, isConfirming:member?.status=="Pending Confirmation"}, project: {project_id:member?.project?.id,project_name:member?.project?.project_name} }, { status: 200 });
  } catch (error) {
    console.error("Error checking user by email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

});
