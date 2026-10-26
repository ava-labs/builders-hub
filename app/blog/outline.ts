/**
 * eco-blog-outline: the "On this page" list a blog post shows under its meta column (app/blog/[...slug]/page.tsx,
 * components/blog/blog-outline.tsx). It lists the post's h2 and h3 headings; a post with fewer than three gets none.
 */

/** One entry of the list: a heading's depth (2 or 3), its title and its anchor (`#id`). */
export interface OutlineItem<Title> {
  depth: 2 | 3;
  title: Title;
  url: string;
}

/** A post under this many listed headings shows no outline. */
const MIN_HEADINGS = 3;

/**
 * The post's h2 and h3 headings in page order, from its table of contents (fumadocs titles are React nodes, so a title
 * passes through as it is), or null when there are fewer than three.
 */
export function blogOutline<Title>(
  items: ReadonlyArray<{ depth: number; title: Title; url: string }>,
): Array<OutlineItem<Title>> | null {
  const outline = items.flatMap(
    (item): Array<OutlineItem<Title>> =>
      item.depth === 2 || item.depth === 3 ? [{ depth: item.depth, title: item.title, url: item.url }] : [],
  );
  return outline.length >= MIN_HEADINGS ? outline : null;
}
