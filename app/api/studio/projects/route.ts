import { createProjectSchema } from "@/types/studio";
import { createProject, listProjects } from "@/server/services/studio/projects";
import { parseBody, studioRoute } from "../_lib/route";

export const runtime = "nodejs";

export const GET = studioRoute(async ({ userId }) => ({ projects: await listProjects(userId) }));

export const POST = studioRoute(async ({ request, userId }) => {
  const project = await createProject(userId, await parseBody(request, createProjectSchema));
  return { project: { id: project.id, name: project.name }, chatId: project.chats[0]?.id ?? null };
});
