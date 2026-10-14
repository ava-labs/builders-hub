import { nextStepSchema } from "@/types/studio";
import { nextAction } from "@/server/services/studio/deployments";
import { parseBody, studioRoute } from "../../../../../_lib/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = studioRoute<{ projectId: string; deploymentId: string }>(async ({ request, params, userId }) => {
  const { signer, confirmProduction } = await parseBody(request, nextStepSchema);
  return { action: await nextAction(userId, params.projectId, params.deploymentId, signer, { confirmProduction }) };
});
