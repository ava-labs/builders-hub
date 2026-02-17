import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from './auth/authSession';


export function withAuth(handler: (request: NextRequest, context: any, session: any) => Promise<NextResponse>) {
  return async function (request: NextRequest, context: any) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }
    return handler(request, context, session); 
  };
}
export function withAuthRole(role: string, handler: (request: NextRequest, context: any, session: any) => Promise<NextResponse>) {
  return async function (request: NextRequest, context: any) {
    const session = await getAuthSession();

    // Check if user has the required role
    let hasRole = session?.user.custom_attributes?.includes(role) ?? false;

    // If badge_admin or showcase is required, also allow devrel (super admin)
    if ((role === "badge_admin" || role === "showcase") && !hasRole) {
      hasRole = session?.user.custom_attributes?.includes("devrel") ?? false;
    }

    if (!session || !hasRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }

    return handler(request, context, session);
  };
}
