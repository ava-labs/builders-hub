'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RotateCw,
  Shuffle,
  ThumbsUp,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getDeckRatings,
  resetDeckRatings,
  setCardRating,
  type FlashcardRating,
  type FlashcardRatingStatus,
} from '@/utils/quizzes/indexedDB';
import type { LegacyFlashcardItem } from '@/lib/flashcards/types';
import { parseTextWithLinks } from '@/utils/safeHtml';

type StudyTab = 'all' | 'new' | 'review';

interface PlayDeckProps {
  setId: string;
  title: string;
  courseTitle: string | null;
  items: LegacyFlashcardItem[];
}

function bucketOf(rating: FlashcardRating | undefined): StudyTab[] {
  if (!rating || rating.status === 'new') return ['all', 'new'];
  if (rating.status === 'hard' || rating.status === 'unknown') return ['all', 'review'];
  return ['all'];
}

function queueForTab(
  tab: StudyTab,
  total: number,
  ratings: Record<number, FlashcardRating>,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < total; i++) {
    const rating = ratings[i];
    if (bucketOf(rating).includes(tab)) out.push(i);
  }
  return out;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function PlayDeck({ setId, title, courseTitle, items }: PlayDeckProps) {
  const total = items.length;

  const [ratings, setRatings] = useState<Record<number, FlashcardRating>>({});
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<StudyTab>('all');
  const [order, setOrder] = useState<number[]>(() =>
    Array.from({ length: total }, (_unused, i) => i),
  );
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionNeedsReview, setSessionNeedsReview] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Hydrate ratings from IndexedDB once on mount.
  useEffect(() => {
    let cancelled = false;
    getDeckRatings(setId, total).then((loaded) => {
      if (!cancelled) {
        setRatings(loaded);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setId, total]);

  // Recompute the order when the tab or ratings change. Reset position to 0
  // so the new tab starts from the top.
  const tabRef = useRef(tab);
  useEffect(() => {
    const tabChanged = tabRef.current !== tab;
    tabRef.current = tab;
    setOrder(queueForTab(tab, total, ratings));
    if (tabChanged) {
      setPosition(0);
      setRevealed(false);
    }
  }, [tab, ratings, total]);

  const queueSize = order.length;
  const currentIndex = order[position] ?? -1;
  const currentCard = currentIndex >= 0 ? items[currentIndex] : null;

  const counts = useMemo(() => {
    const out = { all: total, new: 0, review: 0 };
    for (let i = 0; i < total; i++) {
      const rating = ratings[i];
      const buckets = bucketOf(rating);
      if (buckets.includes('new')) out.new += 1;
      if (buckets.includes('review')) out.review += 1;
    }
    return out;
  }, [ratings, total]);

  const advance = useCallback(() => {
    setRevealed(false);
    setPosition((p) => p + 1);
  }, []);

  const goBack = useCallback(() => {
    setRevealed(false);
    setPosition((p) => Math.max(0, p - 1));
  }, []);

  const rate = useCallback(
    (status: FlashcardRatingStatus) => {
      if (currentIndex < 0) return;
      const cardIdx = currentIndex;
      setCardRating(setId, cardIdx, status).then((next) => {
        setRatings((prev) => ({ ...prev, [cardIdx]: next }));
      });
      if (status === 'easy') setSessionCorrect((n) => n + 1);
      else setSessionNeedsReview((n) => n + 1);
      advance();
    },
    [currentIndex, setId, advance],
  );

  const shuffle = useCallback(() => {
    setOrder((prev) => shuffleInPlace([...prev]));
    setPosition(0);
    setRevealed(false);
  }, []);

  const resetSession = useCallback(() => {
    setSessionCorrect(0);
    setSessionNeedsReview(0);
    setPosition(0);
    setRevealed(false);
  }, []);

  const resetProgress = useCallback(() => {
    resetDeckRatings(setId, total).then(() => {
      setRatings({});
      setSessionCorrect(0);
      setSessionNeedsReview(0);
      setPosition(0);
      setRevealed(false);
      setShowResetConfirm(false);
    });
  }, [setId, total]);

  // Keyboard shortcuts: Space toggles answer; 1/2/3 rate; ←/→ navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't capture when the user is interacting with a confirm button etc.
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      }
      if (!currentCard) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setRevealed((r) => !r);
      } else if (e.key === '1') {
        e.preventDefault();
        rate('unknown');
      } else if (e.key === '2') {
        e.preventDefault();
        rate('hard');
      } else if (e.key === '3') {
        e.preventDefault();
        rate('easy');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentCard, rate, advance, goBack]);

  const finishedQueue = hydrated && queueSize > 0 && position >= queueSize;
  const emptyQueue = hydrated && queueSize === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/academy"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Academy
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {courseTitle && (
          <p className="text-sm text-muted-foreground">{courseTitle}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Session Progress</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {sessionCorrect}
                </p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {sessionNeedsReview}
                </p>
                <p className="text-xs text-muted-foreground">Need Review</p>
              </div>
            </div>
            {queueSize > 0 && (
              <>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Card {Math.min(position + 1, queueSize)} of {queueSize}
                </p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (Math.min(position, queueSize - 1) / Math.max(1, queueSize - 1)) * 100)}%`,
                    }}
                  />
                </div>
              </>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Study Mode</h3>
            <div className="mt-3 space-y-1">
              {([
                ['all', 'All Cards'],
                ['new', 'New'],
                ['review', 'Review'],
              ] as Array<[StudyTab, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                    tab === key
                      ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600/90'
                      : 'hover:bg-muted',
                  )}
                  aria-pressed={tab === key}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs',
                      tab === key
                        ? 'bg-white/20 text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Actions</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={shuffle}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Shuffle queue"
                  title="Shuffle queue"
                >
                  <Shuffle className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Restart session"
                  title="Restart session (keeps ratings)"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt>Show answer:</dt>
                <dd className="font-mono">Space</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Don&apos;t know:</dt>
                <dd className="font-mono">1</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Hard:</dt>
                <dd className="font-mono">2</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Easy:</dt>
                <dd className="font-mono">3</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Navigate:</dt>
                <dd className="font-mono">← →</dd>
              </div>
            </dl>
            <div className="mt-3 border-t pt-3">
              {showResetConfirm ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="destructive" onClick={resetProgress} className="flex-1">
                    Confirm reset
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset progress for this deck
                </button>
              )}
            </div>
          </section>
        </aside>

        <section className="space-y-4">
          {!hydrated ? (
            <div className="flex h-96 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
              Loading…
            </div>
          ) : emptyQueue ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
              <p className="text-lg font-semibold">No cards in this tab</p>
              <p className="text-sm text-muted-foreground">
                {tab === 'new' && 'You’ve rated every card. Switch to All or Review.'}
                {tab === 'review' && 'Nothing needs review yet — switch to New or All.'}
                {tab === 'all' && 'This deck is empty.'}
              </p>
            </div>
          ) : finishedQueue ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
              <p className="text-lg font-semibold">Session complete</p>
              <p className="text-sm text-muted-foreground">
                {sessionCorrect} correct · {sessionNeedsReview} need review
              </p>
              <Button onClick={resetSession} className="mt-2">
                <RotateCw className="mr-1.5 h-4 w-4" />
                Run another pass
              </Button>
            </div>
          ) : currentCard ? (
            <>
              <article className="rounded-xl border bg-card">
                <header className="flex items-center justify-between border-b px-5 py-3">
                  <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                    {tab === 'review' ? 'Review' : tab === 'new' ? 'New' : 'Card'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Position {position + 1} / {queueSize}
                  </span>
                </header>
                <div className="px-5 py-8 sm:px-8 sm:py-10">
                  <h2 className="text-center text-xl font-semibold sm:text-2xl">
                    {currentCard.term}
                  </h2>
                  <div
                    className={cn(
                      'mt-6 min-h-[8rem] rounded-lg border-2 transition-all',
                      revealed
                        ? 'border-primary/30 bg-primary/5 p-5'
                        : 'border-dashed border-muted bg-muted/30 p-5',
                    )}
                  >
                    {revealed ? (
                      <div className="space-y-3 text-sm leading-relaxed sm:text-base">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                            Definition
                          </p>
                          <p>{currentCard.definition}</p>
                        </div>
                        {currentCard.example && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                              Example
                            </p>
                            {parseTextWithLinks(currentCard.example, 'text-muted-foreground italic')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <HelpCircle className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Press <span className="font-mono">Space</span> to reveal
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={() => setRevealed((r) => !r)}
                      variant={revealed ? 'outline' : 'default'}
                      className={cn(!revealed && 'bg-red-600 text-white hover:bg-red-700')}
                    >
                      {revealed ? 'Hide answer' : 'Reveal answer'}
                    </Button>
                  </div>
                </div>
                <footer className="flex items-center justify-between border-t px-5 py-3">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={position === 0}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={advance}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Skip
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </footer>
              </article>

              <div className="grid grid-cols-3 gap-3">
                <Button
                  type="button"
                  onClick={() => rate('unknown')}
                  variant="outline"
                  className="border-red-600/40 text-red-600 hover:bg-red-600/10 hover:text-red-700 dark:border-red-500/40 dark:text-red-400"
                >
                  <XIcon className="mr-1.5 h-4 w-4" />
                  Don&apos;t Know
                </Button>
                <Button
                  type="button"
                  onClick={() => rate('hard')}
                  variant="outline"
                  className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:border-amber-500/40 dark:text-amber-400"
                >
                  <HelpCircle className="mr-1.5 h-4 w-4" />
                  Hard
                </Button>
                <Button
                  type="button"
                  onClick={() => rate('easy')}
                  variant="outline"
                  className="border-green-600/40 text-green-700 hover:bg-green-600/10 hover:text-green-800 dark:border-green-500/40 dark:text-green-400"
                >
                  <ThumbsUp className="mr-1.5 h-4 w-4" />
                  Easy
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
