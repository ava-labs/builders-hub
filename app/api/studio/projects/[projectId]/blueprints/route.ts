import { z } from "zod";
import { addBlueprint } from "@/server/services/studio/projects";
import { parseBody, studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";

const schema = z.object({ blueprintId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/) });

export const POST = studioRoute<{ projectId: string }>(async ({ request, params, userId }) => {
  const { blueprintId } = await parseBody(request, schema);
  return addBlueprint(userId, params.projectId, blueprintId);
});
