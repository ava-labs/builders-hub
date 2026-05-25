import type { Metadata } from 'next';
import { getAcademyCatalog } from '@/lib/flashcards/catalog';
import { DeckPicker } from '@/components/flashcards/deck-picker';

export const metadata: Metadata = {
  title: 'Flashcard Studio | Avalanche Academy',
  description:
    'Generate Anki-compatible flashcard decks from any Avalanche Academy chapter. Preview, edit, and download for offline study.',
};

// Catalog is read from disk on each request, but the module-level cache in
// catalog.ts means actual filesystem walking happens once per server process.
export const dynamic = 'force-static';

export default async function FlashcardStudioPage() {
  const catalog = await getAcademyCatalog();

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

      <DeckPicker catalog={catalog} />
    </main>
  );
}
