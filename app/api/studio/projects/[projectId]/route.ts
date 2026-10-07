import { updateProjectSchema } from "@/types/studio";
import { archiveProject, projectOverview, updateProject } from "@/server/services/studio/projects";
import { parseBody, studioRoute } from "../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string };

export const GET = studioRoute<Params>(async ({ params, userId }) => projectOverview(userId, params.projectId));

export const PATCH = studioRoute<Params>(async ({ request, params, userId }) => ({
  project: await updateProject(userId, params.projectId, await parseBody(request, updateProjectSchema)),
}));

export const DELETE = studioRoute<Params>(async ({ params, userId }) => {
  await archiveProject(userId, params.projectId);
  return { ok: true };
});
