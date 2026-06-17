import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlayDeck } from '@/components/flashcards/play/play-deck';

// Saved user decks live in IndexedDB on the client — the server has no way
// to look them up, so this is a thin shell that renders the play UI and lets
// the client component hydrate from IDB. Must be dynamic for the same reason
// as the `[setId]` route (no static params can be enumerated at build time).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My deck · Flashcards | Avalanche Academy',
  description: 'In-app spaced-repetition flashcards. Press Space to reveal, 1/2/3 to rate.',
};

interface PageProps {
  params: Promise<{ deckId: string }>;
}

export default async function UserPlayPage({ params }: PageProps) {
  const { deckId } = await params;
  if (!deckId || deckId.length > 80) notFound();

  // The PlayDeck component still uses `user:<id>` internally so its IDB
  // rating namespace (keyed by `setId:cardIndex`) stays consistent for users
  // who already have progress on a saved deck.
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <PlayDeck setId={`user:${deckId}`} title="My deck" courseTitle={null} items={[]} />
    </main>
  );
}
