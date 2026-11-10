import { acknowledgeSchema } from "@/types/studio";
import { acknowledgeFinding } from "@/server/services/studio/builds";
import { parseBody, studioRoute } from "../../../../../_lib/route";

export const runtime = "nodejs";

export const POST = studioRoute<{ projectId: string; auditId: string }>(async ({ request, params, userId }) => {
  const { fingerprint, reason } = await parseBody(request, acknowledgeSchema);
  return { audit: await acknowledgeFinding(userId, params.projectId, params.auditId, fingerprint, reason) };
});
