'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudioStore } from '@/lib/flashcards/store';
import type { Flashcard } from '@/lib/flashcards/types';
import { StudioCard } from './studio-card';

interface StudioPreviewProps {
  sessionId: string;
}

export function StudioPreview({ sessionId }: StudioPreviewProps) {
  const router = useRouter();
  const deck = useStudioStore((s) => s.deck);
  const storeSessionId = useStudioStore((s) => s.sessionId);
  const rejectedIds = useStudioStore((s) => s.rejectedIds);
  const regeneratingIds = useStudioStore((s) => s.regeneratingIds);
  const rejectCard = useStudioStore((s) => s.rejectCard);
  const acceptCard = useStudioStore((s) => s.acceptCard);
  const replaceCard = useStudioStore((s) => s.replaceCard);
  const startRegenerating = useStudioStore((s) => s.startRegenerating);
  const endRegenerating = useStudioStore((s) => s.endRegenerating);
  const reset = useStudioStore((s) => s.reset);

  const [hydrated, setHydrated] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (storeSessionId !== sessionId) {
      router.replace('/academy/flashcards');
    }
  }, [hydrated, storeSessionId, sessionId, router]);

  const kept = useMemo(
    () => (deck ? deck.cards.filter((c) => !rejectedIds.includes(c.id)) : []),
    [deck, rejectedIds],
  );

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deck || storeSessionId !== sessionId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Session not found — taking you back to the picker.</p>
      </div>
    );
  }

  const onRegenerate = async (card: Flashcard) => {
    startRegenerating(card.id);
    try {
      const res = await fetch('/api/flashcards/regenerate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectedCard: card,
          existingDeck: kept,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(detail.message ?? detail.error ?? `Failed: ${res.status}`);
      }
      const data = (await res.json()) as { card: Flashcard };
      replaceCard(card.id, data.card);
    } catch (error) {
      console.error('Card regenerate failed', error);
    } finally {
      endRegenerating(card.id);
    }
  };

  const onDownload = async () => {
    setDownloadError(null);
    if (kept.length === 0) {
      setDownloadError('Keep at least one card before downloading.');
      return;
    }
    setDownloading(true);
    try {
      const downloadDeck = {
        ...deck,
        cards: kept,
      };
      const res = await fetch('/api/flashcards/studio-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(downloadDeck),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(detail.message ?? detail.error ?? `Failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename="(.+?)"/)?.[1] ?? `${deck.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.apkg`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Download failed';
      setDownloadError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const onStartOver = () => {
    reset();
    router.push('/academy/flashcards');
  };

  return (
    <div className="space-y-6 pb-32">
      <header className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onStartOver}
          className="-ml-2 text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          New deck
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{deck.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {kept.length} kept · {rejectedIds.length} rejected · {deck.cards.length} total ·
            generated from {deck.sources.length} source{deck.sources.length === 1 ? '' : 's'}.
          </p>
        </div>
      </header>

      {deck.cards.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          The model returned no cards — try a different source mix.
        </div>
      ) : (
        <div className="grid gap-4">
          {deck.cards.map((card) => (
            <StudioCard
              key={card.id}
              card={card}
              isRejected={rejectedIds.includes(card.id)}
              isRegenerating={regeneratingIds.includes(card.id)}
              onAccept={() => acceptCard(card.id)}
              onReject={() => rejectCard(card.id)}
              onRegenerate={() => onRegenerate(card)}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="text-sm text-muted-foreground">
            {kept.length} card{kept.length === 1 ? '' : 's'} ready for download
            {downloadError && (
              <span className="ml-3 text-red-600 dark:text-red-400">· {downloadError}</span>
            )}
          </div>
          <Button onClick={onDownload} disabled={downloading || kept.length === 0}>
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building .apkg...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download for Anki
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
