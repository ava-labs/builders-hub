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
  X,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { useStudioStore } from '@/lib/flashcards/store';
import type { CategoryItem, ChapterItem, CourseItem } from '@/lib/flashcards/catalog';
import type { SourceAnchor } from '@/lib/flashcards/types';

interface DeckPickerProps {
  catalog: CategoryItem[];
}

interface SelectedItem {
  path: string;
  title: string;
  courseSlug: string;
  courseTitle: string;
}

const TARGET_CARD_COUNT_DEFAULT = 25;
const MIN_TARGET = 10;
const MAX_TARGET = 50;
const MAX_SELECTED = 12;

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

export function DeckPicker({ catalog }: DeckPickerProps) {
  const router = useRouter();
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const setSession = useStudioStore((s) => s.setSession);
  const startGenerating = useStudioStore((s) => s.startGenerating);
  const setError = useStudioStore((s) => s.setError);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
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
      kind: 'academy',
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
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
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
                  return (
                    <div key={course.slug} className="rounded-lg border bg-card">
                      <button
                        type="button"
                        onClick={() => toggleCourse(course.slug)}
                        className="flex w-full items-center justify-between p-3 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="flex items-center gap-2">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{course.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {course.chapters.length} chapter{course.chapters.length === 1 ? '' : 's'}
                          </span>
                        </span>
                        {courseSelectedCount > 0 && (
                          <Badge variant="secondary">{courseSelectedCount} picked</Badge>
                        )}
                      </button>
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
          <p className="text-sm text-muted-foreground mt-1">
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

        <Button
          onClick={handleGenerate}
          disabled={isPending || selected.size === 0}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {status === 'authenticated' ? 'Generate deck' : 'Sign in to generate'}
            </>
          )}
        </Button>
      </aside>
    </div>
  );
}
