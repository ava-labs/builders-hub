import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import flashcardData from '@/components/flashcards/flashcardData.json';
import { parseLegacyData } from '@/lib/flashcards/legacy';
import { getDeckSummary } from '@/lib/flashcards/deck-resolver';
import { PlayDeck } from '@/components/flashcards/play/play-deck';

// Must be dynamic: `[setId]` accepts both curated ids from flashcardData.json
// and arbitrary `user:<uuid>` ids saved per-browser in IndexedDB. We can't
// enumerate those at build time, so force-static would 404 every request in
// production (see v2.2 plan).
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ setId: string }>;
}

function isUserDeckId(setId: string): boolean {
  return setId.startsWith('user:');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { setId } = await params;
  if (isUserDeckId(setId)) {
    return {
      title: 'My deck · Flashcards | Avalanche Academy',
      description: 'In-app spaced-repetition flashcards. Press Space to reveal, 1/2/3 to rate.',
    };
  }
  const summary = getDeckSummary(setId);
  const title = summary?.title ?? 'Flashcards';
  return {
    title: `${title} · Flashcards | Avalanche Academy`,
    description: 'In-app spaced-repetition flashcards. Press Space to reveal, 1/2/3 to rate.',
  };
}

export default async function PlayPage({ params }: PageProps) {
  const { setId } = await params;
  if (!setId || setId.length > 120) notFound();

  // User-saved decks live in IndexedDB on the client — the server has no way
  // to hydrate them, so just render the client shell with no initial items.
  if (isUserDeckId(setId)) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <PlayDeck setId={setId} title="My deck" courseTitle={null} items={[]} />
      </main>
    );
  }

  const data = parseLegacyData(flashcardData);
  const items = data.flashcardSets[setId];
  if (!items || items.length === 0) notFound();

  const summary = getDeckSummary(setId);
  const title = summary?.title ?? setId;
  const courseTitle = summary?.courseTitle ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <PlayDeck setId={setId} title={title} courseTitle={courseTitle} items={items} />
    </main>
  );
}
