import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import IntegrationsClient from '@/app/integrations/page.client';
import { attrOf, classesOf, openingTags, read, transitionOf } from './helpers';

/**
 * Task 18 of the hub motion pass, the Integrations directory: what a search brings back fades in (int-search-settle,
 * variant a), the sidebar marks the category on screen (int-scroll-spy, variant a), cards and the Add button press
 * (int-card-press), and below 768px the category box folds into one Categories row (int-phone-categories, a layout
 * change Federico approved; 768px and up stay as they were).
 */
const PAGE = 'app/integrations/page.client.tsx';
const SPY = 'lib/scroll-spy.ts';
const TOUCHED = [PAGE, SPY];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const EASE_OUT = 'var(--ease-out)';

const src = read(PAGE);

const integration = (title: string, category: string, featured = false) => ({
  url: `/integrations/${title.toLowerCase()}`,
  data: {
    title,
    category,
    featured,
    logo: `/images/${title}.png`,
    description: `${title} on Avalanche`,
    available: ['C-Chain'],
  },
});
/** Four integrations in three categories; Core is featured, so it shows twice (Featured and Wallets). */
const list = [
  integration('Core', 'Wallets', true),
  integration('Glacier', 'Data'),
  integration('Fireblocks', 'Custody'),
  integration('Rabby', 'Wallets'),
];
/** The page as the server sends it: before hydration, with no search. */
const html = renderToStaticMarkup(createElement(IntegrationsClient, { list }));

/** The opening tags of `tag` in `markup` that `test` picks. */
const pick = (markup: string, tag: string, test: (open: string) => boolean = () => true) =>
  openingTags(markup, tag).filter(test);

/** The one opening tag of `tag` in `markup` that `test` picks (inside a test: it asserts there is exactly one). */
function only(markup: string, tag: string, test?: (open: string) => boolean): string {
  const found = pick(markup, tag, test);
  expect(found, `exactly one <${tag}> that matches`).toHaveLength(1);
  return found[0];
}

/** The classes of the last `<tag className="...">` in the page source before `marker` (for what only renders after a search). */
function classesBefore(marker: string, tag: string): string[] {
  const at = src.indexOf(marker);
  expect(at, `"${marker}" in ${PAGE}`).toBeGreaterThan(-1);
  const opens = [...src.slice(0, at).matchAll(new RegExp(`<${tag}\\s+className="([^"]*)"`, 'g'))];
  return (opens.at(-1)?.[1] ?? '').split(/\s+/).filter(Boolean);
}

const cards = openingTags(html, 'a').filter((a) => attrOf(a, 'href')?.startsWith('/integrations/'));
const aside = html.slice(html.indexOf('<aside'), html.indexOf('</aside>'));
const categoryList = aside.slice(aside.indexOf('<ul'), aside.indexOf('</ul>'));

describe('every file this task touches', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const text = read(path);
    expect(text).not.toMatch(TRANSITION_ALL);
    expect(text).not.toMatch(EASE_IN);
  });
});

describe('int-search-settle: what a search brings back fades in over 150ms and never moves', () => {
  it('the server HTML starts nothing hidden: no element there carries a starting style', () => {
    expect(cards).toHaveLength(5);
    expect(html).not.toContain('starting:');
  });

  it('cards and category headings fade their opacity in 150ms on the strong ease-out', () => {
    for (const card of cards) expect(transitionOf(classesOf(card)).opacity).toBe(`150ms ${EASE_OUT}`);
    const headings = openingTags(html, 'section');
    expect(headings).toHaveLength(4);
    for (const heading of headings) expect(transitionOf(classesOf(heading))).toEqual({ opacity: `150ms ${EASE_OUT}` });
  });

  it('once hydrated, a card or heading that mounts starts from opacity 0, so only what a search brings back fades in', () => {
    expect(src.match(/mounted && 'starting:opacity-0'/g)).toHaveLength(2);
  });

  it('the "Found" line and the no-results state, which only exist after a search, fade in the same way', () => {
    for (const classes of [classesBefore('Found {', 'p'), classesBefore('No integrations found', 'div')]) {
      expect(transitionOf(classes)).toEqual({ opacity: `150ms ${EASE_OUT}` });
      expect(classes).toContain('starting:opacity-0');
    }
  });

  it('every starting style on the page is opacity 0: nothing slides, scales or blurs in', () => {
    const starts = src.match(/\bstarting:[^\s'"`]+/g) ?? [];
    expect(starts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(starts)).toEqual(new Set(['starting:opacity-0']));
  });
});

describe('int-card-press: each control names what it transitions, and cards and the Add button press in', () => {
  const add = pick(html, 'a', (a) => attrOf(a, 'href')?.includes('integration_listing') ?? false)[0] ?? '';

  it('a card fades its border in 150ms ease and presses to 0.985 in 160ms on the strong ease-out', () => {
    for (const card of cards) {
      const classes = classesOf(card);
      expect(transitionOf(classes)).toEqual({
        'border-color': '150ms ease',
        opacity: `150ms ${EASE_OUT}`,
        scale: `160ms ${EASE_OUT}`,
      });
      expect(classes).toEqual(
        expect.arrayContaining([
          'active:scale-[0.985]',
          'motion-reduce:active:scale-100',
          'motion-reduce:active:opacity-85',
        ]),
      );
    }
  });

  it('the red Add button presses to 0.97 in 160ms and fades its colour in 150ms ease; Reduce Motion dims it instead', () => {
    expect(add).not.toBe('');
    const classes = classesOf(add);
    expect(transitionOf(classes)).toEqual({ 'background-color': '150ms ease', scale: `160ms ${EASE_OUT}` });
    expect(classes).toEqual(
      expect.arrayContaining([
        'active:scale-[0.97]',
        'motion-reduce:active:scale-100',
        'motion-reduce:active:opacity-85',
      ]),
    );
  });

  it('its arrow slides in 200ms on the strong ease-out, and only when motion is welcome', () => {
    const start = html.indexOf(add);
    const arrow = openingTags(html.slice(start, html.indexOf('</a>', start)), 'svg').at(-1) ?? '';
    const classes = classesOf(arrow);
    expect(transitionOf(classes)).toEqual({ translate: `200ms ${EASE_OUT}` });
    expect(classes).toContain('motion-safe:group-hover:translate-x-0.5');
    expect(classes.filter((name) => name.startsWith('group-hover:translate'))).toEqual([]);
  });

  it('the search field fades its border in 150ms ease', () => {
    const field = only(html, 'input', (input) => attrOf(input, 'type') === 'text');
    expect(transitionOf(classesOf(field))).toEqual({ 'border-color': '150ms ease' });
  });
});

describe('int-scroll-spy: the row of the category on screen takes the hover tint', () => {
  it('every row tints like hover when it is the current one, in 150ms ease', () => {
    const rows = openingTags(categoryList, 'a');
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const classes = classesOf(row);
      expect(transitionOf(classes)).toEqual({ 'background-color': '150ms ease' });
      expect(classes).toEqual(
        expect.arrayContaining([
          'hover:bg-zinc-100',
          'dark:hover:bg-white/5',
          'aria-current:bg-zinc-100',
          'dark:aria-current:bg-white/5',
        ]),
      );
    }
  });

  it('the current row turns its name ink and its count zinc-600 (zinc-300 in dark), in 150ms ease', () => {
    const names = openingTags(categoryList, 'span');
    const counts = openingTags(categoryList, 'div');
    expect(names).toHaveLength(4);
    expect(counts).toHaveLength(4);
    for (const name of names) {
      expect(transitionOf(classesOf(name))).toEqual({ color: '150ms ease' });
      expect(classesOf(name)).toEqual(
        expect.arrayContaining(['group-aria-current:text-zinc-900', 'dark:group-aria-current:text-white']),
      );
    }
    for (const count of counts) {
      expect(transitionOf(classesOf(count))).toEqual({ color: '150ms ease' });
      expect(classesOf(count)).toEqual(
        expect.arrayContaining(['group-aria-current:text-zinc-600', 'dark:group-aria-current:text-zinc-300']),
      );
    }
  });

  it('a scroll that moves the mark re-renders the sidebar, never the cards: its state lives in the sidebar component', () => {
    const nav = src.slice(
      src.indexOf('function CategoryNav('),
      src.indexOf('export default function IntegrationsClient('),
    );
    const page = src.slice(src.indexOf('export default function IntegrationsClient('));
    expect(nav).toContain('const [currentCategory, setCurrentCategory] = useState<string | null>(null);');
    expect(nav).toContain('const [categoriesOpen, setCategoriesOpen] = useState(false);');
    expect(page).not.toMatch(/setCurrentCategory|setCategoriesOpen/);
    expect(page).toContain('<CategoryNav ');
  });

  it('marks no row in the server HTML: the line is measured in the browser', () => {
    expect(categoryList).not.toMatch(/\saria-current="/);
  });

  it('keeps the marked row in view by scrolling the list itself, never the page, with a jump under Reduce Motion', () => {
    // which row to mark is markedCategory (lib/scroll-spy.ts, unit-tested in tests/unit/lib/scroll-spy.test.ts); the
    // keep-in-view arithmetic is the shared one there too, as in the blog outline
    expect(src).toContain('scrollToShow(');
    expect(src).toMatch(/\.scrollTo\(\{/);
    expect(src).not.toContain('scrollIntoView');
    expect(src).toContain(
      "behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'",
    );
  });
});

describe('int-phone-categories: below 768px the category box folds into one Categories row', () => {
  const toggle = pick(aside, 'button')[0] ?? '';
  const controls = attrOf(toggle, 'aria-controls') ?? '';
  const fold = pick(aside, 'div', (div) => controls !== '' && attrOf(div, 'id') === controls)[0] ?? '';
  const inner = fold ? (openingTags(aside.slice(aside.indexOf(fold) + fold.length), 'div')[0] ?? '') : '';

  it('the box holds one row button, and it controls the element that holds the category list', () => {
    expect(pick(aside, 'button')).toHaveLength(1);
    expect(controls).not.toBe('');
    expect(pick(aside, 'div', (div) => attrOf(div, 'id') === controls)).toHaveLength(1);
    expect(inner).not.toBe('');
  });

  it('the heading shows from 768px up and the row below 768px, never both', () => {
    // Not max-md:hidden: app/global.css forces that class to display: none below 1024px, for fumadocs.
    expect(classesOf(only(aside, 'h3'))).toEqual(expect.arrayContaining(['hidden', 'md:block']));
    expect(aside).not.toContain('max-md:hidden');
    expect(classesOf(toggle)).toContain('md:hidden');
  });

  it('the row is a closed disclosure button that reads Categories, with no count (the header line has it)', () => {
    expect(attrOf(toggle, 'type')).toBe('button');
    expect(attrOf(toggle, 'aria-expanded')).toBe('false');
    const start = aside.indexOf(toggle) + toggle.length;
    const label = aside
      .slice(start, aside.indexOf('</button>', start))
      .replace(/<[^>]*>/g, '')
      .trim();
    expect(label).toBe('Categories');
  });

  it('the list opens in place under the row: grid rows 0fr to 1fr, 220ms open and 160ms closed, strong ease-out', () => {
    expect(aside.indexOf('<ul')).toBeGreaterThan(aside.indexOf(fold));
    const classes = classesOf(fold);
    expect(classes).toEqual(
      expect.arrayContaining([
        'max-md:grid',
        'max-md:grid-rows-[0fr]',
        'max-md:data-open:grid-rows-[1fr]',
        'max-md:duration-160',
        'max-md:data-open:duration-220',
      ]),
    );
    expect(transitionOf(classes, 'max-md:')).toEqual({
      'grid-template-rows': `160ms ${EASE_OUT}`,
      visibility: `160ms ${EASE_OUT}`,
    });
    expect(attrOf(fold, 'data-open')).toBeUndefined();
    expect(classesOf(inner)).toEqual(expect.arrayContaining(['max-md:min-h-0', 'max-md:overflow-hidden']));
  });

  it('closed, the list takes no tap and no focus; under Reduce Motion it opens at once and fades in', () => {
    expect(classesOf(fold)).toEqual(
      expect.arrayContaining([
        'max-md:invisible',
        'max-md:data-open:visible',
        'motion-reduce:max-md:opacity-0',
        'motion-reduce:max-md:data-open:opacity-100',
      ]),
    );
  });

  it('opened or closed from the keyboard (the row holds the keyboard focus), the list shows and goes at once, and so does the chevron', () => {
    // the phone menu's keyboard-instant approach: the row is a peer, and its keyboard focus ring turns the fold's
    // transition off; important, so it also wins over the Reduce Motion policy's fade
    const start = aside.indexOf(toggle);
    const chevron = only(aside.slice(start, aside.indexOf('</button>', start)), 'svg');
    expect(classesOf(toggle)).toEqual(expect.arrayContaining(['peer', 'group']));
    expect(classesOf(fold)).toContain('max-md:peer-focus-visible:transition-none!');
    expect(classesOf(chevron)).toContain('group-focus-visible:transition-none!');
    // the fold comes right after the row, so the row's state reaches it (~)
    expect(aside.indexOf(fold)).toBeGreaterThan(aside.indexOf('</button>', start));
  });

  it('its chevron turns 180deg in 200ms on the strong ease-out when the row opens', () => {
    const start = aside.indexOf(toggle);
    const chevron = only(aside.slice(start, aside.indexOf('</button>', start)), 'svg');
    expect(classesOf(toggle)).toContain('group');
    expect(classesOf(chevron)).toContain('group-aria-expanded:rotate-180');
    expect(transitionOf(classesOf(chevron))).toEqual({ rotate: `200ms ${EASE_OUT}` });
    expect(attrOf(chevron, 'aria-hidden')).toBe('true');
  });

  it('from 768px up nothing changes: the fold boxes vanish (display: contents) and every class they add acts below 768px', () => {
    for (const tag of [fold, inner]) {
      const classes = classesOf(tag);
      expect(classes).toContain('md:contents');
      const wide = classes.filter(
        (name) => name !== 'md:contents' && !name.startsWith('max-md:') && !name.startsWith('motion-reduce:max-md:'),
      );
      expect(wide).toEqual([]);
    }
    expect(classesOf(only(aside, 'ul')).filter((name) => name.startsWith('max-md:'))).toEqual(['max-md:mt-3']);
  });
});
