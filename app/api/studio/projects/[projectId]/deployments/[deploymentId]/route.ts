import { cancelDeployment, deploymentView } from "@/server/services/studio/deployments";
import { studioRoute } from "../../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string; deploymentId: string };

export const GET = studioRoute<Params>(async ({ params, userId }) => ({
  deployment: await deploymentView(userId, params.projectId, params.deploymentId),
}));

export const DELETE = studioRoute<Params>(async ({ params, userId }) => {
  await cancelDeployment(userId, params.projectId, params.deploymentId);
  return { ok: true };
});
