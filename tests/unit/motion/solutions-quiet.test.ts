import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { block, read, ungatedHover } from './helpers';

/** The links the Solutions shell renders, with the props a click hands to Next (recorded by the next/link stand-in). */
const nav = vi.hoisted(() => ({
  pathname: '/solutions',
  links: [] as { href: string; transitionTypes?: string[]; onNavigate?: () => void }[],
}));
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({
      href,
      transitionTypes,
      onNavigate,
      scroll: _scroll,
      children,
      ...rest
    }: {
      href: string;
      transitionTypes?: string[];
      onNavigate?: () => void;
      scroll?: boolean;
      children?: ReactNode;
    }) => {
      nav.links.push({ href, transitionTypes, onNavigate });
      return h('a', { href, ...rest }, children);
    },
  };
});
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => nav.pathname,
}));
// Next's App Router runs React's canary, which exports ViewTransition; the stable react these tests load does not.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  ViewTransition: ({ children }: { children?: ReactNode }) => children,
}));

/**
 * Task 8 of the hub motion pass, the Solutions pages: quiet labels at a readable contrast with named transitions
 * (sol-quiet-contrast), SMIL drawings that hold still under Reduce Motion and pause off screen (sol-diagrams-rest), and
 * the subnav's red underline travelling to the tab opened while the page cross-fades (sol-tab-glide). Specs:
 * .scratch/hub-motion/proposals/30-solutions.js.
 */
const SHELL = 'components/landing-v2/SolutionsShell.tsx';
const PILLAR = 'components/landing-v2/PillarPage.tsx';
const USE_CASES = 'components/landing-v2/UseCases.tsx';
const INDEX = 'components/landing-v2/SolutionsIndex.tsx';
const USE_CASE_DIAGRAMS = 'components/landing-v2/UseCaseDiagrams.tsx';
const PRIVACY_DIAGRAMS = 'components/landing-v2/PrivacyModelDiagrams.tsx';
const OVERLAYS = 'components/landing-v2/PhotoOverlays.tsx';
const SMIL = 'components/landing-v2/smil-rest.ts';
const TOUCHED = [SHELL, PILLAR, USE_CASES, INDEX, USE_CASE_DIAGRAMS, PRIVACY_DIAGRAMS, OVERLAYS, SMIL];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
/** A light-theme zinc class: not behind a variant such as dark: or hover:. */
const light = (shade: number) => new RegExp(`(?<![\\w:-])text-zinc-${shade}\\b`);

/** The declarations of the rule whose selector list holds `selector`, outside @media or inside the Reduce Motion one. */
function decls(css: string, selector: string, reduced = false): Record<string, string> {
  const found: Record<string, string> = {};
  postcss.parse(css).walkRules((rule: Rule) => {
    const inReduce =
      rule.parent?.type === 'atrule' && (rule.parent as AtRule).params.includes('prefers-reduced-motion');
    if (inReduce !== reduced) return;
    if (!rule.selectors.map((s) => s.replace(/'/g, '"')).includes(selector)) return;
    rule.walkDecls((decl: Declaration) => {
      found[decl.prop] = decl.important ? `${decl.value} !important` : decl.value;
    });
  });
  return found;
}

describe('sol-quiet-contrast: quiet labels one step darker in light and lighter in dark, named transitions', () => {
  it('the inactive subnav tabs are zinc-500, zinc-400 in dark', () => {
    const src = read(SHELL);
    expect(src).toContain('"text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"');
    expect(src).not.toMatch(light(400));
  });

  it("a section heading's quiet second line is zinc-500 in both themes (large text, 3:1)", () => {
    expect(read(PILLAR)).toMatch(/<MaskText delay=\{0\.08\} className="text-zinc-500">\s*\{rest\}/);
  });

  it('the resource index numbers, kinds and counts are zinc-500, zinc-400 in dark', () => {
    const src = read(PILLAR);
    expect(src).toContain(
      '<span className="text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{pad2(group.links.length)}',
    );
    expect(src).toContain(
      '<span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{pad2(n)}',
    );
    expect(src).toMatch(
      /<span className="text-\[12px\] text-zinc-500 [^"]*dark:text-zinc-400">\s*\{kindOf\(link\.href\)\}/,
    );
  });

  it('the use-case stack line and the index step numbers are zinc-500, zinc-400 in dark', () => {
    expect(read(USE_CASES)).toContain(
      '<p className="mt-5 font-mono text-[11px] tracking-[0.08em] text-zinc-500 dark:text-zinc-400">{useCase.stack}</p>',
    );
    expect(read(INDEX)).toContain(
      '<span className="text-zinc-500 dark:text-zinc-400">{String(i + 1).padStart(2, "0")}</span>',
    );
  });

  it('no quiet label is left on zinc-400 in light, and the Next arrow is zinc-500 in both themes', () => {
    for (const path of [SHELL, PILLAR, USE_CASES]) expect(read(path), path).not.toMatch(light(400));
    const src = read(PILLAR);
    expect(src).not.toMatch(light(300));
    expect(src).not.toContain('dark:text-zinc-600');
    expect(src).toMatch(/<ArrowRight className="h-8 w-8 shrink-0 text-zinc-500 [^"]*group-hover:text-\[#E6212F\]"/);
  });

  it('the hover moves name what they animate: opacity 200ms ease, translate and scale 200ms on the strong ease-out', () => {
    const src = read(PILLAR);
    const fadeAndShift = '[transition:opacity_200ms_ease,translate_200ms_var(--ease-out)]';
    // the kind label leaves and the arrow arrives
    expect(src.split(fadeAndShift)).toHaveLength(3);
    expect(src).toContain('[transition:translate_200ms_var(--ease-out)] group-hover:translate-x-1');
    expect(src).toContain('[transition:scale_200ms_var(--ease-out)] group-hover:scale-y-100');
    expect(src).toContain('[transition:color_150ms_ease,translate_200ms_var(--ease-out)] group-hover:translate-x-2');
    expect(src).not.toContain('transition-transform duration-300 group-hover:scale-y-100');
    expect(src).not.toContain('transition-transform duration-300 group-hover:translate-x-1 md:text-[19px]');
  });
});

describe('sol-diagrams-rest: SMIL drawings hold still under Reduce Motion and pause off screen', () => {
  type Entry = { isIntersecting: boolean };
  class FakeObserver {
    static made: FakeObserver[] = [];
    observed: unknown[] = [];
    disconnected = false;
    constructor(private readonly callback: (entries: Entry[]) => void) {
      FakeObserver.made.push(this);
    }
    observe(target: unknown) {
      this.observed.push(target);
    }
    disconnect() {
      this.disconnected = true;
    }
    fire(isIntersecting: boolean) {
      this.callback([{ isIntersecting }]);
    }
  }
  type Listener = () => void;
  function fakeMedia(matches: boolean) {
    const listeners = new Set<Listener>();
    return {
      query: '',
      matches,
      listeners,
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
      flip(next: boolean) {
        this.matches = next;
        listeners.forEach((listener) => listener());
      },
    };
  }
  function fakeSvg() {
    const calls: string[] = [];
    return {
      calls,
      setCurrentTime: (seconds: number) => calls.push(`seek ${seconds}`),
      pauseAnimations: () => calls.push('pause'),
      unpauseAnimations: () => calls.push('play'),
    };
  }
  async function mount(reduce: boolean) {
    FakeObserver.made = [];
    const media = fakeMedia(reduce);
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', (query: string) => Object.assign(media, { query }));
    const { restSmil, SMIL_STILL } = await import('@/components/landing-v2/smil-rest');
    const svg = fakeSvg();
    const cleanup = restSmil(svg as unknown as SVGSVGElement);
    return { svg, media, observer: FakeObserver.made[0], cleanup, SMIL_STILL };
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('under Reduce Motion a drawing holds on the frame at 1.4 s, as the photo overlays did', async () => {
    const { svg, media, SMIL_STILL } = await mount(true);
    expect(SMIL_STILL).toBe(1.4);
    expect(media.query).toBe('(prefers-reduced-motion: reduce)');
    expect(svg.calls).toEqual(['seek 1.4', 'pause']);
  });

  it('a drawing pauses while off screen and plays on from where it stopped', async () => {
    const { svg, observer } = await mount(false);
    expect(observer.observed).toEqual([svg]);
    svg.calls.length = 0;
    observer.fire(false);
    expect(svg.calls).toEqual(['pause']);
    observer.fire(true);
    expect(svg.calls).toEqual(['pause', 'play']);
  });

  it('the media-query listener follows the setting while the page is open', async () => {
    const { svg, media, observer } = await mount(false);
    svg.calls.length = 0;
    media.flip(true);
    expect(svg.calls).toEqual(['seek 1.4', 'pause']);
    media.flip(false);
    expect(svg.calls.at(-1)).toBe('play');
    observer.fire(false);
    media.flip(true);
    media.flip(false);
    // off screen, turning Reduce Motion off leaves it paused
    expect(svg.calls.at(-1)).toBe('pause');
  });

  it('unmounting disconnects the observer, removes the listener and lets the drawing run', async () => {
    const { svg, media, observer, cleanup } = await mount(false);
    expect(media.listeners.size).toBe(1);
    expect(typeof cleanup).toBe('function');
    cleanup?.();
    expect(observer.disconnected).toBe(true);
    expect(media.listeners.size).toBe(0);
    expect(svg.calls.at(-1)).toBe('play');
  });

  it('every use-case and privacy drawing, and every photo overlay, takes the hold as its ref', () => {
    for (const path of [USE_CASE_DIAGRAMS, PRIVACY_DIAGRAMS]) {
      const src = read(path);
      // their importers (UseCases.tsx, PillarPage.tsx) are client modules, so the drawings need no directive
      expect(src, path).not.toMatch(/^['"]use client['"];/);
      expect(src, path).toMatch(/import \{ restSmil \} from ['"]@\/components\/landing-v2\/smil-rest['"];/);
      expect(src, path).toMatch(/function frame\(label: string\) \{\s*return \{[^}]*ref: restSmil,/);
      expect(src.match(/<svg\b/g)?.length, path).toBe(src.match(/<svg \{\.\.\.frame\(/g)?.length);
    }
    const overlays = read(OVERLAYS);
    expect(overlays).toContain('<svg ref={restSmil} viewBox="0 0 1600 2000"');
    expect(overlays).not.toContain('svg.setCurrentTime(1.4)');
  });

  it('the hold is the one place that pauses, resumes or seeks SMIL in the Solutions files', () => {
    const dir = 'components/landing-v2';
    const others = readdirSync(join(process.cwd(), dir), { recursive: true })
      .map(String)
      .filter((file) => /\.tsx?$/.test(file) && `${dir}/${file}` !== SMIL);
    expect(others.length).toBeGreaterThan(10);
    for (const file of others) {
      expect(read(`${dir}/${file}`), file).not.toMatch(/\b(?:un)?pauseAnimations\(|\bsetCurrentTime\(/);
    }
    const src = read(SMIL);
    expect(src).toContain('new IntersectionObserver(');
    expect(src).toMatch(/addEventListener\(['"]change['"], apply\)/);
    expect(src).toMatch(/removeEventListener\(['"]change['"], apply\)/);
    expect(src).toContain('observer.disconnect()');
  });
});

describe('sol-tab-glide: the subnav underline travels to the tab opened while the page cross-fades', () => {
  const css = block('sol-tab-glide');

  it('the underline is a shared element named for the typed navigation only', () => {
    const src = read(SHELL);
    expect(src).toContain('const TAB_GLIDE = ["sol-tab"];');
    expect(src).toMatch(
      /<ViewTransition name="sol-tab-underline" share=\{\{ "sol-tab": "sol-tab-glide", default: "none" \}\} default="none">\s*<span aria-hidden className="absolute inset-x-0 bottom-0 h-\[2px\] bg-\[#E6212F\]" \/>/,
    );
    // the type is dropped while the consent card shows (watchConsentCard, below)
    expect(src).toContain('transitionTypes={consentCard ? undefined : TAB_GLIDE}');
  });

  it('the shell opts its page into the typed cross-fade and holds the subnav', () => {
    const src = read(SHELL);
    // React gives enter and exit only to a ViewTransition above every DOM node of the page, so it wraps <main>
    expect(src).toMatch(
      /return \(\s*<ViewTransition\s+enter=\{\{ "sol-tab": "sol-page-in", default: "none" \}\}\s+exit=\{\{ "sol-tab": "sol-page-out", default: "none" \}\}\s+default="none"\s*>\s*<main /,
    );
    expect(src).toMatch(
      /<ViewTransition name="sol-subnav" share=\{\{ "sol-tab": "sol-tab-bar", default: "none" \}\} default="none">/,
    );
    expect(src).toContain('data-solutions-subnav');
  });

  it('the underline travels 250ms on the in-out curve, above the subnav, keeping its 2px', () => {
    expect(decls(css, '::view-transition-group(.sol-tab-glide)')).toMatchObject({
      'animation-duration': '250ms',
      'animation-timing-function': 'var(--ease-in-out)',
      'z-index': '2',
    });
    expect(decls(css, '::view-transition-new(.sol-tab-glide)')).toMatchObject({ height: '100%' });
    expect(decls(css, '::view-transition-group(.sol-tab-bar)')).toMatchObject({ animation: 'none', 'z-index': '1' });
    expect(decls(css, '::view-transition-old(.sol-tab-bar)')).toMatchObject({ display: 'none' });
    // the subnav's snapshot has no backdrop blur: it sits on the page's ground, so a scrolled page cannot show through
    expect(decls(css, '::view-transition-new(.sol-tab-bar)')['background-color']).toBe('var(--color-white, #fff)');
    expect(decls(css, ':root.dark::view-transition-new(.sol-tab-bar)')['background-color']).toBe(
      'var(--color-zinc-950, #09090b)',
    );
  });

  it('the old page leaves in 120ms and the new one arrives in 240ms, on the strong ease-out', () => {
    expect(decls(css, '::view-transition-old(.sol-page-out)').animation).toBe('120ms var(--ease-out) both vs-fade-out');
    expect(decls(css, '::view-transition-new(.sol-page-in)').animation).toBe(
      '240ms var(--ease-out) 60ms both vs-fade-in',
    );
  });

  it('the navbar holds: the fading page is clipped below it, and clicks pass through while the fade runs', () => {
    const overlay = decls(css, ':root:active-view-transition-type(sol-tab)::view-transition');
    expect(overlay['clip-path']).toMatch(/^polygon\(/);
    expect(overlay['pointer-events']).toBe('none');
    // React cancels the root's own snapshot in every Solutions transition, so the block holds no rule for it
    expect(css).not.toMatch(/::view-transition-(?:old|new|group)\(root\)/);
    expect(css).not.toContain(':has([data-solutions-subnav])');
  });

  it("the pages fade over the sheet's own ground, not the body's grey: the next page's group sits under the old one", () => {
    expect(decls(css, '::view-transition-group(.sol-page-in)')).toMatchObject({
      'z-index': '-1',
      'background-color': 'var(--color-white, #fff)',
    });
    expect(decls(css, ':root.dark::view-transition-group(.sol-page-in)')['background-color']).toBe(
      'var(--color-zinc-950, #09090b)',
    );
  });

  it('the chat bubble, fixed outside the page, stays above its fade (the hook the docs page fade uses)', () => {
    const typed = ':root:active-view-transition-type(sol-tab)';
    expect(decls(css, `${typed} [data-chatbot]`)['view-transition-name']).toBe('sol-chat');
    expect(decls(css, '::view-transition-group(sol-chat)')).toMatchObject({ 'z-index': '3', animation: 'none' });
    expect(decls(css, '::view-transition-old(sol-chat)').display).toBe('none');
    expect(decls(css, '::view-transition-new(sol-chat)').animation).toBe('none');
  });

  it('the consent card takes no name: no typed transition runs while it shows, so it always takes presses', () => {
    // a named element takes no presses while a view transition runs: mid-glide a press on the card reached the page
    expect(css).not.toContain('sol-consent');
    postcss.parse(css).walkRules((rule) => expect(rule.selector).not.toContain('privacy-banner-root'));
  });

  it('a tab click keeps the subnav where it is: no scroll to the top, the strip handed to the next page', () => {
    const src = read(SHELL);
    // the active tab keeps Next's own scroll; another tab keeps the subnav in place (keepSubnav)
    expect(src).toContain('scroll={active}');
    expect(src).toContain(
      'onNavigate={() => (active ? dropHandoff() : armHandoff(tab.href, stripRef.current?.scrollLeft ?? 0))}',
    );
    expect(src).toMatch(/useLayoutEffect\(\(\) => \{\s*const kept = takeHandoff\(pathname\);/);
    // the hand-off lives only as long as the page that armed it: the leaving subnav drops what the next page left
    expect(src).toContain('useEffect(() => dropHandoff, []);');
    expect(src).toMatch(
      /function keepSubnav\([^)]*\) \{[\s\S]*?stripScrollFor\([\s\S]*?pinScrollY\([\s\S]*?keptScrollY\(/,
    );
  });

  it('the global inset underline stands down on the Solutions tabs, so only the travelling one shows', () => {
    expect(
      decls(css, ':root [data-solutions-subnav] nav[aria-label="Solutions sections"] a[aria-current="page"]')[
        'box-shadow'
      ],
    ).toBe('none !important');
  });

  it('under Reduce Motion the underline moves without travelling and the page swaps without a cross-fade', () => {
    expect(decls(css, '::view-transition-group(.sol-tab-glide)', true).animation).toBe('none');
    expect(decls(css, '::view-transition-old(.sol-tab-glide)', true).display).toBe('none');
    expect(decls(css, '::view-transition-old(.sol-page-out)', true).display).toBe('none');
    expect(decls(css, '::view-transition-new(.sol-page-in)', true).animation).toBe('none');
    expect(decls(css, '::view-transition-new(.sol-tab-glide)', true).animation).toBe('none');
  });
});

describe('sol-tab-glide: where the next page puts the subnav', () => {
  // SolutionsShell is a client module; these are its pure parts (no render, so React's canary ViewTransition is unused)
  const shell = () => import('@/components/landing-v2/SolutionsShell');

  it('the tab strip keeps its scroll, moved just enough to show the opened tab whole', async () => {
    const { stripScrollFor } = await shell();
    expect(stripScrollFor(100, 150, 80, 300)).toBe(100); // in view: the strip stays
    expect(stripScrollFor(0, 280, 80, 300)).toBe(60); // cut off on the right: its right edge comes in
    expect(stripScrollFor(200, 150, 80, 300)).toBe(150); // left of the view: its left edge comes in
    expect(stripScrollFor(0, 100, 400, 300)).toBe(100); // wider than the strip: its start shows
  });

  it('the subnav pins at its natural top less its sticky offset', async () => {
    const { pinScrollY } = await shell();
    expect(pinScrollY(57, 40, 56)).toBe(41); // measured: sheet at 57px, pt-10, sticky at 3.5rem
    expect(pinScrollY(97, 40, 96)).toBe(41); // a 40px banner moves both
  });

  it('a page scrolled past the pin point opens there; a page above it keeps its scroll', async () => {
    const { keptScrollY } = await shell();
    expect(keptScrollY(1500, 41)).toBe(41);
    expect(keptScrollY(41, 41)).toBe(41);
    expect(keptScrollY(20, 41)).toBe(20);
  });

  it('the hand-off goes only to the page it was armed for, once, and a dropped one steers nothing', async () => {
    const { armHandoff, takeHandoff, dropHandoff } = await shell();
    armHandoff('/solutions/privacy', 237);
    expect(takeHandoff('/solutions/privacy')).toEqual({ href: '/solutions/privacy', stripLeft: 237 });
    expect(takeHandoff('/solutions/privacy')).toBeNull();
    // the first subnav that mounts takes it, so another page's arrival clears it
    armHandoff('/solutions/privacy', 237);
    expect(takeHandoff('/solutions/compliance')).toBeNull();
    expect(takeHandoff('/solutions/privacy')).toBeNull();
    // a tab navigation that never lands: the page that armed it leaves, and a later arrival gets nothing
    armHandoff('/solutions/privacy', 237);
    dropHandoff();
    expect(takeHandoff('/solutions/privacy')).toBeNull();
  });

  /** The subnav's tab links on `pathname`, as the shell renders them, by href (the logo links /solutions too: a tab is
      the link with a navigate handler). */
  async function tabs(pathname: string) {
    const { default: SolutionsShell } = await shell();
    nav.pathname = pathname;
    nav.links = [];
    renderToStaticMarkup(createElement(SolutionsShell, null, null));
    return (href: string) => {
      const link = nav.links.find((found) => found.href === href && found.onNavigate !== undefined);
      expect(link, href).toBeDefined();
      return link as (typeof nav.links)[number];
    };
  }

  it('another tab arms the hand-off for the page it opens, and types its navigation sol-tab', async () => {
    const { takeHandoff } = await shell();
    const tab = await tabs('/solutions');
    takeHandoff('');
    tab('/solutions/privacy').onNavigate?.();
    // the strip is not mounted in a server render, so it hands over its start
    expect(takeHandoff('/solutions/privacy')).toEqual({ href: '/solutions/privacy', stripLeft: 0 });
    // no consent card at first render (it mounts after hydration): the tabs carry the type
    expect(tab('/solutions/privacy').transitionTypes).toEqual(['sol-tab']);
  });

  it("pressing the open page's own tab drops a pending hand-off: that navigation keeps the page, so none takes it", async () => {
    const { takeHandoff } = await shell();
    const tab = await tabs('/solutions');
    // Privacy pressed, then Overview (this page's own tab) before Privacy arrived: the page stays, its subnav with it
    tab('/solutions/privacy').onNavigate?.();
    tab('/solutions').onNavigate?.();
    // a later arrival at Privacy by another link, untyped, must not be steered to the pin point
    expect(takeHandoff('/solutions/privacy')).toBeNull();
  });
});

describe('watchConsentCard: while the consent card shows, a tab change skips the typed transition', () => {
  class FakeMutationObserver {
    static made: FakeMutationObserver[] = [];
    observed: { target: unknown; options: unknown }[] = [];
    disconnected = false;
    constructor(private readonly callback: () => void) {
      FakeMutationObserver.made.push(this);
    }
    observe(target: unknown, options: unknown) {
      this.observed.push({ target, options });
    }
    disconnect() {
      this.disconnected = true;
    }
    fire() {
      this.callback();
    }
  }
  /** A document whose #privacy-banner-root holds a card `height` px tall, or nothing; `root: false` has no root. */
  function page(card: { height: number } | null, { root = true } = {}) {
    const banner = {
      firstElementChild: card ? { getBoundingClientRect: () => ({ height: card.height }) } : null,
    };
    const doc = { getElementById: (id: string) => (root && id === 'privacy-banner-root' ? banner : null) };
    return { banner, doc: doc as unknown as Document };
  }
  async function watch(card: { height: number } | null, options?: { root?: boolean }) {
    FakeMutationObserver.made = [];
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
    const { watchConsentCard } = await import('@/components/landing-v2/SolutionsShell');
    const { banner, doc } = page(card, options);
    const seen: boolean[] = [];
    const cleanup = watchConsentCard(doc, (shown) => seen.push(shown));
    return { banner, seen, cleanup, observer: FakeMutationObserver.made[0] };
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tells at once whether the card shows: a card with a box does, none or a hidden one (embed mode) does not', async () => {
    expect((await watch({ height: 324 })).seen).toEqual([true]);
    expect((await watch(null)).seen).toEqual([false]);
    expect((await watch({ height: 0 })).seen).toEqual([false]);
  });

  it('follows the card as it mounts after hydration, and as it goes', async () => {
    const { banner, seen, observer } = await watch(null);
    expect(observer.observed).toEqual([{ target: banner, options: { childList: true } }]);
    banner.firstElementChild = { getBoundingClientRect: () => ({ height: 324 }) };
    observer.fire();
    banner.firstElementChild = null;
    observer.fire();
    expect(seen).toEqual([false, true, false]);
  });

  it('with no banner root (the chat page) it watches nothing, and the cleanup disconnects the observer', async () => {
    const none = await watch(null, { root: false });
    expect(none.seen).toEqual([]);
    expect(none.observer).toBeUndefined();
    none.cleanup();
    const { cleanup, observer } = await watch({ height: 324 });
    cleanup();
    expect(observer.disconnected).toBe(true);
  });
});

describe('hygiene', () => {
  it('no transition-all and no ease-in in the touched files and the block', () => {
    for (const path of TOUCHED) {
      const src = read(path);
      expect(src, path).not.toMatch(TRANSITION_ALL);
      expect(src, path).not.toMatch(EASE_IN);
    }
    const css = block('sol-tab-glide');
    expect(css).not.toBe('');
    expect(css).not.toMatch(TRANSITION_ALL);
    expect(css).not.toMatch(EASE_IN);
    expect(ungatedHover(css)).toBe(0);
  });
});
