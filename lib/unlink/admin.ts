import { createUnlinkAdmin, createUnlinkAuthRoutes, type UnlinkAdmin } from '@unlink-xyz/sdk/admin';
import { UNLINK_SESSION_SECRET_MIN_LENGTH } from '@/lib/unlink/session';

const UNLINK_ENVIRONMENT = 'avalanche-fuji';

type CachedAdmin = {
  apiKey: string;
  admin: UnlinkAdmin;
};

export type UnlinkServer = {
  admin: UnlinkAdmin;
  sessionSecret: string;
};

let cachedAdmin: CachedAdmin | undefined;

/**
 * Returns the server-only Unlink dependencies when the deployment is
 * configured. The privileged admin client is created lazily and never
 * imported by the browser demo. UNLINK_DEMO_SESSION_SECRET must be generated
 * from at least 32 bytes of cryptographically secure random data.
 */
export function getUnlinkServer(): UnlinkServer | null {
  const apiKey = process.env.UNLINK_API_KEY?.trim();
  const sessionSecret = process.env.UNLINK_DEMO_SESSION_SECRET?.trim();

  if (!apiKey || !sessionSecret || sessionSecret.length < UNLINK_SESSION_SECRET_MIN_LENGTH) {
    return null;
  }

  if (!cachedAdmin || cachedAdmin.apiKey !== apiKey) {
    cachedAdmin = {
      apiKey,
      admin: createUnlinkAdmin({
        environment: UNLINK_ENVIRONMENT,
        apiKey,
      }),
    };
  }

  return { admin: cachedAdmin.admin, sessionSecret };
}

export { createUnlinkAuthRoutes };
