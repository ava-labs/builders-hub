import { registerDeploymentNodes } from '@/server/services/studio/deployments';
import { studioRoute } from '../../../../../_lib/route';

export const runtime = 'nodejs';

export const POST = studioRoute<{ projectId: string; deploymentId: string }>(async ({ params, userId }) =>
  registerDeploymentNodes(userId, params.projectId, params.deploymentId),
);
