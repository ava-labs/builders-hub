import { createUnlinkAuthRoutes, getUnlinkServer } from '@/lib/unlink/admin';
import {
  backendFailure,
  forbidden,
  hasSameOrigin,
  safeSdkResponse,
  serviceUnavailable,
  unauthorized,
} from '@/lib/unlink/http';
import { readUnlinkSession } from '@/lib/unlink/session';

export const runtime = 'nodejs';

const CAPABILITY_TOKEN_TTL_SECONDS = 15 * 60;

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) return forbidden();

  const server = getUnlinkServer();
  if (!server) return serviceUnavailable();

  const session = readUnlinkSession(request, server.sessionSecret);
  if (!session) return unauthorized();

  try {
    const routes = createUnlinkAuthRoutes({
      admin: server.admin,
      authenticate: async () => session,
      authorizeUnlinkAddress: async ({ unlinkAddress }) => unlinkAddress === session.unlinkAddress,
      expiresInSeconds: CAPABILITY_TOKEN_TTL_SECONDS,
    });

    return safeSdkResponse(await routes.authorizationToken(request));
  } catch {
    return backendFailure();
  }
}
