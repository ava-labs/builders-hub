import { randomUUID } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  DeckSchema,
  GeneratedDeckSchema,
  FlashcardSchema,
  type Deck,
  type Flashcard,
  type GeneratedCard,
  type SourceAnchor,
} from './types';
import { loadSources, estimateTokens, type LoadedSource } from './source-loader';
import { buildFullDeckPrompt, buildSingleCardPrompt } from './prompt';
import { dedupeFlashcards } from './dedupe';

const FLASHCARD_MODEL = 'claude-sonnet-4-6';

export interface GenerateDeckOptions {
  deckTitle: string;
  targetCardCount?: number;
  audience?: string;
  /** When true, skip embedding-based dedupe (used in offline tests). */
  skipDedupe?: boolean;
}

export interface GenerateDeckResult {
  deck: Deck;
  droppedDuplicateIds: string[];
  totalSourceTokens: number;
}

function buildAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return createAnthropic({ apiKey });
}

function attachSources(
  generated: GeneratedCard[],
  sources: SourceAnchor[],
): Flashcard[] {
  if (sources.length === 0) {
    throw new Error('Cannot attach cards: source list is empty');
  }
  return generated.map((g, index) => {
    const source = sources[index % sources.length];
    const card: Flashcard = {
      id: randomUUID(),
      type: g.type,
      front: g.front,
      back: g.back,
      language: g.language,
      source,
    };
    return FlashcardSchema.parse(card);
  });
}

export async function generateDeck(
  sourceAnchors: SourceAnchor[],
  opts: GenerateDeckOptions,
): Promise<GenerateDeckResult> {
  if (sourceAnchors.length === 0) {
    throw new Error('At least one source is required');
  }

  const loaded = await loadSources(sourceAnchors);
  const totalSourceTokens = loaded.reduce(
    (sum, s) => sum + estimateTokens(s.markdown),
    0,
  );

  const targetCardCount = Math.min(Math.max(opts.targetCardCount ?? 25, 5), 60);

  const { system, user } = buildFullDeckPrompt(loaded, {
    deckTitle: opts.deckTitle,
    targetCardCount,
    audience: opts.audience,
  });

  const anthropic = buildAnthropicClient();
  const result = await generateObject({
    model: anthropic(FLASHCARD_MODEL),
    schema: GeneratedDeckSchema,
    system,
    prompt: user,
  });

  const cards = attachSources(result.object.cards, sourceAnchors);

  let kept = cards;
  let droppedIds: string[] = [];
  if (!opts.skipDedupe) {
    const deduped = await dedupeFlashcards(cards);
    kept = deduped.kept;
    droppedIds = deduped.droppedIds;
  }

  const deck: Deck = DeckSchema.parse({
    id: randomUUID(),
    title: opts.deckTitle,
    sources: sourceAnchors,
    cards: kept,
  });

  return {
    deck,
    droppedDuplicateIds: droppedIds,
    totalSourceTokens,
  };
}

export interface RegenerateCardOptions {
  rejectedCard: Flashcard;
  existingDeck: Flashcard[];
  reason?: string;
}

export async function regenerateCard(
  opts: RegenerateCardOptions,
): Promise<Flashcard> {
  const sourceAnchors: SourceAnchor[] = [opts.rejectedCard.source];
  const loaded = await loadSources(sourceAnchors);

  const { system, user } = buildSingleCardPrompt(
    loaded,
    opts.existingDeck,
    opts.rejectedCard,
    opts.reason,
  );

  const anthropic = buildAnthropicClient();
  const result = await generateObject({
    model: anthropic(FLASHCARD_MODEL),
    schema: GeneratedDeckSchema,
    system,
    prompt: user,
  });

  const generated = result.object.cards[0];
  if (!generated) {
    throw new Error('LLM did not return a replacement card');
  }

  const card: Flashcard = FlashcardSchema.parse({
    id: randomUUID(),
    type: generated.type ?? opts.rejectedCard.type,
    front: generated.front,
    back: generated.back,
    language: generated.language ?? opts.rejectedCard.language,
    source: opts.rejectedCard.source,
  });

  return card;
}

export type { LoadedSource };
