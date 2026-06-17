import type { Metadata } from 'next';
import { StudioPreview } from '@/components/flashcards/studio-preview';

export const metadata: Metadata = {
  title: 'Reviewing deck — Flashcard Studio | Avalanche Academy',
  description: 'Preview and edit your AI-generated flashcards before downloading.',
};

export default async function FlashcardSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <StudioPreview sessionId={sessionId} />
    </main>
  );
}
