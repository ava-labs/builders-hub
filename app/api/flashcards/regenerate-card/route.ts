import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/authSession';
import {
  checkFlashcardsRateLimit,
  createFlashcardsRateLimitHeaders,
} from '@/lib/flashcards/rate-limit';
import { regenerateCard } from '@/lib/flashcards/generate';
import { sanitizeFlashcardError } from '@/lib/flashcards/errors';
import { FlashcardSchema } from '@/lib/flashcards/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  rejectedCard: FlashcardSchema,
  existingDeck: z.array(FlashcardSchema).max(80),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: 'Sign in to regenerate cards' },
      { status: 401 },
    );
  }

  const rate = checkFlashcardsRateLimit('card-regenerate', userId);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: 'Hourly regenerate limit reached',
        message: `Up to ${rate.limit} card regenerations per hour. Try again after ${rate.resetTime.toISOString()}.`,
        resetTime: rate.resetTime.toISOString(),
      },
      { status: 429, headers: createFlashcardsRateLimitHeaders(rate) },
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
      { error: 'Invalid request', issues: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { rejectedCard, existingDeck, reason } = parseResult.data;

  try {
    const replacement = await regenerateCard({
      rejectedCard,
      existingDeck,
      reason,
    });
    return NextResponse.json(
      { card: replacement },
      { headers: createFlashcardsRateLimitHeaders(rate) },
    );
  } catch (error) {
    console.error('[flashcards/regenerate-card] Failed:', error);
    const sanitized = sanitizeFlashcardError(error);
    return NextResponse.json(sanitized.body, {
      status: sanitized.status,
      headers: createFlashcardsRateLimitHeaders(rate),
    });
  }
}
