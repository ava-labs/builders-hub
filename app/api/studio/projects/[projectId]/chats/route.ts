import { createChatSchema } from "@/types/studio";
import { prisma } from "@/prisma/prisma";
import { getOwnedProject } from "@/server/services/studio/projects";
import { parseBody, studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string };

export const GET = studioRoute<Params>(async ({ params, userId }) => {
  const project = await getOwnedProject(userId, params.projectId);
  return {
    chats: await prisma.studioChat.findMany({
      where: { project_id: project.id },
      orderBy: { updated_at: "desc" },
      select: { id: true, title: true, updated_at: true, _count: { select: { messages: true } } },
    }),
  };
});

export const POST = studioRoute<Params>(async ({ request, params, userId }) => {
  const project = await getOwnedProject(userId, params.projectId);
  const { title } = await parseBody(request, createChatSchema);
  const chat = await prisma.studioChat.create({ data: { project_id: project.id, title: title ?? "New chat" } });
  return { chat: { id: chat.id, title: chat.title } };
});
