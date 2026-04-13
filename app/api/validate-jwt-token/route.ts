import { decode } from 'next-auth/jwt';
import { withApi, successResponse, AuthError, InternalError } from '@/lib/api';

const JWT_SECRET: string | undefined = process.env.NEXTAUTH_SECRET;

// withApi: auth intentionally omitted — pre-authentication endpoint
// schema: not applicable — token passed via Authorization header, not body
export const POST = withApi(async (req) => {
  if (!JWT_SECRET) {
    throw new InternalError('Token validation unavailable');
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new AuthError('Missing authorization header');
  }

  const decoded = (await decode({ token: authHeader, secret: JWT_SECRET })) ?? {};

  if (typeof decoded !== 'object' || decoded === null) {
    throw new AuthError('Invalid token payload');
  }

  const sub = (decoded as Record<string, unknown>).sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new AuthError('Token missing sub');
  }

  return successResponse({ valid: true, sub, payload: decoded });
});
