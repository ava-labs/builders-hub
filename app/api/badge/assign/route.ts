import { withAuth } from "@/lib/protectedRoute";
import { badgeAssignmentService } from "@/server/services/badgeAssignmentService";
import { getAuthSession } from "@/lib/auth/authSession";

import { NextRequest, NextResponse } from "next/server";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const session = await getAuthSession();
    
    // Check authorization based on badge type
    const userRole = session?.user.role || "user";
    const customAttributes = session?.user.custom_attributes??[];
    const hasPermission = badgeAssignmentService.hasRequiredRole(body, customAttributes);
    
    if (!hasPermission) {
      const requiredRole = badgeAssignmentService.getRequiredRoleForAssignment(body);
      return NextResponse.json(
        { 
          error: { 
            message: `Insufficient permissions. Required role: ${requiredRole || 'none'}, User role: ${userRole}` 
          } 
        },
        { status: 403 }
      );
    }
    
    // Use the user's name as awardedBy
    const badge = await badgeAssignmentService.assignBadge(body, session?.user.name || undefined);

    return NextResponse.json({ result: badge }, { status: 200 });
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
