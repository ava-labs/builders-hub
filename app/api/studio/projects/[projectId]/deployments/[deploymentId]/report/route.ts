import { reportStepSchema } from "@/types/studio";
import { reportStep, viewOf } from "@/server/services/studio/deployments";
import { parseBody, studioRoute } from "../../../../../_lib/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = studioRoute<{ projectId: string; deploymentId: string }>(async ({ request, params, userId }) => {
  const { status, deployment } = await reportStep(userId, params.projectId, params.deploymentId, await parseBody(request, reportStepSchema));
  return { status, deployment: viewOf(deployment) };
});
