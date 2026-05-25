import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/authSession';
import {
  checkFlashcardsRateLimit,
  createFlashcardsRateLimitHeaders,
} from '@/lib/flashcards/rate-limit';
import { generateDeck } from '@/lib/flashcards/generate';
import { SourceAnchorSchema } from '@/lib/flashcards/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const RequestSchema = z.object({
  sources: z.array(SourceAnchorSchema).min(1).max(60),
  deckTitle: z.string().min(1).max(200).optional(),
  targetCardCount: z.number().int().min(5).max(60).optional(),
  audience: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: 'Sign in to generate flashcards' },
      { status: 401 },
    );
  }

  const rate = checkFlashcardsRateLimit('deck-generate', userId);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: 'Daily generation limit reached',
        message: `You can generate up to ${rate.limit} decks per day. Try again after ${rate.resetTime.toISOString()}.`,
        resetTime: rate.resetTime.toISOString(),
      },
      {
        status: 429,
        headers: createFlashcardsRateLimitHeaders(rate),
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = RequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        issues: parseResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { sources, deckTitle, targetCardCount, audience } = parseResult.data;
  const finalTitle =
    deckTitle ??
    (sources.length === 1
      ? `Avalanche Academy — ${sources[0].chapterTitle}`
      : `Avalanche Academy — Custom Deck (${sources.length} sources)`);

  try {
    const result = await generateDeck(sources, {
      deckTitle: finalTitle,
      targetCardCount,
      audience,
    });

    return NextResponse.json(
      {
        sessionId: randomUUID(),
        deck: result.deck,
        droppedDuplicateIds: result.droppedDuplicateIds,
        sourceTokens: result.totalSourceTokens,
      },
      { headers: createFlashcardsRateLimitHeaders(rate) },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[flashcards/generate] Failed:', error);
    return NextResponse.json(
      { error: 'Generation failed', message },
      { status: 500, headers: createFlashcardsRateLimitHeaders(rate) },
    );
  }
}
