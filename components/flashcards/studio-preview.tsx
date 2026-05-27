'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  AlertCircle,
  Library,
  Loader2,
  Save,
  Check,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudioStore } from '@/lib/flashcards/store';
import { toLegacyItem, type Flashcard } from '@/lib/flashcards/types';
import { courseRootFromPath } from '@/lib/flashcards/course-path';
import { saveUserDeck, type UserFlashcardDeck } from '@/utils/quizzes/indexedDB';
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
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      <div
        className="flex flex-col items-center justify-center gap-3 py-24"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Preparing your flashcard studio…
        </p>
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

  const onReject = (card: Flashcard) => {
    rejectCard(card.id);
    const previewLabel = card.front
      .replace(/\[\[(.+?)\]\]/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    toast('Card rejected', {
      description: previewLabel || undefined,
      action: {
        label: 'Undo',
        onClick: () => acceptCard(card.id),
      },
      duration: 5000,
    });
  };

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

  const openSaveForm = () => {
    setSaveName(deck.title);
    setSaveError(null);
    setSavedDeckId(null);
    setShowSaveForm(true);
  };

  const onSave = async () => {
    setSaveError(null);
    if (kept.length === 0) {
      setSaveError('Keep at least one card before saving.');
      return;
    }
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError('Give the deck a name.');
      return;
    }
    setSaving(true);
    try {
      const id = `01${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      const coursePath = deck.sources[0]?.path
        ? courseRootFromPath(deck.sources[0].path)
        : null;
      const userDeck: UserFlashcardDeck = {
        id,
        name: trimmed,
        coursePath,
        items: kept.map((c) => toLegacyItem(c)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveUserDeck(userDeck);
      setSavedDeckId(id);
      setShowSaveForm(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
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

      {savedDeckId && !showSaveForm && (
        <div
          className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              aria-hidden
            >
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                Saved to your library
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Study now or return to this deck any time from your library.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button
              size="sm"
              onClick={() =>
                router.push(`/academy/flashcards/play/user/${savedDeckId}`)
              }
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Study now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/academy/flashcards/library')}
            >
              <Library className="mr-1.5 h-3.5 w-3.5" />
              View library
            </Button>
          </div>
        </div>
      )}

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
              onReject={() => onReject(card)}
              onRegenerate={() => onRegenerate(card)}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        {showSaveForm && (
          <div className="mx-auto max-w-6xl border-b px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="save-deck-name" className="text-xs font-medium text-muted-foreground">
                Deck name:
              </label>
              <Input
                id="save-deck-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                maxLength={120}
                className="h-9 flex-1 min-w-[16rem]"
                placeholder="My Avalanche cheatsheet"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={() => setShowSaveForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save to library
                  </>
                )}
              </Button>
            </div>
            {saveError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                {saveError}
              </p>
            )}
          </div>
        )}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="text-sm text-muted-foreground">
            {kept.length} card{kept.length === 1 ? '' : 's'} ready
            {downloadError && (
              <span className="ml-3 text-red-600 dark:text-red-400">· {downloadError}</span>
            )}
            {savedDeckId && !showSaveForm && (
              <span className="ml-3 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Saved to your library
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedDeckId && !showSaveForm && (
              <Button
                variant="outline"
                onClick={() => router.push(`/academy/flashcards/play/user/${savedDeckId}`)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Study now
              </Button>
            )}
            {!showSaveForm && !savedDeckId && (
              <Button
                variant="outline"
                onClick={openSaveForm}
                disabled={saving || kept.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                Save deck
              </Button>
            )}
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
    </div>
  );
}
