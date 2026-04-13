import { withApi, successResponse } from '@/lib/api';
import { createGlacierJWT } from '@/lib/glacier-jwt';

const DATA_API_ENDPOINT = 'https://data-api.avax.network/v1';

export const GET = withApi(
  async (_req, { session }) => {
    const glacierJwt = await createGlacierJWT({
      sub: session.user.id,
      iss: 'https://build.avax.network/',
      email: session.user.email!,
    });

    return successResponse({ glacierJwt, endpoint: DATA_API_ENDPOINT });
  },
  { auth: true },
);
