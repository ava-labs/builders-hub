'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  Loader2,
  LogIn,
  X,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { useStudioStore } from '@/lib/flashcards/store';
import type { CategoryItem, ChapterItem, CourseItem } from '@/lib/flashcards/catalog';
import type { SourceAnchor } from '@/lib/flashcards/types';

interface DeckPickerProps {
  catalog: CategoryItem[];
  initialSources?: SourceAnchor[];
}

interface SelectedItem {
  path: string;
  title: string;
  courseSlug: string;
  courseTitle: string;
  kind: SourceAnchor['kind'];
}

const TARGET_CARD_COUNT_DEFAULT = 25;
const MIN_TARGET = 10;
const MAX_TARGET = 50;
const MAX_SELECTED = 60;

function findChapterLocation(
  catalog: CategoryItem[],
  path: string,
): { courseSlug: string; courseTitle: string } | null {
  for (const cat of catalog) {
    for (const course of cat.courses) {
      if (course.chapters.some((c) => c.path === path)) {
        return { courseSlug: course.slug, courseTitle: course.title };
      }
    }
  }
  return null;
}

function buildInitialSelected(
  catalog: CategoryItem[],
  initialSources: SourceAnchor[] | undefined,
): Map<string, SelectedItem> {
  const map = new Map<string, SelectedItem>();
  if (!initialSources?.length) return map;
  for (const anchor of initialSources.slice(0, MAX_SELECTED)) {
    const loc = findChapterLocation(catalog, anchor.path);
    map.set(anchor.path, {
      path: anchor.path,
      title: anchor.chapterTitle,
      kind: anchor.kind,
      courseSlug: loc?.courseSlug ?? (anchor.kind === 'docs' ? 'docs' : 'other'),
      courseTitle: loc?.courseTitle ?? (anchor.kind === 'docs' ? 'Documentation' : 'Other'),
    });
  }
  return map;
}

function chapterMatchesQuery(item: ChapterItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return item.title.toLowerCase().includes(q) || item.path.toLowerCase().includes(q);
}

function courseMatchesQuery(course: CourseItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (course.title.toLowerCase().includes(q)) return true;
  return course.chapters.some((c) => chapterMatchesQuery(c, query));
}

function filterCatalog(catalog: CategoryItem[], query: string): CategoryItem[] {
  if (!query) return catalog;
  return catalog
    .map((cat) => ({
      ...cat,
      courses: cat.courses
        .filter((course) => courseMatchesQuery(course, query))
        .map((course) => ({
          ...course,
          chapters: course.chapters.filter((c) => chapterMatchesQuery(c, query)),
        })),
    }))
    .filter((cat) => cat.courses.length > 0);
}

export function DeckPicker({ catalog, initialSources }: DeckPickerProps) {
  const router = useRouter();
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const setSession = useStudioStore((s) => s.setSession);
  const startGenerating = useStudioStore((s) => s.startGenerating);
  const setError = useStudioStore((s) => s.setError);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(() =>
    buildInitialSelected(catalog, initialSources),
  );
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const item of buildInitialSelected(catalog, initialSources).values()) {
      set.add(item.courseSlug);
    }
    return set;
  });
  const [targetCount, setTargetCount] = useState(TARGET_CARD_COUNT_DEFAULT);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => filterCatalog(catalog, query), [catalog, query]);

  const toggleChapter = (chapter: ChapterItem, course: CourseItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(chapter.path)) {
        next.delete(chapter.path);
      } else if (next.size >= MAX_SELECTED) {
        setSubmitError(`Pick at most ${MAX_SELECTED} chapters.`);
        return prev;
      } else {
        next.set(chapter.path, {
          path: chapter.path,
          title: chapter.title,
          courseSlug: course.slug,
          courseTitle: course.title,
          kind: 'academy',
        });
        setSubmitError(null);
      }
      return next;
    });
  };

  const removeSelected = (path: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
  };

  const toggleCourse = (slug: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectAllInCourse = (course: CourseItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      let hitCap = false;
      for (const chapter of course.chapters) {
        if (next.has(chapter.path)) continue;
        if (next.size >= MAX_SELECTED) {
          hitCap = true;
          break;
        }
        next.set(chapter.path, {
          path: chapter.path,
          title: chapter.title,
          courseSlug: course.slug,
          courseTitle: course.title,
          kind: 'academy',
        });
      }
      setSubmitError(hitCap ? `Stopped at ${MAX_SELECTED}-chapter cap.` : null);
      return next;
    });
  };

  const clearCourse = (course: CourseItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const chapter of course.chapters) {
        next.delete(chapter.path);
      }
      return next;
    });
    setSubmitError(null);
  };

  const handleGenerate = async () => {
    if (selected.size === 0) {
      setSubmitError('Pick at least one chapter.');
      return;
    }
    if (status !== 'authenticated') {
      openLoginModal();
      return;
    }

    setSubmitError(null);
    startGenerating();

    const sources: SourceAnchor[] = Array.from(selected.values()).map((s) => ({
      kind: s.kind,
      path: s.path,
      chapterTitle: s.title,
    }));

    startTransition(async () => {
      try {
        const res = await fetch('/api/flashcards/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources,
            targetCardCount: targetCount,
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(detail.message ?? detail.error ?? `Request failed: ${res.status}`);
        }
        const data = (await res.json()) as { sessionId: string; deck: import('@/lib/flashcards/types').Deck };
        setSession(data.sessionId, data.deck);
        router.push(`/academy/flashcards/${data.sessionId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Generation failed';
        setError(msg);
        setSubmitError(msg);
      }
    });
  };

  return (
    <>
    <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_22rem] lg:pb-0">
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Academy courses and chapters..."
            className="pl-9"
            aria-label="Search Academy"
          />
        </div>

        <div className="space-y-6">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches.</p>
          )}
          {filtered.map((cat) => (
            <section key={cat.slug} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {cat.title}
              </h2>
              <div className="space-y-2">
                {cat.courses.map((course) => {
                  const expanded = expandedCourses.has(course.slug) || !!query;
                  const courseSelectedCount = course.chapters.filter((c) =>
                    selected.has(c.path),
                  ).length;
                  const allSelected = courseSelectedCount === course.chapters.length;
                  const remainingBudget = MAX_SELECTED - selected.size;
                  const selectAllDisabled = allSelected || remainingBudget === 0;
                  const clearDisabled = courseSelectedCount === 0;
                  return (
                    <div key={course.slug} className="rounded-lg border bg-card">
                      <div className="flex w-full items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleCourse(course.slug)}
                          className="flex min-w-0 flex-1 items-center gap-2 p-3 text-left"
                          aria-expanded={expanded}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">{course.title}</span>
                          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                            {course.chapters.length} chapter{course.chapters.length === 1 ? '' : 's'}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-3 pr-3">
                          {courseSelectedCount > 0 && (
                            <Badge
                              variant="secondary"
                              role="status"
                              aria-live="polite"
                              aria-label={`${courseSelectedCount} chapter${courseSelectedCount === 1 ? '' : 's'} selected in ${course.title}`}
                            >
                              {courseSelectedCount} picked
                            </Badge>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => selectAllInCourse(course)}
                              disabled={selectAllDisabled}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed dark:text-red-400"
                              aria-label={`Select all chapters of ${course.title}`}
                            >
                              Select all
                            </button>
                            <span aria-hidden className="text-xs text-muted-foreground">·</span>
                            <button
                              type="button"
                              onClick={() => clearCourse(course)}
                              disabled={clearDisabled}
                              className="text-xs font-medium text-muted-foreground hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                              aria-label={`Clear chapters of ${course.title}`}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </div>
                      {expanded && (
                        <ul className="border-t divide-y">
                          {course.chapters.map((chapter) => {
                            const isSelected = selected.has(chapter.path);
                            return (
                              <li key={chapter.path}>
                                <label
                                  className={cn(
                                    'flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors',
                                    isSelected && 'bg-primary/5',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleChapter(chapter, course)}
                                    className="mt-1 h-4 w-4 rounded border-input"
                                  />
                                  <span className="flex-1 text-sm">
                                    <span className="block">{chapter.title}</span>
                                    <span className="block text-xs text-muted-foreground truncate">
                                      {chapter.path}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h3 className="font-semibold">Selected sources</h3>
          <p
            className="text-sm text-muted-foreground mt-1"
            role="status"
            aria-live="polite"
          >
            {selected.size === 0
              ? 'Pick chapters from the left to build your deck.'
              : `${selected.size} chapter${selected.size === 1 ? '' : 's'} selected (max ${MAX_SELECTED}).`}
          </p>
        </div>

        <div className="space-y-2 max-h-72 overflow-auto">
          {Array.from(selected.values()).map((item) => (
            <div
              key={item.path}
              className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.courseTitle}</span>
              </span>
              <button
                type="button"
                onClick={() => removeSelected(item.path)}
                aria-label={`Remove ${item.title}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <label htmlFor="target-count" className="block text-sm font-medium">
            Target cards: <span className="text-muted-foreground">{targetCount}</span>
          </label>
          <input
            id="target-count"
            type="range"
            min={MIN_TARGET}
            max={MAX_TARGET}
            step={5}
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value))}
            className="w-full"
            aria-label="Target card count"
          />
          <p className="text-xs text-muted-foreground">
            The AI will go lower if the source content is thin. Hard cap 50.
          </p>
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {submitError}
          </p>
        )}

        {status !== 'authenticated' && selected.size > 0 && (
          <p className="text-xs text-muted-foreground" id="auth-required-hint">
            Sign-in required to generate a deck. Your selections are kept until
            you return.
          </p>
        )}
        {selected.size === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="block w-full">
                <Button
                  onClick={handleGenerate}
                  disabled
                  className="w-full"
                  aria-describedby="pick-chapters-hint"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate deck
                </Button>
                <span id="pick-chapters-hint" className="sr-only">
                  Pick at least one chapter to generate a deck.
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Pick at least one chapter to generate.
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={isPending}
            variant={status !== 'authenticated' ? 'outline' : 'default'}
            aria-describedby={
              status !== 'authenticated' ? 'auth-required-hint' : undefined
            }
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : status === 'authenticated' ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate deck
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in to start
              </>
            )}
          </Button>
        )}
      </aside>
    </div>

    {/* Mobile-only sticky CTA. On small screens the in-flow aside (with its
        Generate button) sits below the entire chapter list, so surface a
        reachable CTA pinned to the bottom. Hidden at lg where the aside is a
        sticky sidebar. Reuses handleGenerate + the same auth/disabled states. */}
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <p
          className="min-w-0 flex-1 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium text-foreground">{selected.size}</span>{' '}
          chapter{selected.size === 1 ? '' : 's'} selected
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isPending || selected.size === 0}
          variant={
            status !== 'authenticated' && selected.size > 0
              ? 'outline'
              : 'default'
          }
          className="shrink-0"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : status !== 'authenticated' && selected.size > 0 ? (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in to start
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate deck
            </>
          )}
        </Button>
      </div>
    </div>
    </>
  );
}
