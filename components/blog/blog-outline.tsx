'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OutlineItem } from '@/app/blog/outline';
import { activeCategory, scrollToShow } from '@/lib/scroll-spy';

/** eco-blog-outline: a heading counts as the one being read once its top is this far (px) under the navbar. */
const READING_LINE = 120;

/**
 * Keeps the marked entry of the outline in view by scrolling the list itself, never the page; it jumps under Reduce
 * Motion, and a list that shows its entry never moves. It holds while the pointer is over the list: a wheel there
 * scrolls the list, then the page, and pulling the list back to the marked entry in between would make the wheel
 * alternate between the two. Once the pointer has left, the next mark scrolls the list again.
 */
export function keepMarkedInView(list: HTMLElement | null, reduced: boolean): void {
  const entry = list?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!list || !entry || list.matches(':hover')) return;
  const entryTop = entry.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  const top = scrollToShow(entryTop, entry.offsetHeight, list.scrollTop, list.clientHeight);
  if (top !== null) list.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
}

/**
 * eco-blog-outline: the sticky On this page list under a blog post's meta, from 1024px up. The heading being read
 * turns ink as the reader scrolls, a colour change only (its transition is in app/global.css, where it outranks the
 * global nav link rule). The server sends the list with no heading marked: the mark is measured in the browser. A list
 * taller than the window below its sticky top scrolls on its own and keeps the marked entry in view.
 */
export function BlogOutline({ items }: { items: ReadonlyArray<OutlineItem<ReactNode>> }) {
  const [current, setCurrent] = useState<string | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const urls = items.map((item) => item.url).join('\n');

  // As the page scrolls, mark the last heading that has passed a line READING_LINE under the navbar. Measured at most
  // once a frame.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const headings = urls.split('\n').flatMap((url) => {
        const heading = document.getElementById(url.slice(1));
        return heading ? [{ id: url, top: heading.getBoundingClientRect().top + window.scrollY }] : [];
      });
      const navbar = document.getElementById('nd-nav')?.getBoundingClientRect().bottom ?? 0;
      setCurrent(activeCategory(headings, window.scrollY, navbar + READING_LINE));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [urls]);

  // Keep the marked entry in view, unless the pointer is over the list (keepMarkedInView).
  useEffect(
    () => keepMarkedInView(listRef.current, window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    [current],
  );

  // Capped at the window below its 88px sticky top, with its own scroll. No overscroll containment: Chromium would then
  // stop a wheel over the list even when the list fits, and the page would not scroll under the pointer. The 4px of
  // padding keep the links' focus ring clear of the scroll edge; the negative margin gives them back, so the label and
  // links sit where they would without the cap.
  return (
    <nav
      ref={listRef}
      aria-label="On this page"
      className="blog-outline sticky top-[88px] mt-2 -mx-1 px-1 pb-1 max-h-[calc(100dvh-88px)] overflow-y-auto hidden lg:block"
    >
      <p className="mb-2 text-zinc-600 dark:text-muted-foreground">On this page</p>
      <ol className="grid gap-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
        {items.map((item) => (
          <li key={item.url} className={item.depth === 3 ? 'pl-3' : undefined}>
            <a
              href={item.url}
              // "true", not "location" (the aria-current: classes match only "true") or "page" (the navbar's red underline)
              aria-current={item.url === current ? 'true' : undefined}
              className="block leading-[1.35] text-zinc-600 hover:text-zinc-950 aria-current:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 dark:aria-current:text-zinc-50"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
