import type { Metadata } from 'next';
import { findCourseByPath, getAcademyCatalog, type CategoryItem } from '@/lib/flashcards/catalog';
import { DeckPicker } from '@/components/flashcards/deck-picker';
import type { SourceAnchor } from '@/lib/flashcards/types';

export const metadata: Metadata = {
  title: 'Flashcard Studio | Avalanche Academy',
  description:
    'Generate Anki-compatible flashcard decks from any Avalanche Academy chapter. Preview, edit, and download for offline study.',
};

// Reads searchParams (?source, ?title, ?kind) when the user arrives from the
// "Create Flashcards" button in the page-actions sidebar.
export const dynamic = 'force-dynamic';

interface StudioSearchParams {
  source?: string;
  title?: string;
  kind?: string;
}

function buildInitialSources(
  params: StudioSearchParams,
  catalog: CategoryItem[],
): SourceAnchor[] {
  const { source, title, kind } = params;
  if (!source || !title) return [];
  if (!source.startsWith('/')) return [];
  if (source.length > 500 || title.length > 200) return [];

  // Course-root URLs (e.g. `/academy/avalanche-l1/avalanche-fundamentals`)
  // expand to every chapter of that course, matching the user expectation
  // when clicking "Create Flashcards" from a course landing page.
  const courseMatch = findCourseByPath(catalog, source);
  if (courseMatch) {
    return courseMatch.course.chapters.map((chapter) => ({
      kind: 'academy' as const,
      path: chapter.path,
      chapterTitle: chapter.title,
    }));
  }

  const resolvedKind: SourceAnchor['kind'] = kind === 'docs' ? 'docs' : 'academy';
  return [
    {
      kind: resolvedKind,
      path: source,
      chapterTitle: title,
    },
  ];
}

export default async function FlashcardStudioPage({
  searchParams,
}: {
  searchParams: Promise<StudioSearchParams>;
}) {
  const [catalog, sp] = await Promise.all([
    getAcademyCatalog(),
    searchParams,
  ]);
  const initialSources = buildInitialSources(sp, catalog);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-10 space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
          Flashcard Studio · Beta
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Generate custom Anki decks from Academy
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Pick any combination of Academy chapters. Claude generates Q&amp;A, cloze,
          and code flashcards from the source content. Preview them on the next page,
          drop the ones you don&apos;t want, regenerate the weak ones, then download as
          an <code className="text-xs">.apkg</code> for Anki on desktop or mobile.
        </p>
      </header>

      <DeckPicker catalog={catalog} initialSources={initialSources} />
    </main>
  );
}
