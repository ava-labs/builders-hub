import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { getAuthSession } from './auth/authSession';

/**
 * Helper type for route handlers with params.
 * Usage: withAuth<RouteParams<{ id: string }>>(...)
 */
export type RouteParams<T extends Record<string, string>> = {
  params: Promise<T>;
};

export function withAuth<TContext = unknown>(
  handler: (request: NextRequest, context: TContext, session: Session) => Promise<NextResponse>
) {
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'Authentication required. Please log in to access this resource.' 
      }, { status: 401 });
    }
    return handler(request, context, session); 
  };
}
export function withAuthRole<TContext = unknown>(
  role: string | string[],
  handler: (request: NextRequest, context: TContext, session: Session) => Promise<NextResponse>
) {
  // Accept either a single role string (legacy) or a list of acceptable roles.
  // The user only needs ONE of the listed attributes to pass the gate.
  const allowed = Array.isArray(role) ? role : [role];
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();

    // Check if user is authenticated
    if (!session) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in to access this resource.'
      }, { status: 401 });
    }

    // Check if user has any of the required roles
    const attrs = session?.user.custom_attributes ?? [];
    const hasRole = allowed.some((r) => attrs.includes(r));
    if (!hasRole) {
      return NextResponse.json({
        error: 'Forbidden',
        message: `Access denied.`,
        requiredRole: allowed.length === 1 ? allowed[0] : allowed,
      }, { status: 403 });
    }

    return handler(request, context, session);
  };
}
