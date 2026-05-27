'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  HelpCircle,
  Keyboard,
  Layers,
  Loader2,
  Pencil,
  RotateCw,
  Shuffle,
  ThumbsUp,
  Trash2,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  deleteUserDeck,
  getDeckRatings,
  getUserDeck,
  listUserDecks,
  renameUserDeck,
  resetDeckRatings,
  setCardRating,
  type FlashcardRating,
  type FlashcardRatingStatus,
  type UserFlashcardDeck,
} from '@/utils/quizzes/indexedDB';
import type { Deck, LegacyFlashcardItem } from '@/lib/flashcards/types';
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

const USER_DECK_PREFIX = 'user:';

export function PlayDeck({ setId, title, courseTitle, items }: PlayDeckProps) {
  const router = useRouter();
  const isUserDeck = setId.startsWith(USER_DECK_PREFIX);

  // For user decks the props.items arrives empty (server can't read IDB);
  // hydrate from `getUserDeck` after mount. For curated decks, items is the
  // initial source of truth.
  const [liveItems, setLiveItems] = useState<LegacyFlashcardItem[]>(items);
  const [liveTitle, setLiveTitle] = useState(title);
  const [deckLoadState, setDeckLoadState] = useState<'loading' | 'ready' | 'not-found'>(
    isUserDeck ? 'loading' : 'ready',
  );

  const [ratings, setRatings] = useState<Record<number, FlashcardRating>>({});
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<StudyTab>('all');
  const [order, setOrder] = useState<number[]>(() =>
    Array.from({ length: items.length }, (_unused, i) => i),
  );
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionNeedsReview, setSessionNeedsReview] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRenameForm, setShowRenameForm] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recentDecks, setRecentDecks] = useState<UserFlashcardDeck[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  // One-time onboarding: open the keyboard hints panel the first time a user
  // lands on play mode so the 1/2/3 + Space shortcuts are discoverable.
  // localStorage persists across sessions; clearing browser data resets it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const KEY = 'flashcards.keyboard-hints-seen';
    if (window.localStorage.getItem(KEY) === '1') return;
    setShowKeyboardHints(true);
    window.localStorage.setItem(KEY, '1');
  }, []);

  const total = liveItems.length;

  // Load user deck from IDB on mount when setId has the user: prefix.
  useEffect(() => {
    if (!isUserDeck) return;
    let cancelled = false;
    const id = setId.slice(USER_DECK_PREFIX.length);
    getUserDeck(id).then((deck) => {
      if (cancelled) return;
      if (!deck) {
        setDeckLoadState('not-found');
        return;
      }
      setLiveItems(deck.items);
      setLiveTitle(deck.name);
      setOrder(Array.from({ length: deck.items.length }, (_unused, i) => i));
      setDeckLoadState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [isUserDeck, setId]);

  // Hydrate ratings from IndexedDB after the deck contents are known.
  useEffect(() => {
    if (deckLoadState !== 'ready') return;
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
  }, [setId, total, deckLoadState]);

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
  const currentCard = currentIndex >= 0 ? liveItems[currentIndex] : null;

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

  const openRenameForm = useCallback(() => {
    setRenameValue(liveTitle);
    setShowRenameForm(true);
  }, [liveTitle]);

  const submitRename = useCallback(async () => {
    if (!isUserDeck) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === liveTitle) {
      setShowRenameForm(false);
      return;
    }
    const id = setId.slice(USER_DECK_PREFIX.length);
    const updated = await renameUserDeck(id, trimmed);
    if (updated) setLiveTitle(updated.name);
    setShowRenameForm(false);
  }, [isUserDeck, renameValue, liveTitle, setId]);

  const confirmDelete = useCallback(async () => {
    if (!isUserDeck) return;
    const id = setId.slice(USER_DECK_PREFIX.length);
    await deleteUserDeck(id);
    await resetDeckRatings(setId, total);
    router.push('/academy/flashcards');
  }, [isUserDeck, setId, total, router]);

  // Hydrate the recent-decks dropdown on mount and after any save/delete.
  useEffect(() => {
    listUserDecks().then((all) => {
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      setRecentDecks(all);
    });
  }, [liveTitle]); // re-list when title changes (rename event)

  const handleDownload = useCallback(async () => {
    setDownloadError(null);
    if (deckLoadState !== 'ready' || liveItems.length === 0) return;
    if (!isUserDeck) {
      // Curated deck — straight GET, browser handles the download.
      window.location.href = `/api/flashcards/download/${encodeURIComponent(setId)}`;
      return;
    }
    setDownloading(true);
    try {
      const id = setId.slice(USER_DECK_PREFIX.length);
      const deckPayload: Deck = {
        id,
        title: liveTitle,
        sources: [
          {
            kind: 'academy',
            path: `/academy/flashcards/play/user/${id}`,
            chapterTitle: liveTitle,
          },
        ],
        cards: liveItems.map((item, index) => ({
          id: `${id}-${index}`,
          type: 'qa',
          front: item.term,
          back: item.example ? `${item.definition}\n\n*Example:* ${item.example}` : item.definition,
          source: {
            kind: 'academy',
            path: `/academy/flashcards/play/user/${id}`,
            chapterTitle: liveTitle,
          },
        })),
      };
      const res = await fetch('/api/flashcards/studio-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deckPayload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(detail.message ?? detail.error ?? `Failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${liveTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'deck'}.apkg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }, [deckLoadState, liveItems, isUserDeck, setId, liveTitle]);

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

  if (deckLoadState === 'loading') {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        Loading deck…
      </div>
    );
  }

  if (deckLoadState === 'not-found') {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 rounded-xl border bg-card p-10 text-center"
        role="alert"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Layers className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Deck not found</p>
          <p className="text-sm text-muted-foreground">
            It may have been deleted, or this link came from a different
            browser. Decks you save in the Studio are stored on the device
            where you created them.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/academy/flashcards/library">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Browse decks
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/academy/flashcards">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Studio
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{liveTitle}</h1>
            {courseTitle && (
              <p className="mt-1 text-sm text-muted-foreground">{courseTitle}</p>
            )}
            {isUserDeck && (
              <p className="mt-1 text-xs text-muted-foreground">
                Saved locally · rename or delete from the Actions panel
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {recentDecks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Switch deck
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                    Recent decks
                  </DropdownMenuLabel>
                  {recentDecks.slice(0, 5).map((deck) => {
                    const isCurrent = isUserDeck && setId === `${USER_DECK_PREFIX}${deck.id}`;
                    return (
                      <DropdownMenuItem key={deck.id} asChild disabled={isCurrent}>
                        <Link
                          href={`/academy/flashcards/play/user/${encodeURIComponent(deck.id)}`}
                          className="flex items-center gap-2"
                        >
                          <span className="flex-1 truncate">{deck.name}</span>
                          <span className="text-xs text-muted-foreground">{deck.items.length}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/academy/flashcards/library" className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" />
                      <span className="flex-1">View all decks</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading || deckLoadState !== 'ready'}
              className="gap-1.5"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Packing…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Anki
                </>
              )}
            </Button>
          </div>
        </div>
        {downloadError && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {downloadError}
          </p>
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
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted',
                  )}
                  aria-pressed={tab === key}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs',
                      tab === key
                        ? 'bg-primary-foreground/20 text-primary-foreground'
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
                <button
                  type="button"
                  onClick={() => setShowKeyboardHints((v) => !v)}
                  className={cn(
                    'rounded p-1 hover:bg-muted hover:text-foreground',
                    showKeyboardHints ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  aria-label="Toggle keyboard shortcuts"
                  aria-expanded={showKeyboardHints}
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
              </div>
            </div>
            {showKeyboardHints && (
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
            )}
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
            {isUserDeck && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {showRenameForm ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      maxLength={120}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitRename();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowRenameForm(false);
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={submitRename} className="flex-1">
                        Save name
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRenameForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openRenameForm}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                    Rename deck
                  </button>
                )}
                <AlertDialog
                  open={showDeleteConfirm}
                  onOpenChange={setShowDeleteConfirm}
                >
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete deck
                  </button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this deck?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{liveTitle}” will be removed from this browser along
                        with its study progress. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete deck
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
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
                      aria-keyshortcuts="Space"
                    >
                      {revealed ? 'Hide answer' : 'Reveal answer'}
                      <kbd className="ml-2 inline-flex h-5 items-center rounded border bg-background/10 px-1.5 font-mono text-[10px] text-current/80">
                        Space
                      </kbd>
                    </Button>
                  </div>
                </div>
                <footer className="flex items-center justify-between border-t px-5 py-3">
                  <Button
                    type="button"
                    onClick={goBack}
                    disabled={position === 0}
                    variant="ghost"
                    size="sm"
                    aria-label="Previous card"
                    aria-keyshortcuts="ArrowLeft"
                    className="text-muted-foreground"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    onClick={advance}
                    variant="ghost"
                    size="sm"
                    aria-label="Skip to next card"
                    aria-keyshortcuts="ArrowRight"
                    className="text-muted-foreground"
                  >
                    Skip
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </footer>
              </article>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  onClick={() => rate('unknown')}
                  variant="outline"
                  size="lg"
                  aria-keyshortcuts="1"
                  className="min-h-12 justify-between border-red-600/40 text-red-600 hover:bg-red-600/10 hover:text-red-700 dark:border-red-500/40 dark:text-red-400"
                >
                  <span className="flex items-center">
                    <XIcon className="mr-1.5 h-4 w-4" />
                    Don&apos;t Know
                  </span>
                  <kbd
                    className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded border bg-background/40 font-mono text-[10px] text-current/80"
                    aria-hidden
                  >
                    1
                  </kbd>
                </Button>
                <Button
                  type="button"
                  onClick={() => rate('hard')}
                  variant="outline"
                  size="lg"
                  aria-keyshortcuts="2"
                  className="min-h-12 justify-between border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:border-amber-500/40 dark:text-amber-400"
                >
                  <span className="flex items-center">
                    <Clock className="mr-1.5 h-4 w-4" />
                    Hard
                  </span>
                  <kbd
                    className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded border bg-background/40 font-mono text-[10px] text-current/80"
                    aria-hidden
                  >
                    2
                  </kbd>
                </Button>
                <Button
                  type="button"
                  onClick={() => rate('easy')}
                  variant="outline"
                  size="lg"
                  aria-keyshortcuts="3"
                  className="min-h-12 justify-between border-green-600/40 text-green-700 hover:bg-green-600/10 hover:text-green-800 dark:border-green-500/40 dark:text-green-400"
                >
                  <span className="flex items-center">
                    <ThumbsUp className="mr-1.5 h-4 w-4" />
                    Easy
                  </span>
                  <kbd
                    className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded border bg-background/40 font-mono text-[10px] text-current/80"
                    aria-hidden
                  >
                    3
                  </kbd>
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
