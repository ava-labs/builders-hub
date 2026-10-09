import { panelReadSchema } from "@/types/studio";
import { panelRead } from "@/server/services/studio/deployments";
import { parseBody, studioRoute } from "../../../../../_lib/route";

export const runtime = "nodejs";

export const POST = studioRoute<{ projectId: string; deploymentId: string }>(async ({ request, params, userId }) =>
  panelRead(userId, params.projectId, params.deploymentId, await parseBody(request, panelReadSchema)),
);
