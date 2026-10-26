import { describe, expect, it } from 'vitest';
import { blogOutline } from '@/app/blog/outline';

/** A table-of-contents entry as fumadocs writes it for a heading: its depth (2 for h2), its title and its anchor. */
const heading = (depth: number, title: string) => ({
  depth,
  title,
  url: `#${title.toLowerCase().replace(/\s+/g, '-')}`,
});

describe('blogOutline: the On this page list a post shows in its side column (eco-blog-outline)', () => {
  it('lists the h2 and h3 headings in page order, each with its depth, title and anchor', () => {
    expect(blogOutline([heading(2, 'Setting up'), heading(3, 'The fix'), heading(2, 'Results')])).toEqual([
      { depth: 2, title: 'Setting up', url: '#setting-up' },
      { depth: 3, title: 'The fix', url: '#the-fix' },
      { depth: 2, title: 'Results', url: '#results' },
    ]);
  });

  it('leaves out h1 and h4 to h6', () => {
    const outline = blogOutline([
      heading(1, 'Title'),
      heading(2, 'One'),
      heading(4, 'Deep'),
      heading(2, 'Two'),
      heading(5, 'Deeper'),
      heading(3, 'Three'),
      heading(6, 'Deepest'),
    ]);
    expect(outline?.map((item) => item.title)).toEqual(['One', 'Two', 'Three']);
  });

  it.each([0, 1, 2])('gives no outline to a post with %i headings: it shows from three', (count) => {
    const headings = Array.from({ length: count }, (_, i) => heading(2, `Heading ${i}`));
    expect(blogOutline(headings)).toBeNull();
  });

  it('counts only the headings it would list: two h2 and an h4 are not enough', () => {
    expect(blogOutline([heading(2, 'One'), heading(4, 'Deep'), heading(2, 'Two')])).toBeNull();
  });

  it('passes a rich title through untouched (fumadocs titles are React nodes, not strings)', () => {
    const rich = { type: 'code', props: { children: 'ACP-236' } };
    const outline = blogOutline([
      { depth: 2, title: rich, url: '#acp-236' },
      { depth: 2, title: rich, url: '#b' },
      { depth: 2, title: rich, url: '#c' },
    ]);
    expect(outline?.[0].title).toBe(rich);
  });

  it('builds new entries and leaves the table of contents it was given as it was', () => {
    const toc = Object.freeze(
      [heading(2, 'One'), heading(3, 'Two'), heading(2, 'Three')].map((item) => Object.freeze(item)),
    );
    const outline = blogOutline(toc);
    expect(outline?.[0]).not.toBe(toc[0]);
    expect(toc.map((item) => item.title)).toEqual(['One', 'Two', 'Three']);
  });
});
