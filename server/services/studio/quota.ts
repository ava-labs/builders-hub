import 'server-only';
import { prisma } from '@/prisma/prisma';
import { StudioError } from './errors';

/*
 * Studio inference runs on Builder Hub's key, so each builder gets a budget.
 * Counted from stored messages, which keeps the limit exact across
 * serverless instances without another table.
 */

const HOURLY_MESSAGES = Number(process.env.STUDIO_HOURLY_MESSAGES ?? 40);
const DAILY_TOKENS = Number(process.env.STUDIO_DAILY_TOKENS ?? 2_000_000);

export interface ChatUsage {
  /** Local development spends the developer's own key; the budget protects the shared one in deployed environments. */
  unlimited: boolean;
  hourly: { used: number; limit: number };
  daily: { used: number; limit: number };
}

export async function chatUsage(userId: string): Promise<ChatUsage> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const owned = { chat: { project: { user_id: userId } } };

  const [recent, usage] = await Promise.all([
    prisma.studioMessage.count({ where: { ...owned, role: 'user', created_at: { gte: hourAgo } } }),
    prisma.studioMessage.findMany({
      where: { ...owned, role: 'assistant', created_at: { gte: dayAgo } },
      select: { usage: true },
      take: 2_000,
    }),
  ]);
  const tokens = usage.reduce(
    (sum, m) => sum + Number((m.usage as { totalTokens?: number } | null)?.totalTokens ?? 0),
    0,
  );
  return {
    unlimited: process.env.NODE_ENV === 'development',
    hourly: { used: recent, limit: HOURLY_MESSAGES },
    daily: { used: tokens, limit: DAILY_TOKENS },
  };
}

export async function assertChatQuota(userId: string) {
  if (process.env.NODE_ENV === 'development') return;
  const { hourly, daily } = await chatUsage(userId);
  if (hourly.used >= hourly.limit) {
    throw new StudioError(
      429,
      `You've sent ${hourly.limit} messages in the last hour. Try again in a little while.`,
      'quota_hourly',
    );
  }
  if (daily.used >= daily.limit) {
    throw new StudioError(429, "You've used today's Studio budget. It resets over the next 24 hours.", 'quota_daily');
  }
}
