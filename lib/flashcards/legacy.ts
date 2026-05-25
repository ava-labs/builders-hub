import { randomUUID } from 'node:crypto';
import {
  type Deck,
  type Flashcard,
  type LegacyFlashcardData,
  type LegacyFlashcardItem,
  type SourceAnchor,
  LegacyFlashcardDataSchema,
} from './types';

/**
 * Convert a single legacy flashcard entry (the `{term, definition, example?}` shape
 * stored in components/flashcards/flashcardData.json) into a rich Flashcard
 * suitable for `.apkg` packaging via buildApkg().
 */
export function fromLegacyItem(
  item: LegacyFlashcardItem,
  source: SourceAnchor,
): Flashcard {
  const back = item.example
    ? `${item.definition}\n\n*Example:* ${item.example}`
    : item.definition;
  return {
    id: randomUUID(),
    type: 'qa',
    front: item.term,
    back,
    source,
  };
}

/**
 * Find which "course" group a setId belongs to in the legacy data.
 * Returns null if the setId is not registered in `courses.*.flashcardSets`.
 */
export function findLegacyCourse(
  data: LegacyFlashcardData,
  setId: string,
): { key: string; title: string } | null {
  for (const [key, course] of Object.entries(data.courses)) {
    if (course.flashcardSets.includes(setId)) {
      return { key, title: course.title };
    }
  }
  return null;
}

function titleCase(setId: string): string {
  return setId
    .split('-')
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
}

/**
 * Build a Deck from a legacy flashcard set id. Pulls items out of the data file,
 * wraps each one with a SourceAnchor that points back to the conceptual chapter,
 * and assigns a deck title using the parent course's metadata.
 */
export function legacySetToDeck(
  data: LegacyFlashcardData,
  setId: string,
): Deck | null {
  const items = data.flashcardSets[setId];
  if (!items || items.length === 0) return null;

  const course = findLegacyCourse(data, setId);
  const chapterTitle = titleCase(setId);

  const source: SourceAnchor = {
    kind: 'academy',
    path: `/academy/flashcards/${setId}`,
    chapterTitle,
  };

  const cards = items.map((item) => fromLegacyItem(item, source));

  const deckTitle = course
    ? `Avalanche Academy — ${course.title}: ${chapterTitle}`
    : `Avalanche Academy — ${chapterTitle}`;

  return {
    id: setId,
    title: deckTitle,
    sources: [source],
    cards,
  };
}

/** Validate that an arbitrary JSON blob conforms to the legacy schema. */
export function parseLegacyData(raw: unknown): LegacyFlashcardData {
  return LegacyFlashcardDataSchema.parse(raw);
}
