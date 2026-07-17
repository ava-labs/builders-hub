import { createUnlinkAuthRoutes, getUnlinkServer } from '@/lib/unlink/admin';
import {
  backendFailure,
  forbidden,
  hasSameOrigin,
  safeSdkResponse,
  serviceUnavailable,
  withNoStore,
} from '@/lib/unlink/http';
import { createUnlinkSessionCookie } from '@/lib/unlink/session';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) return forbidden();

  const server = getUnlinkServer();
  if (!server) return serviceUnavailable();

  let registeredAddress: string | undefined;

  try {
    const routes = createUnlinkAuthRoutes<null>({
      admin: server.admin,
      authenticate: async () => null,
      authorizeUnlinkAddress: async () => false,
      onRegister: async ({ registration }) => {
        // Trust only the address returned by Engine, never one supplied by the browser.
        registeredAddress = registration.address;
      },
    });

    // Registration carries account viewing and nullifying material. Never log,
    // trace, or persist this request body in Builder Hub infrastructure.
    const response = await routes.register(request);
    if (!response.ok) return safeSdkResponse(response);
    if (!registeredAddress) return backendFailure();

    response.headers.append('Set-Cookie', createUnlinkSessionCookie(registeredAddress, server.sessionSecret));
    return withNoStore(response);
  } catch {
    return backendFailure();
  }
}
