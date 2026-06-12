'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  deleteUserDeck,
  listUserDecks,
  type UserFlashcardDeck,
} from '@/utils/quizzes/indexedDB';

function timeAgo(timestamp: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

function shortCoursePath(coursePath: string | null): string {
  if (!coursePath) return '—';
  const segments = coursePath.replace(/^\/academy\//, '').split('/');
  return segments
    .map((s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' › ');
}

export function DeckLibrary() {
  const [decks, setDecks] = useState<UserFlashcardDeck[] | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await listUserDecks();
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    setDecks(all);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onDelete = async (deckId: string) => {
    setDeletingId(deckId);
    try {
      await deleteUserDeck(deckId);
      setPendingDeleteId(null);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  };

  if (decks === null) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading your decks…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/academy/flashcards"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Flashcard Studio
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My flashcard decks</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {decks.length === 0
                ? 'You haven’t saved any decks on this browser yet.'
                : `${decks.length} deck${decks.length === 1 ? '' : 's'} saved on this browser.`}
            </p>
          </div>
          <Button asChild>
            <Link href="/academy/flashcards">
              <Plus className="mr-2 h-4 w-4" />
              Generate a deck
            </Link>
          </Button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-10 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Generate a deck in the Studio and click <span className="font-medium">Save deck</span> to
            keep it here.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {decks.map((deck) => {
            const isPending = pendingDeleteId === deck.id;
            const isDeleting = deletingId === deck.id;
            return (
              <li key={deck.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/academy/flashcards/play/user/${encodeURIComponent(deck.id)}`}
                    className="block truncate text-base font-semibold hover:underline"
                  >
                    {deck.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {deck.items.length} card{deck.items.length === 1 ? '' : 's'} ·{' '}
                    {shortCoursePath(deck.coursePath)} · saved {timeAgo(deck.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/academy/flashcards/play/user/${encodeURIComponent(deck.id)}`}>
                      <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Link>
                  </Button>
                  {isPending ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(deck.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Deleting…
                          </>
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingDeleteId(null)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(deck.id)}
                      aria-label={`Delete ${deck.name}`}
                      className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
