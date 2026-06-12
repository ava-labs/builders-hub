import { z } from 'zod';

export type CardType = 'qa' | 'cloze' | 'code';

export const CardTypeSchema = z.enum(['qa', 'cloze', 'code']);

export type SourceKind = 'academy' | 'docs';

export const SourceKindSchema = z.enum(['academy', 'docs']);

/**
 * Anchor pointing back to the chapter or doc page a card was generated from.
 * `path` is the URL-relative path used by fumadocs (e.g. `/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications`).
 */
export const SourceAnchorSchema = z.object({
  kind: SourceKindSchema,
  path: z.string().min(1),
  chapterTitle: z.string().min(1),
});

export type SourceAnchor = z.infer<typeof SourceAnchorSchema>;

/**
 * Rich flashcard format used by the studio + .apkg export.
 * Cloze front uses `[[...]]` markers around the elided term(s).
 */
export const FlashcardSchema = z.object({
  id: z.string().min(1),
  type: CardTypeSchema,
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(4000),
  language: z.string().max(40).optional(),
  source: SourceAnchorSchema,
});

export type Flashcard = z.infer<typeof FlashcardSchema>;

export const DeckSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  sources: z.array(SourceAnchorSchema).min(1).max(50),
  cards: z.array(FlashcardSchema).min(1).max(80),
});

export type Deck = z.infer<typeof DeckSchema>;

/**
 * Legacy entry shape consumed by `<Flashcard />` (components/flashcards/flashcard.tsx).
 * Keep stable — modifying breaks the existing in-app flashcards.
 */
export const LegacyFlashcardItemSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  example: z.string().optional(),
});

export type LegacyFlashcardItem = z.infer<typeof LegacyFlashcardItemSchema>;

export const LegacyFlashcardDataSchema = z.object({
  courses: z.record(
    z.string(),
    z.object({
      title: z.string(),
      flashcardSets: z.array(z.string()),
    }),
  ),
  flashcardSets: z.record(z.string(), z.array(LegacyFlashcardItemSchema)),
});

export type LegacyFlashcardData = z.infer<typeof LegacyFlashcardDataSchema>;

/**
 * LLM output schema. The model produces this; we then assign ids + sources + dedupe.
 * Kept narrower than `FlashcardSchema` so prompt drift doesn't break id/source contracts.
 */
export const GeneratedCardSchema = z.object({
  type: CardTypeSchema,
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(4000),
  language: z.string().max(40).optional(),
});

export type GeneratedCard = z.infer<typeof GeneratedCardSchema>;

export const GeneratedDeckSchema = z.object({
  cards: z.array(GeneratedCardSchema).min(1).max(80),
});

export type GeneratedDeck = z.infer<typeof GeneratedDeckSchema>;

/**
 * Project a rich Flashcard to the legacy term/definition/example shape used in-app.
 * Cloze front is stringified by stripping `[[...]]` markers and exposing the answer in the definition.
 */
export function toLegacyItem(card: Flashcard): LegacyFlashcardItem {
  if (card.type === 'cloze') {
    return {
      term: card.front.replace(/\[\[(.+?)\]\]/g, '_____'),
      definition: card.back,
      example: card.front.replace(/\[\[(.+?)\]\]/g, '$1'),
    };
  }
  if (card.type === 'code') {
    return {
      term: card.front,
      definition: card.back,
    };
  }
  return {
    term: card.front,
    definition: card.back,
  };
}
