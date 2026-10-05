import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Node } from 'fumadocs-core/page-tree';

const auth = vi.hoisted(() => ({ attrs: null as string[] | null, status: 'unauthenticated' }));
vi.mock('next-auth/react', () => ({
  useSession: () =>
    auth.attrs
      ? { data: { user: { custom_attributes: auth.attrs } }, status: 'authenticated' }
      : { data: null, status: auth.status },
}));

import AcademyPage, { metadata } from '@/app/(home)/academy/page';
import { parseAcademyView, viewHref, type AcademyView } from '@/components/academy/landing/academy-views';
import { CourseLink } from '@/components/academy/landing/course-state';
import { QUICK_ACCESS } from '@/components/academy/landing/quick-access';
import { Team1Line } from '@/components/academy/landing/team1-link';
import { NEWCOMER_COURSE_ID } from '@/components/academy/learning-path-configs/academy.config';
import { loadAcademyTree } from './helpers/content-tree';

const page = async (searchParams: Record<string, string | string[] | undefined>, attrs: string[] | null = null) => {
  auth.attrs = attrs;
  auth.status = attrs ? 'authenticated' : 'unauthenticated';
  return renderToStaticMarkup(await AcademyPage({ searchParams: Promise.resolve(searchParams) }));
};
const anchors = (html: string) => html.split('<a ').slice(1).map((segment) => `<a ${segment}`);
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? '').split(' ');
const FOCUS_RING = ['focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-ac-ink'];
/** The view toggle's markup: its container up to its closing tag (it holds no other div). */
const toggleOf = (html: string) => {
  const label = html.indexOf('aria-label="Course views"');
  return html.slice(html.lastIndexOf('<div', label), html.indexOf('</div>', label) + '</div>'.length);
};
const pageUrls = (nodes: Node[]): string[] =>
  nodes.flatMap((node) => {
    if (node.type === 'page') return [node.url];
    if (node.type === 'folder') return [...(node.index ? [node.index.url] : []), ...pageUrls(node.children)];
    return [];
  });

describe('the /academy page', () => {
  it.each<[string, Record<string, string | string[]>, AcademyView]>([
    ['no view', {}, 'overview'],
    ['?view=tree', { view: 'tree' }, 'tree'],
    ['?view=stages', { view: 'stages' }, 'stages'],
    ['an unknown view', { view: 'transit' }, 'overview'],
    ['a view in capitals', { view: 'TREE' }, 'overview'],
    ['a view with a trailing space', { view: 'tree ' }, 'overview'],
    ['an empty view', { view: '' }, 'overview'],
    ['a repeated view', { view: ['tree', 'stages'] }, 'overview'],
  ])('renders %s as the %s view', async (_label, params, view) => {
    const current = anchors(toggleOf(await page(params))).find((a) => a.includes('aria-current="page"'));
    expect(current).toContain(`href="${viewHref(view)}"`);
  });

  it('renders the chosen view on the server', async () => {
    expect(await page({})).toContain('Then choose what to build');
    expect(await page({ view: 'tree' })).toContain('vector-effect="non-scaling-stroke"');
    expect(await page({ view: 'stages' })).toContain('>Foundations</h2>');
  });

  it('is titled Avalanche Academy, with the navbar card line and the Academy og card', () => {
    expect(metadata.title).toBe('Avalanche Academy');
    expect(metadata.description).toBe('Guided courses, from blockchain fundamentals to launching your own L1.');
    expect(metadata.openGraph).toMatchObject({ url: '/academy', images: { url: '/api/og/academy?v=2', alt: 'Avalanche Academy' } });
  });

  it('keeps one Academy root around the whole landing', async () => {
    const html = await page({});
    // React 19 renders the eager banner's preload link before the root in a static render; Next moves it to <head>.
    expect(html).toMatch(/^(?:<link rel="preload" [^>]*\/>)*<div [^>]*data-academy="landing"/);
    expect(html.match(/data-academy=/g)).toHaveLength(1);
  });
});

describe('the hero', () => {
  it('sets "Avalanche Academy." in Aeonik Bold, the period in red', async () => {
    expect(await page({})).toMatch(
      /<h1 class="[^"]*\bfont-ac-display\b[^"]*\bfont-bold\b[^"]*">Avalanche Academy<span class="text-ac-red">\.<\/span><\/h1>/,
    );
  });

  it('prints the line and the programme facts', async () => {
    const html = await page({});
    expect(html).toContain('>Guided courses, from blockchain fundamentals to launching your own L1.</p>');
    expect(html).toContain('>13 courses · 377 lessons · 26 hours</span>');
  });

  it('shows the start button in the tree and stages views only, since J carries its own', async () => {
    expect(await page({})).not.toContain('Start with Avalanche Fundamentals');
    for (const view of ['tree', 'stages']) {
      const button = anchors(await page({ view })).find((a) => a.includes('>Start with Avalanche Fundamentals</a>')) ?? '';
      expect(button, view).toContain('href="/academy/avalanche-l1/avalanche-fundamentals"');
      expect(classesOf(button)).toEqual(expect.arrayContaining(FOCUS_RING));
    }
  });

  it('renders no Lucide icon in any view, and no picture outside J', async () => {
    for (const view of ['overview', 'tree', 'stages']) expect(await page({ view }), view).not.toContain('lucide');
    expect(await page({ view: 'tree' })).not.toContain('<img');
    expect(await page({ view: 'stages' })).not.toContain('<img');
  });
});

describe('the view toggle', () => {
  it('links the three views in order and marks the current one with the red rule', async () => {
    const links = anchors(toggleOf(await page({ view: 'stages' })));
    expect(links.map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual(['/academy', '/academy?view=tree', '/academy?view=stages']);
    expect(links.map((a) => a.replace(/<[^>]+>/g, ''))).toEqual(['Overview', 'Tree', 'Stages']);
    expect(links[2]).toContain('aria-current="page"');
    expect(classesOf(links[2])).toContain('border-ac-red');
    expect(links[0]).not.toContain('aria-current');
    links.forEach((a) => expect(classesOf(a)).toEqual(expect.arrayContaining(FOCUS_RING)));
  });

  it('is a navigation landmark that is not a nav element', async () => {
    expect(toggleOf(await page({}))).toMatch(/^<div role="navigation" aria-label="Course views"/);
  });
});

describe('the Team1 line', () => {
  const render = (attrs: string[] | null, status = 'unauthenticated') => {
    auth.attrs = attrs;
    auth.status = status;
    return renderToStaticMarkup(createElement(Team1Line, { className: 'mt-3.5' }));
  };
  /** The paragraph that holds a text, up to its closing tag. */
  const paragraphOf = (html: string, needle: string) => {
    const at = html.indexOf(needle);
    return html.slice(html.lastIndexOf('<p ', at), html.indexOf('</p>', at) + '</p>'.length);
  };
  const TEAM1 = /href="\/academy\/team1"/g;

  it('offers the Team1 Academy to Team1 members and to devrel, as a line with a plain link', () => {
    for (const attrs of [['team1-member'], ['team1-admin'], ['devrel']]) {
      const html = render(attrs);
      expect(html.replace(/<[^>]+>/g, ''), attrs.join()).toBe('Team1 member? Open the Team1 Academy');
      expect(html).toMatch(/^<p [^>]*>Team1 member\? <a /);
      const [link] = anchors(html);
      expect(link).toContain('href="/academy/team1"');
      // A plain link, not a CourseLink: no path card, and it never dims with the courses.
      expect(link).not.toContain('data-course-id');
      expect(link).not.toContain('data-state');
    }
  });

  it('renders nothing for a visitor, a user without access, or while the session loads', () => {
    expect(render(null)).toBe('');
    expect(render(null, 'loading')).toBe('');
    expect(render([])).toBe('');
    expect(render(['hackathon-judge'])).toBe('');
  });

  it('sits under the newcomer line in J, with its classes and its link classes, and leaves the hero row', async () => {
    const html = await page({}, ['team1-member']);
    expect(html.match(TEAM1)).toHaveLength(1);
    const newcomer = paragraphOf(html, 'Begin with Blockchain Fundamentals');
    const team1 = paragraphOf(html, 'Open the Team1 Academy');
    expect(html.indexOf(team1)).toBe(html.indexOf(newcomer) + newcomer.length);
    expect(classesOf(team1).sort()).toEqual(classesOf(newcomer).sort());
    // The newcomer link is a CourseLink, which adds its own dimming classes (course-state.tsx:89); the Team1 link is a
    // plain link, so it carries the newcomer link's className (spotlight-view.tsx:92) and nothing else.
    const dimming = classesOf(renderToStaticMarkup(createElement(CourseLink, { id: NEWCOMER_COURSE_ID, href: '/', children: '' })));
    expect([...dimming, ...classesOf(anchors(team1)[0])].sort()).toEqual(classesOf(anchors(newcomer)[0]).sort());
  });

  it('sits at the end of the hero row in the tree and stages views, after the facts', async () => {
    for (const view of ['tree', 'stages']) {
      const html = await page({ view }, ['team1-member']);
      expect(html.match(TEAM1), view).toHaveLength(1);
      const facts = html.indexOf('13 courses · 377 lessons · 26 hours');
      const link = html.indexOf('href="/academy/team1"');
      // The row is the div that holds the facts. The link sits in it, after the facts: from the row's opening tag to
      // the link no div opens or closes, and the row's closing tag comes after the link.
      const row = html.lastIndexOf('<div', facts);
      expect(link).toBeGreaterThan(facts);
      expect(html.slice(row, link).match(/<\/?div\b/g)).toEqual(['<div']);
      expect(html.indexOf('</div>', link)).toBeGreaterThan(link);
      expect(classesOf(paragraphOf(html, 'Open the Team1 Academy'))).toEqual(expect.arrayContaining(['ml-auto', 'max-md:ml-0']));
    }
  });
});

describe('Quick Access', () => {
  it('lists the six shortcuts as one text row after its label, with no icon and no number', async () => {
    const html = await page({});
    const label = html.indexOf('>Quick access</p>');
    const row = html.slice(html.lastIndexOf('<div', label), html.indexOf('</div>', label));
    expect(anchors(row).map((a) => a.replace(/<[^>]+>/g, ''))).toEqual([
      'Create an L1', 'Create your Native Token', 'Send Cross-Chain Messages', 'Bridge Tokens', 'Write Smart Contracts', 'HTTP-Native Payments',
    ]);
    expect(row).not.toMatch(/lucide|<svg|>0\d</);
    anchors(row).forEach((a) => expect(classesOf(a)).toEqual(expect.arrayContaining(FOCUS_RING)));
  });

  it('points every shortcut at a page in content/academy', () => {
    const urls = new Set(pageUrls(loadAcademyTree().children));
    QUICK_ACCESS.forEach((link) => expect(urls.has(link.href), link.href).toBe(true));
  });
});

describe('parseAcademyView and viewHref', () => {
  it('reads tree and stages exactly, and the overview for anything else', () => {
    const values: Array<string | string[] | undefined> = ['tree', 'stages', undefined, '', 'TREE', 'tree ', 'overview', ['tree']];
    expect(values.map(parseAcademyView)).toEqual(['tree', 'stages', 'overview', 'overview', 'overview', 'overview', 'overview', 'overview']);
  });

  it('keeps the overview at the bare /academy', () => {
    expect((['overview', 'tree', 'stages'] as const).map(viewHref)).toEqual(['/academy', '/academy?view=tree', '/academy?view=stages']);
  });
});
