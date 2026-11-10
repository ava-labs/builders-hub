import { createChatSchema } from "@/types/studio";
import { prisma } from "@/prisma/prisma";
import { StudioError } from "@/server/services/studio/errors";
import { getOwnedProject } from "@/server/services/studio/projects";
import { parseBody, studioRoute } from "../../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string; chatId: string };

async function ownedChat(userId: string, projectId: string, chatId: string) {
  const project = await getOwnedProject(userId, projectId);
  const chat = await prisma.studioChat.findFirst({ where: { id: chatId, project_id: project.id } });
  if (!chat) throw new StudioError(404, "Chat not found");
  return chat;
}

export const GET = studioRoute<Params>(async ({ params, userId }) => {
  const chat = await ownedChat(userId, params.projectId, params.chatId);
  const messages = await prisma.studioMessage.findMany({ where: { chat_id: chat.id }, orderBy: { created_at: "asc" } });
  return { chat: { id: chat.id, title: chat.title }, messages: messages.map((m) => ({ id: m.id, role: m.role, parts: m.parts })) };
});

export const PATCH = studioRoute<Params>(async ({ request, params, userId }) => {
  const chat = await ownedChat(userId, params.projectId, params.chatId);
  const { title } = await parseBody(request, createChatSchema);
  return { chat: await prisma.studioChat.update({ where: { id: chat.id }, data: { title: title ?? chat.title } }) };
});

export const DELETE = studioRoute<Params>(async ({ params, userId }) => {
  const chat = await ownedChat(userId, params.projectId, params.chatId);
  await prisma.studioChat.delete({ where: { id: chat.id } });
  return { ok: true };
});
