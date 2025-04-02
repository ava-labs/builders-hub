import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from './auth/authSession';


export function withAuth(handler: (request: NextRequest, session: any) => Promise<NextResponse>) {
  return async function (request: NextRequest) {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }

    return handler(request, session);
  };
}
