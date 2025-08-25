import { getAuthSession } from '@/lib/auth/authSession';
import { withAuth, withAuthRole } from "@/lib/protectedRoute";
import { assignBadgeProject } from "@/server/services/project-badge";


import { NextRequest, NextResponse } from "next/server";

export const POST = withAuthRole("hackathon_judge", async (req: NextRequest) => {
  try {
    const body = await req.json();
    const session = await getAuthSession();
    const badge = await assignBadgeProject(body,session?.user.name!);
    return NextResponse.json({ result:badge }, { status: 200 });
  } catch (error: any) {
    console.error('Error POST /api/badge/assign-project:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      {
        error: {
          message: wrappedError.message,
          stack: wrappedError.stack,
          cause: wrappedError.cause,
          name: wrappedError.name,
        },
      },
      { status: wrappedError.cause == "ValidationError" ? 400 : 500 }
    );
  }
});
