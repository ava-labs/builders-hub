import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { NextResponse } from "next/server";

export const GET = withAuth(async (request,context:any) => {
  try{
  
    const { project_id } =await context.params; 
    
    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }
  
    const members = await prisma.member.findMany({
      where: { project_id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  
    if (!members.length) {
      return NextResponse.json({ error: "No members found" }, { status: 404 });
    }
  
  
    return NextResponse.json(
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image,
        role: member.role,
        status: member.status,
      }))
    );
  }catch(error:any){
      console.error('Error getting members:', error);
        console.error('Error POST /api/[project_id]/members:', error.message);
        const wrappedError = error as Error;
        return NextResponse.json(
          { error: wrappedError },
          { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
        );
  }

});
