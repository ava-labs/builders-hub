import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from './auth/authSession';


export function withAuth(handler: (request: NextRequest, context: any, session: any) => Promise<NextResponse>) {
  return async function (request: NextRequest, context: any) {
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
export function withAuthRole(role: string, handler: (request: NextRequest, context: any, session: any) => Promise<NextResponse>) {
  return async function (request: NextRequest, context: any) {
    const session = await getAuthSession();
    
    // Check if user is authenticated
    if (!session) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'Authentication required. Please log in to access this resource.' 
      }, { status: 401 });
    }
    
    // Check if user has the required role
    let hasRole = session?.user.custom_attributes?.includes(role) ?? false;
    if ((role === "badge_admin" || role === "showcase") && !hasRole) {
      hasRole = session?.user.custom_attributes?.includes("devrel") ?? false;
    }
    if (!hasRole) {
      return NextResponse.json({ 
        error: 'Forbidden', 
        message: `Access denied. This action requires the '${role}' role.`,
        requiredRole: role
      }, { status: 403 });
    }

    return handler(request, context, session);
  };
}
