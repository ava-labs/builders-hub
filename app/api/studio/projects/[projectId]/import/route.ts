import { importProjectSchema } from '@/types/studio';
import { importProject } from '@/server/services/studio/imports';
import { parseBody, studioRoute } from '../../../_lib/route';

export const runtime = 'nodejs';

type Params = { projectId: string };

/** Imports an existing Solidity project the browser read from a folder or a zip. */
export const POST = studioRoute<Params>(async ({ request, params, userId }) =>
  importProject(userId, params.projectId, await parseBody(request, importProjectSchema)),
);
