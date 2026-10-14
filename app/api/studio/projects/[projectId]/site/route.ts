import { z } from 'zod';
import { publishSite, siteStatus, unpublishSite } from '@/server/services/studio/sites';
import { parseBody, studioRoute } from '../../../_lib/route';

export const runtime = 'nodejs';

type Params = { projectId: string };

export const GET = studioRoute<Params>(async ({ params, userId }) => siteStatus(userId, params.projectId));

/** Publishes, or republishes, the project's frontend/ as it is now. */
export const POST = studioRoute<Params>(async ({ request, params, userId }) => {
  const { slug, owner } = await parseBody(
    request,
    z.object({ slug: z.string().max(40).optional(), owner: z.string().max(40).optional() }),
  );
  return publishSite(userId, params.projectId, { slug, owner });
});

export const DELETE = studioRoute<Params>(async ({ params, userId }) => unpublishSite(userId, params.projectId));
