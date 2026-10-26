import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { block, contrast, declsOf, fromFrame, globalCss, palette, read, rulesFor, ungatedHover } from './helpers';

/**
 * Task 7 of the hub motion pass, the Solutions pages: the heroes at first paint (sol-hero-first-paint, variant a),
 * masked headings at 500ms with blocks that only fade and data that holds still (sol-reveals, a), one full-stop pass
 * as the words land (sol-period-cascade, b) and steps that dim to 55% with a 300ms hand-off (sol-sticky-dim, a).
 * Specs: .scratch/hub-motion/proposals/30-solutions.js.
 */

// framer-motion's useReducedMotion is null on the server and the device setting on the client's first render
const motionPref = vi.hoisted(() => ({ reduced: null as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => motionPref.reduced,
}));
// the shell's ViewTransition exists only in Next's React build, so the pages render here without it
vi.mock('@/components/landing-v2/SolutionsShell', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

import EcosystemHero from '@/components/ecosystem/EcosystemHero';
import PillarPage from '@/components/landing-v2/PillarPage';
import SolutionsIndex, { cascadeSteps } from '@/components/landing-v2/SolutionsIndex';
import { BLOCK_REVEAL, LINE_REVEAL, MaskText, Reveal, revealOnScroll } from '@/components/landing-v2/SpecKit';
import StickyStage from '@/components/landing-v2/StickyStage';
import { UseCaseRows } from '@/components/landing-v2/UseCases';
import { PILLARS, USE_CASES } from '@/components/landing-v2/pillars';
import { EASE_OUT, cssEase } from '@/lib/motion-curves';

const INDEX = 'components/landing-v2/SolutionsIndex.tsx';
const SPEC_KIT = 'components/landing-v2/SpecKit.tsx';
const PILLAR = 'components/landing-v2/PillarPage.tsx';
const STAGE = 'components/landing-v2/StickyStage.tsx';
const USE_CASES_FILE = 'components/landing-v2/UseCases.tsx';
const PLATE_VIDEO = 'components/landing-v2/PlateVideo.tsx';
const ECO_HERO = 'components/ecosystem/EcosystemHero.tsx';
const CSS = 'app/global.css';
const TOUCHED = [INDEX, SPEC_KIT, PILLAR, STAGE, USE_CASES_FILE, PLATE_VIDEO, ECO_HERO, CSS];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const REDUCE = '@media (prefers-reduced-motion: reduce)';

const PAGES = ['index', ...PILLARS.map((pillar) => pillar.slug)];

/** A page as the server sends it (null) or as a client first renders it (true: Reduce Motion on, false: off). */
function render(page: string, reduced: boolean | null = null): string {
  motionPref.reduced = reduced;
  try {
    if (page === 'index') return renderToStaticMarkup(createElement(SolutionsIndex));
    if (page === 'ecosystem') return renderToStaticMarkup(createElement(EcosystemHero));
    const pillar = PILLARS.find((p) => p.slug === page);
    if (!pillar) throw new Error(`no pillar ${page}`);
    return renderToStaticMarkup(createElement(PillarPage, { pillar }));
  } finally {
    motionPref.reduced = null;
  }
}

/** The class lists, as token arrays, of every element in `html` that carries the class `name`. */
function withClass(html: string, name: string): string[][] {
  return [...html.matchAll(/class="([^"]*)"/g)]
    .map((match) => match[1].split(/\s+/))
    .filter((list) => list.includes(name));
}

/** The source between the first `start` and the first `end` after it. */
function between(src: string, start: string, end: string): string {
  const from = src.indexOf(start);
  expect(from, `"${start}" in the source`).toBeGreaterThan(-1);
  const to = src.indexOf(end, from + start.length);
  expect(to, `"${end}" after "${start}"`).toBeGreaterThan(-1);
  return src.slice(from, to + end.length);
}

const root = globalCss;

describe('sol-hero-first-paint: the Solutions heroes enter in CSS, from the first frame', () => {
  const index = render('index');
  const hero = between(index, '<section', '</section>');

  it('the hall photo fades in out of its 1.08 zoom over 2.4 s', () => {
    const photos = withClass(hero, 'hero-zoom');
    expect(photos).toHaveLength(1);
    expect(photos[0]).toEqual(expect.arrayContaining(['hero-enter', 'origin-[49%_69%]', '[--hero-duration:2400ms]']));
  });

  it('the four words rise out of their masks in 800ms, from 0.3 s, 90ms apart', () => {
    const words = [
      ...hero.matchAll(
        /<span class="hero-enter hero-mask block \[--hero-duration:800ms\]" style="--hero-delay:(\d+)ms">/g,
      ),
    ];
    expect(words.map((match) => Number(match[1]))).toEqual([300, 390, 480, 570]);
    // each word sits in its mask (MaskText's class keeps its trailing space when no className is passed)
    expect(hero.match(/<span class="block overflow-hidden ?"><span class="hero-enter hero-mask /g)).toHaveLength(4);
  });

  it('the dek sharpens as it rises, 1.4 s after 1.1 s (variant a keeps the authored timing)', () => {
    const deks = withClass(hero, 'hero-blur');
    expect(deks).toHaveLength(1);
    expect(deks[0]).toEqual(
      expect.arrayContaining(['hero-enter', '[--hero-delay:1100ms]', '[--hero-duration:1400ms]']),
    );
  });

  it('nothing in the hero leaves the server hidden', () => {
    // (the red light's glow breathes from opacity 0.15 by design)
    expect(hero).not.toMatch(/opacity:0(?![.\d])|translateY\(105%\)|scale\(1\.08\)|blur\(10px\)/);
    expect(read(INDEX)).not.toMatch(/initial=\{reducedMotion \? false/);
  });

  it.each(PILLARS.map((pillar) => pillar.slug))(
    "the %s page's opening block rises 20px in 600ms from the first frame",
    (slug) => {
      const opening = between(render(slug), '<section', '<h1');
      const blocks = withClass(opening, 'hero-enter');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual(expect.arrayContaining(['[--hero-rise-y:20px]', 'flex-1']));
      expect(blocks[0].some((name) => name.startsWith('[--hero-duration'))).toBe(false);
      expect(opening).not.toMatch(/style="[^"]*opacity:0/);
    },
  );

  it('the Ecosystem hero enters the same way: its camp photo out of its 1.06 zoom over 2.4 s, its dek as here', () => {
    const eco = render('ecosystem');
    const photos = withClass(eco, 'hero-zoom');
    expect(photos).toHaveLength(1);
    expect(photos[0]).toEqual(
      expect.arrayContaining(['hero-enter', 'origin-[61%_40.41%]', '[--hero-duration:2400ms]', '[--hero-zoom:1.06]']),
    );
    const deks = withClass(eco, 'hero-blur');
    expect(deks).toHaveLength(1);
    expect(deks[0]).toEqual(
      expect.arrayContaining(['hero-enter', '[--hero-delay:1100ms]', '[--hero-duration:1400ms]']),
    );
    // nothing waits for the scripts: no start pose in the server HTML (the beacon's glow breathes from 0.2 by design)
    expect(eco).not.toMatch(/opacity:0(?![.\d])|scale\(1\.06\)|blur\(10px\)|translateY\(8px\)/);
    expect(read(ECO_HERO)).not.toMatch(/initial=\{reducedMotion \? false|\bEASE\b/);
  });

  it("three pose classes swap .hero-enter's keyframes and keep its timing, curve and fill", () => {
    // the zoom's start is a knob, --hero-zoom (the hall's 1.08 by default)
    expect(fromFrame('hero-zoom')).toEqual({ opacity: '0', transform: 'scale(var(--hero-zoom, 1.08))' });
    expect(fromFrame('hero-mask')).toEqual({ transform: 'translateY(105%)' });
    expect(fromFrame('hero-blur')).toEqual({ opacity: '0', filter: 'blur(10px)', transform: 'translateY(8px)' });
    for (const pose of ['hero-zoom', 'hero-mask', 'hero-blur']) {
      const found = rulesFor(`.hero-enter.${pose}`);
      expect(found, pose).toHaveLength(1);
      expect(found[0].at).toEqual([]);
      expect(declsOf(found[0].rule).map((decl) => [decl.prop, decl.value, decl.important ?? false])).toEqual([
        ['animation-name', pose, false],
      ]);
    }
  });

  it("under Reduce Motion every pose is .hero-enter's 200ms fade (its !important name beats a pose's plain one)", () => {
    const reduced = rulesFor('.hero-enter').filter((found) => found.at.join() === REDUCE);
    expect(reduced).toHaveLength(1);
    const decls = declsOf(reduced[0].rule).map((decl) => [decl.prop, decl.value, decl.important ?? false]);
    expect(decls).toEqual([
      ['animation-name', 'vs-fade-in', true],
      ['animation-duration', '200ms', true],
    ]);
    // the site's plain fade (exp-view-switch)
    expect(fromFrame('vs-fade-in')).toEqual({ opacity: '0' });
  });

  it('the block is named for the proposal and the shared entrance names its Solutions users', () => {
    const css = block('sol-hero-first-paint');
    expect(css).toMatch(/@keyframes hero-zoom/);
    expect(ungatedHover(css)).toBe(0);
    const shared = root.nodes.find((node) => node.type === 'comment' && node.text.startsWith('home-hero-first-paint:'));
    expect(shared && shared.type === 'comment' ? shared.text : '').toMatch(/Solutions/);
  });
});

describe('hydration: the server output is the first client render, with Reduce Motion on or off', () => {
  it.each([...PAGES, 'ecosystem'])('%s', (page) => {
    const server = render(page);
    expect(render(page, true)).toBe(server);
    expect(render(page, false)).toBe(server);
  });

  it('a sticky-stage plate holds still under Reduce Motion in CSS, not through a branch in its first render', () => {
    const steps = [{ key: 'a', content: 'a', plate: { drawing: null, caption: ['a', 'a'] as [string, string] } }];
    const plates = withClass(
      renderToStaticMarkup(createElement(StickyStage, { steps })),
      'motion-reduce:transform-none!',
    );
    expect(plates).toHaveLength(1);
    expect(read(STAGE)).not.toMatch(/useReducedMotion|still \? 1/);
  });

  it('a plate video renders its (empty) element either way, and never loads it under Reduce Motion', () => {
    const src = read(PLATE_VIDEO);
    expect(src).not.toMatch(/\{!reducedMotion && \(/);
    expect(src).toMatch(
      /const reduce = window\.matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\);\s*if \(reduce\.matches\) return;/,
    );
  });

  it('Reduce Motion switched on mid-session stops a playing plate video and shows its poster again', () => {
    // the element stays mounted, so the effect must stop it. It watches the media query itself: framer's
    // useReducedMotion keeps the value the page loaded with (useState in framer-motion 12), so an effect keyed on it
    // never ran again and the loop kept playing (measured on /solutions)
    const src = read(PLATE_VIDEO);
    expect(src).not.toMatch(/useReducedMotion\(\)|from ['"]framer-motion['"]/);
    expect(src).toMatch(
      /const onReduce = \(\) => \{\s*if \(!reduce\.matches\) return;\s*loader\.disconnect\(\);\s*player\.disconnect\(\);\s*el\.pause\(\);\s*setPlaying\(false\);\s*\};/,
    );
    expect(src).toMatch(/reduce\.addEventListener\(["']change["'], onReduce\);/);
    expect(src).toMatch(/return \(\) => \{\s*reduce\.removeEventListener\(["']change["'], onReduce\);/);
  });
});

describe('content visible by default: no reveal or entrance waits for the scripts', () => {
  it.each(PAGES)('%s sends no hidden start pose in its HTML', (page) => {
    expect(render(page)).not.toMatch(
      /translateY\(105%\)|translateY\(20px\)|translateY\(8px\)|scale\(1\.08\)|blur\(10px\)/,
    );
  });
});

describe('sol-reveals: masked headings at 500ms, blocks that only fade, data that holds still', () => {
  it('a heading line rises out of its mask in 500ms once 40px of the mask is on screen', () => {
    expect(LINE_REVEAL).toEqual({
      frames: [{ transform: 'translateY(105%)' }, { transform: 'none' }],
      duration: 500,
      margin: '-40px',
    });
  });

  it('a block only fades in, in 300ms, once 60px of it is on screen', () => {
    expect(BLOCK_REVEAL).toEqual({ frames: [{ opacity: 0 }, { opacity: 1 }], duration: 300, margin: '-60px' });
  });

  it('MaskText and Reveal render in place, with no start pose', () => {
    expect(renderToStaticMarkup(createElement(MaskText, { delay: 0.08, className: 'text-zinc-500' }, 'Line'))).toBe(
      '<span class="block overflow-hidden text-zinc-500"><span class="block">Line</span></span>',
    );
    expect(renderToStaticMarkup(createElement(Reveal, { id: 'row', className: 'grid' }, 'Block'))).toBe(
      '<div id="row" class="grid">Block</div>',
    );
  });

  it('SpecKit no longer reveals through framer whileInView, and keeps no curve of its own', () => {
    const src = read(SPEC_KIT);
    expect(src).not.toMatch(/whileInView|initial=/);
    // its reveals take EASE_OUT from lib/motion-curves; the old production curve went with its last user (the
    // Ecosystem hero, now in CSS)
    expect(src).not.toMatch(/0\.22,\s*1,\s*0\.36,\s*1/);
  });

  it('the guarantee figures hold still: no mask around them', () => {
    const rows = renderToStaticMarkup(createElement(UseCaseRows, { useCases: USE_CASES.slice(0, 2) }));
    const figures = [...rows.matchAll(/<dd class="v2-heading mt-2 text-\[17px\][^"]*">([^<]*)<\/dd>/g)];
    expect(figures).toHaveLength(USE_CASES.slice(0, 2).reduce((n, useCase) => n + useCase.guarantees.length, 0));
    expect(read(USE_CASES_FILE)).not.toMatch(/MaskText/);
  });

  it('the comparison rows hold still', () => {
    const src = read(INDEX);
    expect(src).not.toMatch(/motion\.tr|whileInView/);
    const table = between(render('index'), '<table', '</table>');
    expect(table).not.toMatch(/<tr[^>]* style=/);
  });

  it('the stagger halves with the duration: capabilities 40ms apart, the comparison copy after 50ms', () => {
    expect(read(PILLAR)).toMatch(/<Reveal key=\{capability\.title\} delay=\{i \* 0\.04\}/);
    expect(read(INDEX)).toMatch(/<Reveal delay=\{0\.05\} className="lg:pt-2">/);
  });
});

describe('revealOnScroll: only what is still below the screen once the page is live takes the start pose', () => {
  type Entry = { isIntersecting: boolean };
  class FakeObserver {
    static made: FakeObserver[] = [];
    observed: unknown[] = [];
    disconnected = false;
    constructor(
      private readonly callback: (entries: Entry[]) => void,
      readonly options: { rootMargin?: string },
    ) {
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
  function fakeElement(top: number) {
    const animations: { frames: unknown; options: unknown; calls: string[] }[] = [];
    return {
      animations,
      getBoundingClientRect: () => ({ top }),
      animate(frames: unknown, options: unknown) {
        const calls: string[] = [];
        animations.push({ frames, options, calls });
        return {
          pause: () => calls.push('pause'),
          play: () => calls.push('play'),
          cancel: () => calls.push('cancel'),
        };
      },
    };
  }
  function live({ top = 1400, reduced = false } = {}) {
    FakeObserver.made = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('innerHeight', 900);
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
    }));
    const mask = fakeElement(top);
    const line = fakeElement(top);
    const reveal = (delay: number) =>
      revealOnScroll(mask as unknown as Element, line as unknown as Element, LINE_REVEAL, delay);
    return { mask, line, reveal };
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('below the screen: the start pose is held by the paused animation until the mask comes into view', () => {
    const { mask, line, reveal } = live();
    reveal(0.08);
    expect(mask.animations).toEqual([]);
    expect(line.animations).toHaveLength(1);
    const [animation] = line.animations;
    expect(animation.frames).toEqual(LINE_REVEAL.frames);
    // fill backwards: the start pose holds through the delay, and nothing stays once it has played
    expect(animation.options).toEqual({ duration: 500, delay: 80, easing: cssEase(EASE_OUT), fill: 'backwards' });
    expect(animation.calls).toEqual(['pause']);
    const [observer] = FakeObserver.made;
    expect(observer.observed).toEqual([mask]);
    expect(observer.options).toEqual({ rootMargin: '-40px' });
    observer.fire(false);
    expect(animation.calls).toEqual(['pause']);
    observer.fire(true);
    expect(animation.calls).toEqual(['pause', 'play']);
    expect(observer.disconnected).toBe(true);
  });

  it.each([
    ['on the screen', 400],
    ['above the screen', -600],
  ])('%s when the page goes live: it stays as the server sent it', (_, top) => {
    const { line, reveal } = live({ top });
    expect(reveal(0)).toBeUndefined();
    expect(line.animations).toEqual([]);
    expect(FakeObserver.made).toEqual([]);
  });

  it('under Reduce Motion nothing takes a start pose: everything stays in place', () => {
    const { line, reveal } = live({ reduced: true });
    expect(reveal(0)).toBeUndefined();
    expect(line.animations).toEqual([]);
    expect(FakeObserver.made).toEqual([]);
  });

  it('the cleanup stops watching and drops the start pose', () => {
    const { line, reveal } = live();
    const cleanup = reveal(0);
    expect(typeof cleanup).toBe('function');
    cleanup?.();
    expect(FakeObserver.made[0].disconnected).toBe(true);
    expect(line.animations[0].calls).toEqual(['pause', 'cancel']);
  });
});

describe('sol-period-cascade: one pass as the words land, then rest', () => {
  it('the pass starts 1.1 s into the entrance and steps every 650ms, ending at rest', () => {
    expect(cascadeSteps(4, 0)).toEqual([
      [1100, 0],
      [1750, 1],
      [2400, 2],
      [3050, 3],
      [3700, -1],
    ]);
  });

  it('it is timed from the entrance, which starts at first paint, not from hydration', () => {
    expect(cascadeSteps(4, 400)).toEqual([
      [700, 0],
      [1350, 1],
      [2000, 2],
      [2650, 3],
      [3300, -1],
    ]);
    // words that landed before the page went live get their pass at once
    expect(cascadeSteps(4, 5000)).toEqual([
      [0, 0],
      [650, 1],
      [1300, 2],
      [1950, 3],
      [2600, -1],
    ]);
  });

  it('it runs once, and rests with only the last full stop red; each full stop keeps its 500ms colour', () => {
    const src = read(INDEX);
    expect(src).not.toMatch(/setInterval/);
    expect(src).toMatch(/setTimeout\(\(\) => setActive\(word\), at\)/);
    expect(src).toMatch(/clearTimeout/);
    const dots = [...render('index').matchAll(/<span class="transition-colors duration-500 ([^"]+)">\.<\/span>/g)];
    expect(dots.map((match) => match[1])).toEqual([
      'text-white/25',
      'text-white/25',
      'text-white/25',
      'text-[#E6212F]',
    ]);
  });

  it('it reads how far the entrance has run, and under Reduce Motion there is no pass', () => {
    const effect = between(read(INDEX), 'const [active, setActive] = useState(-1);', 'cascadeSteps(');
    expect(effect).toMatch(/if \(reducedMotion\) return;/);
    expect(effect).toMatch(/getAnimations\(\)/);
  });
});

describe('sol-sticky-dim: the steps not being read sit at 55%, with a 300ms hand-off', () => {
  const steps = ['a', 'b', 'c'].map((key) => ({
    key,
    content: key,
    plate: { drawing: null, caption: [key, key] as [string, string] },
  }));
  const stage = renderToStaticMarkup(createElement(StickyStage, { steps }));
  const classes = [...stage.matchAll(/data-step="(\d)" class="([^"]*)"/g)].map((match) => match[2].split(/\s+/));

  it("the steps' spec labels read 4.5:1 in both themes: zinc-500 on the white sheet, zinc-400 on the zinc-950 one", () => {
    // the sheet is bg-white dark:bg-zinc-950 (SolutionsShell); zinc-500 alone read 4.12:1 in dark
    const labels = [...render('index').matchAll(/<dt class="([^"]*)">/g)].map((match) => match[1].split(/\s+/));
    expect(labels.length).toBeGreaterThan(0);
    for (const list of labels) expect(list).toEqual(expect.arrayContaining(['text-zinc-500', 'dark:text-zinc-400']));
    expect(contrast(palette('zinc-500'), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette('zinc-400'), palette('zinc-950'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the step being read is full, the others dim to 55%', () => {
    expect(classes).toHaveLength(3);
    expect(classes[0]).toContain('lg:opacity-100');
    expect(classes[1]).toContain('lg:opacity-55');
    expect(classes[2]).toContain('lg:opacity-55');
    expect(read(STAGE)).not.toMatch(/opacity-30|duration-700/);
  });

  it('the hand-off fades opacity in 300ms on the strong ease-out', () => {
    for (const list of classes)
      expect(list).toEqual(expect.arrayContaining(['transition-opacity', 'duration-300', 'ease-out']));
    const tokens = root.nodes.find(
      (node) => node.type === 'atrule' && node.name === 'theme' && node.params === 'static',
    );
    expect(String(tokens)).toMatch(/--ease-out: cubic-bezier\(0\.23, 1, 0\.32, 1\);/);
  });

  it('under Reduce Motion the dim stays and fades in 150ms (the site policy)', () => {
    const policy = block('site-reduced-motion-policy');
    expect(policy).toMatch(/transition-property:[^;]*\bopacity\b[^;]*!important/);
    expect(policy).toMatch(/transition-duration: 150ms !important/);
  });
});

describe('every file this task touches', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });
});
