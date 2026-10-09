import { randomUUID } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { projectPrompt, staticPrompt } from '@/server/services/studio/agent/context';
import { studioTools } from '@/server/services/studio/agent/tools';
import { StudioError } from '@/server/services/studio/errors';
import { getOwnedProject } from '@/server/services/studio/projects';
import { assertChatQuota } from '@/server/services/studio/quota';
import { errorResponse } from '../_lib/route';

export const runtime = 'nodejs';
// Compiles and audits run inside tool calls, and one turn may chain many of them.
export const maxDuration = 300;

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.STUDIO_MODEL ?? 'claude-sonnet-5';
const MAX_STEPS = 30;
// The provider only knows output limits for the models it lists and falls back to 4096 for others, which the
// model's reasoning alone can use up before any reply text. Set explicitly so a step always has room to answer.
const MAX_OUTPUT_TOKENS = Number(process.env.STUDIO_MAX_OUTPUT_TOKENS ?? 32_000);

/** The browser sends only the new user message; history comes from the database, so it cannot be rewritten client-side. */
const bodySchema = z.object({
  projectId: z.string().uuid(),
  chatId: z.string().uuid(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal('user'),
    parts: z
      .array(z.object({ type: z.literal('text'), text: z.string().min(1).max(12_000) }))
      .min(1)
      .max(8),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const userId = session?.user?.id;
    if (!userId) throw new StudioError(401, 'Sign in to use Studio', 'unauthenticated');

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StudioError(400, 'Send projectId, chatId and one user message');
    const { projectId, chatId, message } = parsed.data;

    const project = await getOwnedProject(userId, projectId);
    const chat = await prisma.studioChat.findFirst({ where: { id: chatId, project_id: project.id } });
    if (!chat) throw new StudioError(404, 'Chat not found');
    await assertChatQuota(userId);

    const stored = await prisma.studioMessage.findMany({ where: { chat_id: chat.id }, orderBy: { created_at: 'asc' } });
    const history: UIMessage[] = stored.map((m) => ({
      id: m.id,
      role: m.role as UIMessage['role'],
      parts: m.parts as UIMessage['parts'],
    }));
    await prisma.studioMessage.upsert({
      where: { chat_id_id: { chat_id: chat.id, id: message.id } },
      create: { chat_id: chat.id, id: message.id, role: 'user', parts: message.parts },
      update: {},
    });
    const messages: UIMessage[] = [...history.filter((m) => m.id !== message.id), message];

    if (chat.title === 'New chat') {
      const title = message.parts
        .map((p) => p.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      if (title) await prisma.studioChat.update({ where: { id: chat.id }, data: { title } });
    }

    const tools = studioTools(userId, project.id);
    const result = streamText({
      model: anthropic(MODEL),
      messages: [
        {
          role: 'system',
          content: staticPrompt(),
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        },
        { role: 'system', content: await projectPrompt(userId, project.id) },
        ...(await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true })),
      ],
      tools,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      stopWhen: stepCountIs(MAX_STEPS),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: randomUUID,
      onFinish: async ({ responseMessage }) => {
        const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
        await prisma.studioMessage.upsert({
          where: { chat_id_id: { chat_id: chat.id, id: responseMessage.id } },
          create: {
            chat_id: chat.id,
            id: responseMessage.id,
            role: 'assistant',
            parts: responseMessage.parts as object,
            usage: usage
              ? {
                  inputTokens: usage.inputTokens ?? 0,
                  outputTokens: usage.outputTokens ?? 0,
                  totalTokens: usage.totalTokens ?? 0,
                }
              : undefined,
          },
          update: { parts: responseMessage.parts as object },
        });
        await prisma.studioChat.update({ where: { id: chat.id }, data: { updated_at: new Date() } });
      },
      onError: (error) => {
        console.error('[studio chat]', error);
        return 'The agent hit an error. Try again, or rephrase the request.';
      },
    });
  } catch (error) {
    if (error instanceof StudioError || error instanceof Error) return errorResponse(error);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
