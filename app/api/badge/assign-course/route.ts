import { withAuth } from "@/lib/protectedRoute";
import { assignBadgeAcademy } from "@/server/services/badge";

import { NextRequest, NextResponse } from "next/server";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const badge = await assignBadgeAcademy(body);
    return NextResponse.json({ result:badge }, { status: 200 });
  } catch (error: any) {
    console.error('Error POST /api/badge/assign:', error.message);
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
