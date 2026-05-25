/**
 * Resolves a fumadocs URL path to a flashcard set ID stored in
 * `components/flashcards/flashcardData.json`. Used by the Page Actions chooser
 * to decide whether to show "Use existing deck" or just "Generate Flashcards".
 *
 * Resolution rule: scan URL segments from deepest to shallowest under
 * `/academy/...`. For each segment, try (a) exact match against `flashcardSets`
 * keys, then (b) match after stripping a leading `NN-` numeric prefix. Return
 * the first hit. This handles:
 *  - existing entrepreneur sets anchored to numbered sections
 *    (URL `.../01-legal-foundations/09-flashcards` → setId `legal-foundations`)
 *  - future course-level pre-baked decks where setId = course slug
 *    (URL `/academy/blockchain/blockchain-fundamentals` → `blockchain-fundamentals`)
 */
import flashcardData from '@/components/flashcards/flashcardData.json';

// Read-only lookups against `flashcardData.json` for the Page Actions chooser
// and the play-page summary header. Intentionally avoids `lib/flashcards/legacy`
// because that module pulls in `node:crypto` — fine on the server, but it
// would break the client bundle that <SidebarActions> ships into.

interface RawFlashcardData {
  courses: Record<string, { title: string; flashcardSets: string[] }>;
  flashcardSets: Record<string, Array<{ term: string; definition: string; example?: string }>>;
}

const DATA = flashcardData as RawFlashcardData;

export interface ResolvedDeck {
  setId: string;
  title: string;
  cardCount: number;
  courseTitle: string | null;
}

function findCourseFor(setId: string): { key: string; title: string } | null {
  for (const [key, course] of Object.entries(DATA.courses)) {
    if (course.flashcardSets.includes(setId)) {
      return { key, title: course.title };
    }
  }
  return null;
}

function humanize(slug: string): string {
  return slug
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripNumericPrefix(segment: string): string {
  return segment.replace(/^\d+[-_]/, '');
}

function candidatesFromPath(coursePath: string): string[] {
  const trimmed = coursePath.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed.startsWith('academy/')) return [];
  const segments = trimmed.split('/').slice(1); // drop the "academy" prefix
  const out: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    out.push(seg);
    const stripped = stripNumericPrefix(seg);
    if (stripped !== seg) out.push(stripped);
  }
  return out;
}

/**
 * Returns the best existing flashcard set for the given fumadocs URL path,
 * or `null` if no curated deck exists yet.
 */
export function getExistingDeckForCoursePath(coursePath: string): ResolvedDeck | null {
  if (!coursePath || !coursePath.startsWith('/academy/')) return null;

  for (const candidate of candidatesFromPath(coursePath)) {
    const cards = DATA.flashcardSets[candidate];
    if (!cards || cards.length === 0) continue;
    const course = findCourseFor(candidate);
    return {
      setId: candidate,
      title: humanize(candidate),
      cardCount: cards.length,
      courseTitle: course?.title ?? null,
    };
  }
  return null;
}

/**
 * Display-side metadata for a known setId. Returns `null` if the set is not
 * in the static catalog.
 */
export function getDeckSummary(setId: string): ResolvedDeck | null {
  const cards = DATA.flashcardSets[setId];
  if (!cards || cards.length === 0) return null;
  const course = findCourseFor(setId);
  return {
    setId,
    title: humanize(setId),
    cardCount: cards.length,
    courseTitle: course?.title ?? null,
  };
}
