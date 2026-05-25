import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import flashcardData from '@/components/flashcards/flashcardData.json';
import { parseLegacyData } from '@/lib/flashcards/legacy';
import { getDeckSummary } from '@/lib/flashcards/deck-resolver';
import { PlayDeck } from '@/components/flashcards/play/play-deck';

export const dynamic = 'force-static';

interface PageProps {
  params: Promise<{ setId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { setId } = await params;
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
