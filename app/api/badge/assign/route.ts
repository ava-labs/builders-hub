import { withAuth } from "@/lib/protectedRoute";
import { badgeAssignmentService } from "@/server/services/badgeAssignmentService";
import { getAuthSession } from "@/lib/auth/authSession";
import { AssignBadgeBody, BadgeCategory } from "@/server/services/badge";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

import { NextRequest, NextResponse } from "next/server";

// The project badge caller sends no userId: the service reads the members of the project.
const bodySchema = z.object({
  category: z.enum(BadgeCategory).optional(),
  courseId: z.string().optional(),
  userId: z.string().optional(),
  hackathonId: z.string().optional(),
  projectId: z.string().optional(),
  requirementId: z.string().optional(),
  badgesId: z.array(z.string()).optional(),
});

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const parsed = await readJsonBody(req, bodySchema);
    if (!parsed) {
      return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
    }
    const body = parsed as AssignBadgeBody;
    const session = await getAuthSession();
    
    const userRole = session?.user.role || "user";
    const customAttributes = session?.user.custom_attributes ?? [];
    
    // Get the required role for this badge type
    const requiredRole = badgeAssignmentService.getRequiredRoleForAssignment(body);
    let hasAdminPermission = requiredRole ? customAttributes.includes(requiredRole) : false;

    // If badge_admin is required and user doesn't have it, check for devrel (super admin)
    if (requiredRole === "badge_admin" && !hasAdminPermission) {
      hasAdminPermission = customAttributes.includes("devrel");
    }

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
    const status = wrappedError.cause == "ValidationError" ? 400 : 500;
    return NextResponse.json(
      { error: { message: status === 400 ? wrappedError.message : "An internal error occurred" } },
      { status }
    );
  }
});
