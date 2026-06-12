import type { Metadata } from 'next';
import { DeckLibrary } from '@/components/flashcards/library/deck-library';

// Library is per-browser (IndexedDB) — nothing for the server to render.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My flashcard decks | Avalanche Academy',
  description: 'Every flashcard deck you’ve saved on this browser.',
};

export default function FlashcardLibraryPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <DeckLibrary />
    </main>
  );
}
