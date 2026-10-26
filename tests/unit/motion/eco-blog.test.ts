import postcss, { type Root, type Rule } from 'postcss';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  atRulesAround,
  attrOf,
  block,
  classesOf,
  contrast,
  declsOf,
  elementAt,
  firstTag,
  frame,
  globalCss,
  openingTags,
  outranks,
  palette,
  read,
  rulesFor,
  specificity,
  token,
  transitionOf,
  ungatedHover,
} from './helpers';

// fumadocs' ImageZoom imports its stylesheet, which Node cannot load. This stand-in renders the zoom the way it does
// (node_modules/fumadocs-ui/dist/components/image-zoom.js, pinned below), so the markup is the one the browser gets.
vi.mock('fumadocs-ui/components/image-zoom', async () => {
  const { createElement } = await import('react');
  const { default: Zoom } = await import('react-medium-image-zoom');
  return {
    ImageZoom: ({ children, rmiz, src }: { children: ReactNode; rmiz?: object; src?: string }) =>
      createElement(Zoom, {
        zoomMargin: 20,
        wrapElement: 'span',
        ...rmiz,
        zoomImg: { src, sizes: undefined },
        children,
      }),
  };
});

import { BlogList } from '@/components/blog/blog-list';
import { BlogOutline, keepMarkedInView } from '@/components/blog/blog-outline';
import { ZoomableImage, zoomChange, zoomDialogClass } from '@/components/ui/zoomable-image';

/**
 * Task 19 of the hub motion pass, the blog half: a reading line under the navbar (eco-blog-progress, variant a, an
 * approved layout change), an On this page outline in the post's side column (eco-blog-outline, variant a, an approved
 * layout change), charts that open full size from where they sit (eco-blog-image-zoom, variant b, and X3 for docs
 * images), quiet blog cards (eco-blog-cards, variant a) and blog post meta labels at 4.5:1 in light (X2). Events and
 * grants are in eco-events-grants.test.ts.
 */
const CSS = 'app/global.css';
const POST = 'app/blog/[...slug]/page.tsx';
const OUTLINE = 'app/blog/outline.ts';
const OUTLINE_NAV = 'components/blog/blog-outline.tsx';
const ZOOM = 'components/ui/zoomable-image.tsx';
const BLOG_LIST = 'components/blog/blog-list.tsx';
const DOCS = 'app/docs/[...slug]/page.tsx';
const DOCS_CSS = 'app/docs/styles.css';
const TOUCHED = [CSS, POST, OUTLINE, OUTLINE_NAV, ZOOM, BLOG_LIST, DOCS];
/** This task's blocks in global.css: the file is shared, so other lanes' text never decides this test. */
const BLOCKS = ['eco-blog-progress', 'eco-blog-outline', 'eco-blog-image-zoom'];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const EASE_OUT = 'var(--ease-out)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/* ---------- global.css blocks ---------- */

/** The one rule of `root` for `selector` (either quotes) whose at-rules are exactly `around` (none for a plain rule). */
function ruleFor(root: Root, selector: string, around: string[] = []): Rule {
  const found = rulesFor(selector, { root, anyQuotes: true })
    .filter(({ at }) => at.join('|') === around.join('|'))
    .map(({ rule }) => rule);
  expect(found, `${around.join(' ')} ${selector}`).toHaveLength(1);
  return found[0];
}

const valueOf = (rule: Rule, prop: string) => declsOf(rule).find((decl) => decl.prop === prop)?.value;
const decls = (rule: Rule) =>
  Object.fromEntries(declsOf(rule).map((decl) => [decl.prop, `${decl.value}${decl.important ? ' !important' : ''}`]));
const beats = (a: string, b: string) => outranks(specificity(a), specificity(b));

/* ---------- fixtures ---------- */

const post = (n: number) => ({
  url: `/blog/post-${n}`,
  data: {
    title: `Post ${n}`,
    description: `What post ${n} covers`,
    topics: ['Staking', 'L1'],
    date: '2026-10-01',
    authors: ['AvaxDevelopers'],
  },
  file: { name: `post-${n}.mdx` },
});
const blogHtml = renderToStaticMarkup(createElement(BlogList, { blogs: [post(1), post(2), post(3), post(4)] }));
const blogCards = openingTags(blogHtml, 'a').filter((a) => attrOf(a, 'href')?.startsWith('/blog/'));

const outlineItems = [
  { depth: 2 as const, title: 'Setting up', url: '#setting-up' },
  { depth: 3 as const, title: 'The fix', url: '#the-fix' },
  { depth: 2 as const, title: 'Results', url: '#results' },
];
const outlineHtml = renderToStaticMarkup(createElement(BlogOutline, { items: outlineItems }));
const outlineNav = openingTags(outlineHtml, 'nav')[0] ?? '';

describe('every file of the blog half', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = path === CSS ? BLOCKS.map((id) => block(id)).join('\n') : read(path);
    expect(src, path).not.toBe('');
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(BLOCKS)('the %s block in global.css exists and gates every hover', (id) => {
    const text = block(id);
    expect(text, `a comment-headed block for ${id}`).not.toBe('');
    expect(ungatedHover(text)).toBe(0);
  });
});

describe('eco-blog-progress: a 2px ink line under the navbar fills as the post is read, driven by the scroll', () => {
  const css = postcss.parse(block('eco-blog-progress'));
  const SUPPORTS = '@supports (animation-timeline: view())';

  it('the post renders the line inside its article, ink in light and zinc-100 in dark, hidden from assistive tech', () => {
    const src = read(POST);
    const article = src.match(/<article\s+className="([^"]*)"/)?.[1] ?? '';
    expect(article.split(' ')).toContain('blog-article');
    const inside = src.slice(src.indexOf('<article'), src.indexOf('</article>'));
    expect(inside).toMatch(/<div aria-hidden="true" className="blog-reading-line bg-zinc-900 dark:bg-zinc-100" \/>/);
  });

  it('has no script: the post page is a server component that adds no listener, the browser runs the line', () => {
    const src = read(POST);
    expect(src).not.toMatch(/^['"]use client['"]/m);
    expect(src).not.toMatch(/addEventListener|useEffect|onScroll/);
  });

  it('the article is a view timeline, and the line is a fixed 2px bar at the navbar edge that grows from the left', () => {
    expect(valueOf(ruleFor(css, '.blog-article', [SUPPORTS]), 'view-timeline')).toBe('--blog-read block');
    expect(decls(ruleFor(css, '.blog-reading-line', [SUPPORTS]))).toMatchObject({
      display: 'block',
      position: 'fixed',
      // the navbar (--site-nav-h, 57px) sits at the banner's height (#nd-nav's own top), so the line sits right under it
      top: 'calc(var(--fd-banner-height, 0px) + var(--site-nav-h))',
      left: '0',
      right: '0',
      height: '2px',
      'pointer-events': 'none',
      'transform-origin': 'left',
    });
  });

  it('scaleX runs 0 to 1, linear, over the contain range of the article: from its top at the top of the window to its end at the bottom', () => {
    const line = ruleFor(css, '.blog-reading-line', [SUPPORTS]);
    expect(valueOf(line, 'animation')).toBe('blog-read linear both');
    expect(valueOf(line, 'animation-timeline')).toBe('--blog-read');
    expect(valueOf(line, 'animation-range')).toBe('contain');
    // the animation shorthand resets animation-timeline, so the timeline has to come after it
    const props = declsOf(line).map((decl) => decl.prop);
    expect(props.indexOf('animation-timeline')).toBeGreaterThan(props.indexOf('animation'));
    expect(frame('blog-read', 'from')).toEqual({ transform: 'scaleX(0)' });
    expect(frame('blog-read', 'to')).toEqual({ transform: 'scaleX(1)' });
  });

  it('a browser without scroll-driven animations shows no line, and Reduce Motion keeps it as it is', () => {
    expect(valueOf(ruleFor(css, '.blog-reading-line'), 'display')).toBe('none');
    const reduced: string[] = [];
    css.walkAtRules('media', (media) => {
      if (media.params.includes('prefers-reduced-motion')) reduced.push(media.toString());
    });
    expect(reduced).toEqual([]);
  });
});

describe('eco-blog-outline: long posts list their headings under the meta, and the one being read turns ink', () => {
  it('the post builds the list from its table of contents and puts it last in the meta column', () => {
    const src = read(POST);
    expect(src).toMatch(/import \{ blogOutline \} from ['"]@\/app\/blog\/outline['"];/);
    expect(src).toMatch(/const outline = blogOutline\(page\.data\.toc\);/);
    const meta = src.slice(
      src.indexOf('<div className="flex flex-col gap-4 border-l p-4 text-sm">'),
      src.indexOf('</article>'),
    );
    expect(meta.indexOf('{outline && <BlogOutline items={outline} />}')).toBeGreaterThan(meta.indexOf('Topics'));
  });

  it('is a nav named On this page, sticky 88px down, shown from 1024px up only', () => {
    expect(attrOf(outlineNav, 'aria-label')).toBe('On this page');
    expect(classesOf(outlineNav)).toEqual(
      expect.arrayContaining(['blog-outline', 'sticky', 'top-[88px]', 'mt-2', 'hidden', 'lg:block']),
    );
    // not max-md:hidden or max-lg:hidden: app/global.css re-points those classes for fumadocs
    expect(classesOf(outlineNav).filter((name) => /^max-(sm|md|lg|xl|2xl):/.test(name))).toEqual([]);
  });

  it('labels the list like the meta labels above it, and indents the h3 entries under their h2', () => {
    expect(classesOf(openingTags(outlineHtml, 'p')[0] ?? '')).toEqual(
      expect.arrayContaining(['mb-2', 'text-zinc-600', 'dark:text-muted-foreground']),
    );
    expect(outlineHtml).toContain('>On this page</p>');
    expect(classesOf(openingTags(outlineHtml, 'ol')[0] ?? '')).toEqual(
      expect.arrayContaining(['grid', 'gap-2', 'border-l', 'border-zinc-200', 'pl-3', 'dark:border-zinc-800']),
    );
    expect(openingTags(outlineHtml, 'li').map((li) => classesOf(li))).toEqual([[], ['pl-3'], []]);
  });

  it('each entry links its heading in zinc-600 (zinc-400 in dark) and turns ink when current or hovered', () => {
    const links = openingTags(outlineHtml, 'a');
    expect(links.map((a) => attrOf(a, 'href'))).toEqual(['#setting-up', '#the-fix', '#results']);
    for (const link of links) {
      expect(classesOf(link)).toEqual(
        expect.arrayContaining([
          'block',
          'leading-[1.35]',
          'text-zinc-600',
          'dark:text-zinc-400',
          'aria-current:text-zinc-950',
          'dark:aria-current:text-zinc-50',
          'hover:text-zinc-950',
          'dark:hover:text-zinc-50',
        ]),
      );
      // the transition lives in global.css, where it outranks the global nav link rule
      expect(classesOf(link).filter((name) => name.startsWith('transition') || name.startsWith('duration'))).toEqual(
        [],
      );
    }
  });

  it('marks the current entry with aria-current="true", and none in the server HTML', () => {
    expect(outlineHtml).not.toMatch(/\saria-current="/);
    // "true" on purpose: the aria-current: classes match only "true", and "page" takes the navbar's red underline
    expect(read(OUTLINE_NAV)).toContain("aria-current={item.url === current ? 'true' : undefined}");
  });

  it('the links name their own transition, a colour change in 150ms ease, and outrank the global nav link rule', () => {
    const rule = ruleFor(postcss.parse(block('eco-blog-outline')), '.blog-outline a');
    expect(rule.parent?.type).toBe('root');
    expect(decls(rule)).toEqual({
      'transition-property': 'color',
      'transition-duration': '150ms',
      'transition-timing-function': 'ease',
    });
    // the rule it has to beat: Task 2's `nav a, nav button` transition, unlayered like this one
    const navLinks = globalCss.nodes.find(
      (node): node is Rule => node.type === 'rule' && node.selectors.join() === 'nav a,nav button',
    );
    expect(navLinks && valueOf(navLinks, 'transition-property')).toBeDefined();
    expect(beats('.blog-outline a', 'nav a')).toBe(true);
  });

  it('follows the reading with the shared scroll spy: the last heading past a line 120px under the navbar', () => {
    const src = read(OUTLINE_NAV);
    expect(src).toMatch(/import \{ activeCategory, scrollToShow \} from ['"]@\/lib\/scroll-spy['"];/);
    expect(src).toMatch(/const READING_LINE = 120;/);
    expect(src).toContain('activeCategory(headings, window.scrollY, navbar + READING_LINE)');
    expect(src).toContain("window.addEventListener('scroll', schedule, { passive: true });");
    expect(src).toContain('cancelAnimationFrame(frame);');
  });

  it('a list taller than the window below its sticky top scrolls on its own; a wheel over it still scrolls the page', () => {
    // capped at the window below the 88px sticky top
    expect(classesOf(outlineNav)).toEqual(expect.arrayContaining(['max-h-[calc(100dvh-88px)]', 'overflow-y-auto']));
    // no overscroll containment: Chromium then stops a wheel over the list even when the list fits, and the page
    // would not scroll under the pointer
    expect(classesOf(outlineNav)).not.toContain('overscroll-contain');
    // 4px of room inside the scroll box for the 2px focus ring and its 2px offset, so the scroll edge does not cut it;
    // the negative margin gives the room back, so the label and links sit where they did and a short list looks the same
    const spacing = classesOf(outlineNav).filter((name) => /^-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-/.test(name));
    expect(spacing.sort()).toEqual(['-mx-1', 'mt-2', 'pb-1', 'px-1']);
  });

  /** A stub outline list 812px tall, scrolled to `scrollTop`, its marked entry `entry` px down its content (or none),
      with the pointer over it or not. Records each scrollTo. */
  function outlineList({ hovered = false, entry = 900 as number | null, scrollTop = 0 } = {}) {
    const calls: ScrollToOptions[] = [];
    const LIST_TOP = 88;
    const marked =
      entry === null
        ? null
        : { getBoundingClientRect: () => ({ top: LIST_TOP + entry - scrollTop }), offsetHeight: 35 };
    const list = {
      matches: (selector: string) => selector === ':hover' && hovered,
      querySelector: (selector: string) => (selector === '[aria-current="true"]' ? marked : null),
      getBoundingClientRect: () => ({ top: LIST_TOP }),
      scrollTop,
      clientHeight: 812,
      scrollTo: (options: ScrollToOptions) => calls.push(options),
    };
    return { list: list as unknown as HTMLElement, calls };
  }

  it('keeps the entry being read in view by scrolling the list itself, never the page, with a jump under Reduce Motion', () => {
    const below = outlineList({ entry: 900 });
    keepMarkedInView(below.list, false);
    expect(below.calls).toEqual([{ top: 900 - 812 / 3, behavior: 'smooth' }]);
    const reduced = outlineList({ entry: 900 });
    keepMarkedInView(reduced.list, true);
    expect(reduced.calls).toEqual([{ top: 900 - 812 / 3, behavior: 'auto' }]);
    expect(read(OUTLINE_NAV)).not.toContain('scrollIntoView');
  });

  it('holds while the pointer is over the list: a wheel there scrolls the list, then the page, and must not be pulled back', () => {
    // measured on granite-upgrade: once the page moved, keep-in-view scrolled the list back to the marked entry, so
    // with the pointer over the outline the wheels alternated between the list and the page
    const over = outlineList({ hovered: true, entry: 900 });
    keepMarkedInView(over.list, false);
    expect(over.calls).toEqual([]);
    // the pointer gone, the next mark scrolls the list again
    const left = outlineList({ hovered: false, entry: 900 });
    keepMarkedInView(left.list, false);
    expect(left.calls).toHaveLength(1);
  });

  it('a list that shows its marked entry, or marks none, never moves', () => {
    const shown = outlineList({ entry: 400 });
    keepMarkedInView(shown.list, false);
    expect(shown.calls).toEqual([]);
    const none = outlineList({ entry: null });
    keepMarkedInView(none.list, false);
    expect(none.calls).toEqual([]);
    expect(() => keepMarkedInView(null, false)).not.toThrow();
  });

  it('runs whenever the marked entry changes, with the Reduce Motion setting of the moment', () => {
    expect(read(OUTLINE_NAV)).toMatch(
      /useEffect\(\s*\(\) =>\s*keepMarkedInView\(listRef\.current, window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\),\s*\[current\],\s*\);/,
    );
  });
});

describe('eco-blog-image-zoom and X3: a chart opens full size from where it sits, and goes back', () => {
  const css = () => postcss.parse(block('eco-blog-image-zoom'));
  const DIALOG = '.zoomable-image';
  // react-medium-image-zoom moves the image back one render before it hides the backdrop, so the backdrop's state
  // cannot tell a close from an open: the component marks the close on the dialog
  const OUT = '.zoomable-image.zoomable-image-out';
  const INSTANT = '.zoomable-image.zoomable-image-instant';
  const OVERLAY = '[data-rmiz-modal-overlay]';
  const IMG = '[data-rmiz-modal-img]';
  const HIDDEN_IMG = `[data-rmiz-modal-overlay='hidden'] + [data-rmiz-modal-content] ${IMG}`;
  const BUTTON = '[data-rmiz-ghost] > [data-rmiz-btn-zoom]';

  it('blog posts and docs pages render their images through the one zoomable image', () => {
    const blog = read(POST);
    expect(blog).toMatch(/import \{ ZoomableImage \} from ['"]@\/components\/ui\/zoomable-image['"];/);
    expect(blog).toMatch(/\bimg: ZoomableImage,/);
    const docs = read(DOCS);
    expect(docs).toMatch(/import \{ ZoomableImage \} from ['"]@\/components\/ui\/zoomable-image['"];/);
    expect(docs).toMatch(/\bimg: ZoomableImage,/);
    expect(docs).not.toMatch(/<img\b/);
  });

  it('wraps the image in fumadocs ImageZoom, which zooms a copy from the image box by transform (FLIP)', () => {
    const stock = postcss.parse(read('node_modules/fumadocs-ui/dist/components/image-zoom.css'));
    expect(valueOf(ruleFor(stock, IMG), 'transform-origin')).toBe('0 0');
    // the stand-in this file renders with: fumadocs passes the same options, then the image's src to zoom into
    expect(read('node_modules/fumadocs-ui/dist/components/image-zoom.js')).toContain(
      'zoomMargin: 20, wrapElement: "span", ...rmiz, zoomImg: {',
    );
    // the block keeps that origin: it only retimes the zoom
    css().walkDecls('transform-origin', (decl) => {
      throw new Error(`the block sets transform-origin: ${decl.toString()}`);
    });
    const html = renderToStaticMarkup(
      createElement(ZoomableImage, { src: '/images/chart.png', alt: 'Chart', width: 1884, height: 716 }),
    );
    // React 19 hoists a preload for the image in front (a plain <img> got the same); then the zoom's wrapper
    expect(html).toMatch(/^(<link [^>]*>)?<span aria-owns="rmiz-modal-" data-rmiz=""><span data-rmiz-content="[^"]*"/);
    expect(openingTags(html, 'img')).toEqual(['<img src="/images/chart.png" alt="Chart" width="1884" height="716"/>']);
  });

  it('passes an MDX srcset on as React 19 srcSet (the fix docs images had)', () => {
    const props = { src: '/a.png', alt: 'A', srcset: '/a.png 1x, /a@2x.png 2x' };
    const html = renderToStaticMarkup(createElement(ZoomableImage, props));
    expect(openingTags(html, 'img')).toEqual(['<img src="/a.png" alt="A" srcSet="/a.png 1x, /a@2x.png 2x"/>']);
  });

  it('a change from the keyboard runs at once: Escape, or Enter or Space on the zoom button; a pointer, a scroll or a swipe animates', () => {
    // a key press on a button sends a click with no pointer count (detail 0)
    expect(zoomChange(true, { type: 'click', detail: 0 })).toEqual({ zoomed: true, instant: true });
    expect(zoomChange(true, { type: 'click', detail: 1 })).toEqual({ zoomed: true, instant: false });
    expect(zoomChange(false, { type: 'keydown' })).toEqual({ zoomed: false, instant: true });
    for (const event of [{ type: 'click', detail: 1 }, { type: 'wheel' }, { type: 'touchmove' }, { type: 'close' }]) {
      expect(zoomChange(false, event), event.type).toEqual({ zoomed: false, instant: false });
    }
    expect(zoomDialogClass({ zoomed: true, instant: false })).toBe('zoomable-image');
    expect(zoomDialogClass({ zoomed: true, instant: true })).toBe('zoomable-image zoomable-image-instant');
    expect(zoomDialogClass({ zoomed: false, instant: false })).toBe('zoomable-image zoomable-image-out');
    expect(zoomDialogClass({ zoomed: false, instant: true })).toBe(
      'zoomable-image zoomable-image-out zoomable-image-instant',
    );
    // the mark comes with the zoom change itself, in the render that moves the image
    const src = read(ZOOM);
    expect(src).toContain('classDialog: zoomDialogClass(change)');
    expect(src).toContain('onZoomChange: (zoomed, { event }) => setChange(zoomChange(zoomed, event))');
  });

  it('the keyboard reaches the zoom: the library button over the image is focusable, unseen, and rings the image', () => {
    // react-medium-image-zoom renders a button laid over the image box; a key press activates it
    const lib = read('node_modules/react-medium-image-zoom/dist/Controlled.js');
    expect(lib).toContain('"data-rmiz-ghost": "", style: styleGhost');
    expect(lib).toContain('"data-rmiz-btn-zoom": "", onClick: handleZoom, type: "button"');
    // fumadocs hides it; this block shows it, filling the image box, with nothing to see and no pointer hits
    const stock = postcss.parse(read('node_modules/fumadocs-ui/dist/components/image-zoom.css'));
    expect(valueOf(ruleFor(stock, '[data-rmiz-btn-zoom]'), 'display')).toBe('none');
    expect(beats(BUTTON, '[data-rmiz-btn-zoom]')).toBe(true);
    expect(decls(ruleFor(css(), BUTTON))).toEqual({
      display: 'block',
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      margin: '0',
      padding: '0',
      border: '0',
      background: 'transparent',
      color: 'transparent',
      'pointer-events': 'none',
    });
    expect(decls(ruleFor(css(), `${BUTTON} > svg`))).toEqual({ display: 'none' });
    // the site focus ring (site-focus-ring) draws around it, so the block leaves the outline alone
    css().walkDecls(/^outline/, (decl) => {
      throw new Error(`the block styles the focus ring: ${decl.toString()}`);
    });
  });

  it('on docs pages the ring draws just inside the image box: a docs paragraph scrolls sideways and clips one outside it', () => {
    const docs = postcss.parse(read(DOCS_CSS));
    // why: every .prose child on a docs page scrolls sideways, and a scroll box clips what reaches past it; an image
    // that fills its paragraph lost the ring's sides (2px wide, 2px out: 4px cut on each side, measured at 1440)
    const clipping: Rule[] = [];
    docs.walkRules((rule) => {
      const prose = rule.selectors.some((selector) => selector.startsWith('body[data-layout="docs"] .prose > *'));
      if (prose && valueOf(rule, 'overflow-x') === 'auto') clipping.push(rule);
    });
    expect(clipping).toHaveLength(1);
    // so there the ring sits inside the box: 2px wide, its outer edge on the image's edge
    const ring = ruleFor(docs, `body[data-layout="docs"] ${BUTTON}:focus-visible`);
    expect(decls(ring)).toEqual({ 'outline-offset': '-2px' });
    // unlayered, so it wins over the site ring in the base layer (outline-offset: 2px); blog images keep that ring
    expect(atRulesAround(ring)).toEqual([]);
    docs.walkRules((rule) => {
      if (rule !== ring) expect(rule.selector).not.toContain('data-rmiz-btn-zoom');
    });
    // and the zoom block says so
    const comment = (
      globalCss.nodes.find((node) => node.type === 'comment' && node.text.startsWith('eco-blog-image-zoom:')) as
        | { text: string }
        | undefined
    )?.text.replace(/\s+/g, ' ');
    expect(comment).toContain('the site focus ring draws around the image (on docs pages just inside it');
  });

  it('opens in 250ms and goes back in 200ms, image and backdrop together, on the strong ease-out', () => {
    const root = css();
    expect(decls(ruleFor(root, `${DIALOG} ${OVERLAY}`))).toEqual({ transition: `background-color 250ms ${EASE_OUT}` });
    expect(decls(ruleFor(root, `${DIALOG} ${IMG}`))).toEqual({ transition: `transform 250ms ${EASE_OUT}` });
    const out = ruleFor(root, `${OUT} ${OVERLAY}`);
    expect(out.selectors).toEqual([`${OUT} ${OVERLAY}`, `${OUT} ${IMG}`]);
    expect(decls(out)).toEqual({ 'transition-duration': '200ms' });
  });

  it('Reduce Motion: no travel; the image and its backdrop fade in over 150ms in place and out over 120ms', () => {
    const root = css();
    const around = [`@media ${REDUCE}`];
    // opening: the image jumps to its enlarged place (transform is not transitioned) and fades in there with the backdrop
    expect(decls(ruleFor(root, `${DIALOG} ${OVERLAY}`, around))).toEqual({ 'transition-duration': '150ms !important' });
    expect(decls(ruleFor(root, `${DIALOG} ${IMG}`, around))).toEqual({
      'transition-property': 'opacity !important',
      'transition-duration': '150ms !important',
    });
    // the enlarged image shows only while the backdrop does
    expect(decls(ruleFor(root, `${DIALOG} ${HIDDEN_IMG}`, around))).toEqual({ opacity: '0' });
    // closing: the image fades out where it is in 120ms, and jumps back to its place only once it is invisible
    expect(decls(ruleFor(root, `${OUT} ${OVERLAY}`, around))).toEqual({ 'transition-duration': '120ms !important' });
    expect(decls(ruleFor(root, `${OUT} ${IMG}`, around))).toEqual({
      'transition-property': 'opacity, transform !important',
      'transition-duration': '120ms, 0s !important',
      'transition-delay': '0s, 120ms !important',
    });
  });

  it('a change from the keyboard plays nothing, open or close, Reduce Motion included: its rule outranks every other one', () => {
    const root = css();
    const rule = ruleFor(root, `${INSTANT} ${OVERLAY}`);
    expect(rule.selectors).toEqual([`${INSTANT} ${OVERLAY}`, `${INSTANT} ${IMG}`]);
    // 1ms, not none: react-medium-image-zoom moves on, and closes the dialog, on the transitionend
    expect(decls(rule)).toEqual({ 'transition-duration': '1ms !important', 'transition-delay': '0s !important' });
    // it comes last and no rule that times the zoom is more specific, so it wins every tie, the !important ones included
    const timing: Rule[] = [];
    root.walkRules((other) => {
      if (other !== rule && declsOf(other).some((decl) => decl.prop.startsWith('transition'))) timing.push(other);
    });
    expect(timing.length).toBeGreaterThan(0);
    for (const other of timing) {
      expect(other.source?.start?.offset ?? 0).toBeLessThan(rule.source?.start?.offset ?? 0);
      for (const selector of other.selectors) expect(beats(selector, `${INSTANT} ${IMG}`), selector).toBe(false);
    }
  });

  it('outranks fumadocs own timings, its Reduce Motion 0.01ms included, from outside any cascade layer', () => {
    css().walkRules((rule) => {
      expect(atRulesAround(rule).filter((at) => at.startsWith('@layer'))).toEqual([]);
      for (const selector of rule.selectors) expect(beats(selector, IMG), selector).toBe(true);
    });
  });
});

describe('eco-blog-cards: one quiet hover, the border and title colour; only the arrow moves', () => {
  it('renders the featured post and the grid', () => {
    expect(blogCards).toHaveLength(4);
  });

  it('a card fades its border in 150ms ease and presses to 0.985 in 160ms on the strong ease-out', () => {
    for (const card of blogCards) {
      const classes = classesOf(card);
      expect(transitionOf(classes)).toEqual({ 'border-color': '150ms ease', scale: `160ms ${EASE_OUT}` });
      expect(classes).toEqual(
        expect.arrayContaining([
          'active:scale-[0.985]',
          'motion-reduce:active:scale-100',
          'motion-reduce:active:opacity-85',
        ]),
      );
    }
  });

  it('no lift, no shadow bloom and no gradient wash: the border and the title colour carry the hover', () => {
    for (const card of blogCards) {
      const classes = classesOf(card);
      expect(classes.filter((name) => /^hover:(-?translate|shadow)/.test(name))).toEqual([]);
      expect(classes.some((name) => name.startsWith('hover:border-'))).toBe(true);
      const inner = elementAt(blogHtml, card, 'a');
      expect(openingTags(inner, 'div').filter((div) => classesOf(div).includes('inset-0'))).toEqual([]);
      const title = firstTag(inner, 'h3') || firstTag(inner, 'h4');
      expect(classesOf(title)).toEqual(expect.arrayContaining(['transition-colors', 'group-hover:text-primary']));
    }
  });

  it('the Read label holds still; its arrow alone slides 3px in 200ms on the strong ease-out, only when motion is welcome', () => {
    for (const card of blogCards) {
      const inner = elementAt(blogHtml, card, 'a');
      // the last text-primary span holds the label and its arrow (the featured card's Latest badge comes first)
      const label =
        openingTags(inner, 'span')
          .filter((span) => classesOf(span).includes('text-primary'))
          .at(-1) ?? '';
      expect(label).not.toBe('');
      expect(classesOf(label).filter((name) => /transition|translate/.test(name))).toEqual([]);
      const classes = classesOf(openingTags(inner, 'svg').at(-1) ?? '');
      expect(transitionOf(classes)).toEqual({ translate: `200ms ${EASE_OUT}` });
      expect(classes).toContain('motion-safe:group-hover:translate-x-[3px]');
      expect(classes.filter((name) => name.startsWith('group-hover:translate'))).toEqual([]);
    }
  });
});

describe('X2: the blog post meta labels read at 4.5:1 in light; dark stays as it was', () => {
  const LABEL = 'text-zinc-600 dark:text-muted-foreground';

  it('Written by, On and Topics use zinc-600 in light and keep the muted foreground in dark', () => {
    const src = read(POST);
    for (const label of ['Written by', 'On', 'Topics']) {
      const classes = src.match(new RegExp(`<p className="([^"]*)">${label}</p>`))?.[1] ?? '';
      expect(classes, label).toContain(LABEL);
      expect(
        classes.split(' ').filter((name) => name === 'text-muted-foreground'),
        label,
      ).toEqual([]);
    }
  });

  it('zinc-600 on the light ground passes 4.5:1, and the dark label colour is untouched and passes', () => {
    expect(contrast(palette('zinc-600'), token('background', 'light'))).toBeGreaterThanOrEqual(4.5);
    // today's light label: the muted foreground at 4.37:1
    expect(contrast(token('muted-foreground', 'light'), token('background', 'light'))).toBeLessThan(4.5);
    expect(contrast(token('muted-foreground', 'dark'), token('background', 'dark'))).toBeGreaterThanOrEqual(4.5);
  });

  /** fumadocs' accent (neutral theme, the chip's fill): a translucent grey, as [grey 0-255, alpha]. */
  function accent(theme: 'light' | 'dark'): [number, number] {
    const css = read('node_modules/fumadocs-ui/css/neutral.css');
    const scope = css.slice(theme === 'light' ? css.indexOf('@theme') : css.indexOf('.dark'));
    const match = scope.match(/--color-fd-accent: hsla\(0, 0%, ([\d.]+)%, ([\d.]+)%\);/);
    if (!match) throw new Error(`no grey --color-fd-accent for ${theme} in fumadocs-ui/css/neutral.css`);
    return [(Number(match[1]) / 100) * 255, Number(match[2]) / 100];
  }
  /** The chip's fill as painted: the accent over the page ground. */
  const chipGround = (theme: 'light' | 'dark') => {
    const [grey, alpha] = accent(theme);
    return token('background', theme).map((v) => Math.round(grey * alpha + v * (1 - alpha))) as [
      number,
      number,
      number,
    ];
  };

  it('the topic chips read 4.5:1 in both themes: zinc-600 on the chip fill in light, the muted foreground in dark', () => {
    const chip = read(POST).match(/<span\s+key=\{item\}\s+className="([^"]*)"/)?.[1] ?? '';
    expect(chip.split(' ')).toEqual(expect.arrayContaining(['rounded-full', 'bg-fd-accent', 'text-zinc-600']));
    expect(chip.split(' ')).toContain('dark:text-muted-foreground');
    expect(chip.split(' ').filter((name) => name === 'text-muted-foreground')).toEqual([]);
    expect(contrast(palette('zinc-600'), chipGround('light'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('muted-foreground', 'dark'), chipGround('dark'))).toBeGreaterThanOrEqual(4.5);
    // what the chips read before: the muted foreground on the light fill, 3.71:1 measured on the page
    expect(contrast(token('muted-foreground', 'light'), chipGround('light'))).toBeLessThan(4.5);
  });
});
