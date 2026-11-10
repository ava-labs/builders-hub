import { frontendContext } from '@/server/services/studio/frontend';
import { studioRoute } from '../../../_lib/route';

export const runtime = 'nodejs';

/** What the Preview tab runs: the frontend/ files plus the deployed contracts and chains it injects as window.studio. */
export const GET = studioRoute<{ projectId: string }>(async ({ params, userId }) =>
  frontendContext(userId, params.projectId),
);
