import { z } from 'zod';
import { BadgeCategory } from '@/server/services/badge';
import { badgeAssignmentService } from '@/server/services/badgeAssignmentService';
import { withApi, successResponse, ForbiddenError } from '@/lib/api';

const bodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  courseId: z.string().optional(),
  hackathonId: z.string().optional(),
  projectId: z.string().optional(),
  requirementId: z.string().optional(),
  badgesId: z.array(z.string()).optional(),
  consoleTrigger: z.enum(['console_log', 'faucet_claim', 'node_registration']).optional(),
  category: z.nativeEnum(BadgeCategory).optional(),
});

type AssignBody = z.infer<typeof bodySchema>;

export const POST = withApi<AssignBody>(
  async (_req, { session, body }) => {
    const requiredRole = badgeAssignmentService.getRequiredRoleForAssignment(body);
    const customAttributes: string[] = session.user?.custom_attributes ?? [];

    let hasAdminPermission = requiredRole ? customAttributes.includes(requiredRole) : false;

    // If badge_admin is required and user doesn't have it, check for devrel (super admin)
    if (requiredRole === 'badge_admin' && !hasAdminPermission) {
      hasAdminPermission = customAttributes.includes('devrel');
    }

    // Security check: Users can only assign badges to themselves unless they have admin role
    // - If no admin role required (academy/requirement badges): user must assign to self
    // - If admin role required (project badges): user must have the required role (badge_admin)
    if (requiredRole === null) {
      if (body.userId !== session.user?.id) {
        throw new ForbiddenError('You can only assign badges to yourself');
      }
    } else if (!hasAdminPermission) {
      throw new ForbiddenError(`Insufficient permissions. Required role: ${requiredRole}`);
    }

    const badge = await badgeAssignmentService.assignBadge(body, session.user?.name || undefined);

    return successResponse(badge);
  },
  { auth: true, schema: bodySchema },
);
