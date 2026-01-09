import { NextRequest, NextResponse } from "next/server";
import { HackathonHeader } from "@/types/hackathons";
import { getProject, isUserProjectMember, updateProject } from "@/server/services/projects";
import { withAuth } from "@/lib/protectedRoute";
import { Project } from "@/types/showcase";

export const GET = withAuth(async (req: NextRequest, context: any) => {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getProject(id);
    return NextResponse.json(hackathon);
  } catch (error) {
    console.error("Error in GET /api/hackathons/[id]:");
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (req: NextRequest, session: any) => {
  try {
    const id = req.nextUrl.searchParams.get("id")!;
    const partialEditedHackathon =
      (await req.json()) as Partial<HackathonHeader | Project>;

    const updatedHackathon = await updateProject(
      id ?? partialEditedHackathon.id,
      partialEditedHackathon
    );
    if (await isUserProjectMember(session.user.id, updatedHackathon.id)) {
      return NextResponse.json(
        { error: `Access denied. Unauthorized user` },
        { status: 401 }
      );
    }
    return NextResponse.json(updatedHackathon);
  } catch (error) {
    console.error("Error in PUT /api/hackathons/[id]:", error);
    return NextResponse.json(
      { error: `Internal Server Error: ${error}` },
      { status: 500 }
    );
  }
});
