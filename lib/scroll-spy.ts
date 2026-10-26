/**
 * The scroll spy: which section a page is reading, for the /integrations sidebar (int-scroll-spy,
 * app/integrations/page.client.tsx) and the blog outline (eco-blog-outline, components/blog/blog-outline.tsx). A
 * section's `top` is its distance from the top of the document, and `offset` is the line, measured from the top of the
 * window, that its heading has to reach to count as the one being read.
 */

/** The last section whose heading has reached the line (`top - offset <= scrollY`); null before the first. */
export function activeCategory(
  sections: ReadonlyArray<{ id: string; top: number }>,
  scrollY: number,
  offset: number,
): string | null {
  return sections.findLast((section) => section.top - offset <= scrollY)?.id ?? null;
}

/**
 * True once a scrolled page can scroll no further (within 2px, for a fractional scroll position). The last sections of
 * a page may never reach the line, so there the sidebar marks the last one.
 */
export function atPageEnd(scrollY: number, viewportHeight: number, pageHeight: number): boolean {
  return scrollY > 0 && scrollY + viewportHeight >= pageHeight - 2;
}

/**
 * The section the /integrations sidebar marks: the last one once the page can scroll no further (atPageEnd), else the
 * last whose heading has reached the line `line` px under the navbar's bottom edge (`navbar`, from the top of the
 * window). Null before the first heading reaches it, and on a page with no sections.
 */
export function markedCategory(
  sections: ReadonlyArray<{ id: string; top: number }>,
  page: { scrollY: number; viewportHeight: number; pageHeight: number },
  navbar: number,
  line: number,
): string | null {
  const last = sections.at(-1);
  if (last && atPageEnd(page.scrollY, page.viewportHeight, page.pageHeight)) return last.id;
  return activeCategory(sections, page.scrollY, navbar + line);
}

/**
 * Where a list that scrolls on its own should scroll to keep its marked entry in view: null while the entry is fully
 * in view (a list that shows everything never moves), else the scroll position that puts the entry a third of the way
 * down, never above the top. `entryTop` is the entry's distance from the top of the list's content; `scrollTop` and
 * `viewHeight` are the list's scroll position and visible height.
 */
export function scrollToShow(
  entryTop: number,
  entryHeight: number,
  scrollTop: number,
  viewHeight: number,
): number | null {
  if (entryTop >= scrollTop && entryTop + entryHeight <= scrollTop + viewHeight) return null;
  return Math.max(0, entryTop - viewHeight / 3);
}
