import { withAuth } from "@/lib/protectedRoute";
import { badgeAssignmentService } from "@/server/services/badgeAssignmentService";
import { getAuthSession } from "@/lib/auth/authSession";

import { NextRequest, NextResponse } from "next/server";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const session = await getAuthSession();
    
    const userRole = session?.user.role || "user";
    const customAttributes = session?.user.custom_attributes ?? [];
    
    // Get the required role for this badge type
    const requiredRole = badgeAssignmentService.getRequiredRoleForAssignment(body);
    const hasAdminPermission = requiredRole ? customAttributes.includes(requiredRole) : false;

    // Security check: Users can only assign badges to themselves unless they have admin role
    // - If no admin role required (academy/requirement badges): user must assign to self
    // - If admin role required (project badges): user must have the required role (badge_admin)
    if (requiredRole === null) {
      // No admin role required = user can only assign to themselves
      if (body.userId !== session?.user.id) {
        return NextResponse.json(
          { error: { message: "You can only assign badges to yourself" } },
          { status: 403 }
        );
      }
    } else {
      // Admin role required - check if user has the permission
      if (!hasAdminPermission) {
        return NextResponse.json(
          { 
            error: { 
              message: `Insufficient permissions. Required role: ${requiredRole}, User role: ${userRole}` 
            } 
          },
          { status: 403 }
        );
      }
      // Admin can assign to any user - no userId restriction
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
