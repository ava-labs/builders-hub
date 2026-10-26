import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { type Rule } from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { declsOf, fromFrame, globalCss, read, rulesFor, ungatedHover } from './helpers';

// framer-motion's useReducedMotion is null on the server and the device setting on the client's first render
const motionPref = vi.hoisted(() => ({ reduced: null as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  useReducedMotion: () => motionPref.reduced,
}));
// the home's network chapter reads the router; the hero under test never uses it
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
}));

import { SweepLabel } from '@/components/audits/shared/SweepLabel';
import { BrandButton } from '@/components/landing-v2/BrandButton';
import ConsoleBar from '@/components/landing-v2/ConsoleBar';
import StoryHome from '@/components/landing-v2/StoryHome';
import {
  BOARD_STATIC,
  BOARD_VARIANTS,
  COUNT,
  COUNT_FROM,
  HEADING_RISE,
  NOUN_ROLL,
  NOUN_WIDTH,
  ROW_STATIC,
  ROW_VARIANTS,
  STOP_DROP,
} from '@/components/landing-v2/home-motion';
import { EASE_OUT } from '@/lib/motion-curves';

/**
 * Task 5 of the hub motion pass: the brand CTA sweep (site-cta-synced-sweep, variant a) and the home hero: its copy
 * at first paint (home-hero-first-paint, a), the noun roll and its full stop (home-hero-word, a) and the stats board
 * arrival (home-board-arrival, a). Also the home's scroll padding, which the site-wide anchor rule now gives it.
 */
const CSS = 'app/global.css';
const BRAND_BUTTON = 'components/landing-v2/BrandButton.tsx';
const CONSOLE_BAR = 'components/landing-v2/ConsoleBar.tsx';
const STORY_HOME = 'components/landing-v2/StoryHome.tsx';
const HOME_MOTION = 'components/landing-v2/home-motion.ts';
const SWEEP_LABEL = 'components/audits/shared/SweepLabel.tsx';
/** Every audits CTA that carries the .audits-sweep treatment. */
const AUDITS_CTAS = [
  'components/audits/landing/AuditsLanding.tsx',
  'components/audits/landing/FirstRun.tsx',
  'components/audits/landing/MyRequestsList.tsx',
  'components/audits/firms/FirmsList.tsx',
  'components/audits/portal/QuoteComposer.tsx',
  'components/audits/wizard/WizardShell.tsx',
  'components/audits/admin/ReviewDecision.tsx',
  'components/audits/admin/AuditorsManager.tsx',
  'components/audits/admin/SubsidyWorksheet.tsx',
];
const TOUCHED = [CSS, BRAND_BUTTON, CONSOLE_BAR, STORY_HOME, HOME_MOTION, SWEEP_LABEL, ...AUDITS_CTAS];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const HOVER_MEDIA = '(hover: hover) and (pointer: fine)';
/** The BrandButton block's own hover, as global.css writes Tailwind's named group class `group/brand-cta`. */
const CTA_GROUP_HOVER = '.group\\/brand-cta:hover .sweep-copy';
const REDUCE = '(prefers-reduced-motion: reduce)';

const css = read(CSS);
const root = globalCss;
const story = read(STORY_HOME);

/** The one rule for `selector` inside exactly the at-rules `at` (none: top level). */
function ruleAt(selector: string, at: string[] = []): Rule {
  const match = rulesFor(selector).find((found) => found.at.join(' | ') === at.join(' | '));
  expect(match, `${at.join(' > ') || 'top level'} > ${selector}`).toBeDefined();
  return (match as { rule: Rule }).rule;
}

const valueOf = (rule: Rule, prop: string) => declsOf(rule).find((decl) => decl.prop === prop)?.value;
const importantOf = (rule: Rule, prop: string) => declsOf(rule).find((decl) => decl.prop === prop)?.important ?? false;

/** Every root-level block a comment naming `id` heads: the comment and the nodes after it, up to the next comment. */
function blocks(id: string): string[] {
  const nodes = root.nodes;
  const found: string[] = [];
  nodes.forEach((node, start) => {
    if (node.type !== 'comment' || !node.text.split(':')[0].includes(id)) return;
    const end = nodes.findIndex((next, i) => i > start && next.type === 'comment');
    found.push(nodes.slice(start, end === -1 ? undefined : end).join('\n'));
  });
  return found;
}

/** The source between the first `start` and the first `end` after it. */
function between(src: string, start: string, end: string): string {
  const from = src.indexOf(start);
  expect(from, `"${start}" in the source`).toBeGreaterThan(-1);
  const to = src.indexOf(end, from);
  expect(to, `"${end}" after "${start}"`).toBeGreaterThan(-1);
  return src.slice(from, to + end.length);
}

/** The class list of every element in rendered markup. */
const classLists = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1].split(/\s+/));
/**
 * The copies (class sweep-copy) in rendered markup, each aria-hidden and inert: inert keeps the copy's text out of
 * find in page as well as the accessibility tree, so role locators skip it (a plain text match, such as Playwright's
 * getByText, still finds it).
 */
const copies = (html: string) => [...html.matchAll(/<span aria-hidden="true" inert="" class="(sweep-copy[^"]*)">/g)];
/** Every element with the sweep-copy class, inert or not. */
const anyCopies = (html: string) => html.match(/class="sweep-copy\b/g) ?? [];

describe('every file this task touches', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(['site-cta-synced-sweep', 'home-hero-first-paint'])(
    'the %s blocks in global.css exist and gate every hover',
    (id) => {
      const found = blocks(id);
      expect(found.length, `a comment-headed block for ${id}`).toBeGreaterThan(0);
      for (const text of found) expect(ungatedHover(text)).toBe(0);
    },
  );
});

describe('site-cta-synced-sweep: one clipped copy of the hovered state', () => {
  it('the copy covers its control, takes its box and ignores the pointer and text selection', () => {
    const rule = ruleAt('.sweep-copy');
    expect(valueOf(rule, 'position')).toBe('absolute');
    expect(valueOf(rule, 'inset')).toBe('0');
    expect(valueOf(rule, 'pointer-events')).toBe('none');
    expect(valueOf(rule, 'user-select')).toBe('none');
    for (const prop of ['display', 'flex-direction', 'align-items', 'justify-content', 'gap', 'padding']) {
      expect(valueOf(rule, prop), prop).toBe('inherit');
    }
  });

  it('it rests clipped to nothing and hides again in 160ms on the strong ease-out', () => {
    const rule = ruleAt('.sweep-copy');
    expect(valueOf(rule, 'clip-path')).toBe('inset(0 100% 0 0)');
    expect(valueOf(rule, 'transition')).toBe('clip-path 160ms var(--ease-out)');
  });

  it('hover reveals it left to right in 220ms, only where the pointer can hover', () => {
    const rule = ruleAt(':hover > .sweep-copy', [`@media ${HOVER_MEDIA}`]);
    expect(valueOf(rule, 'clip-path')).toBe('inset(0)');
    expect(valueOf(rule, 'transition-duration')).toBe('220ms');
    expect(
      rulesFor(':hover > .sweep-copy').every((found) => found.at.some((at) => at.includes('(hover: hover)'))),
    ).toBe(true);
  });

  it("a BrandButton reveals it from the same hover target as its edge bar's fade: the whole block (group/brand-cta)", () => {
    expect(ruleAt(':hover > .sweep-copy', [`@media ${HOVER_MEDIA}`]).selectors).toContain(CTA_GROUP_HOVER);
    expect(ruleAt(':hover > .sweep-copy', [`@media ${REDUCE}`, `@media ${HOVER_MEDIA}`]).selectors).toContain(
      CTA_GROUP_HOVER,
    );
    const html = renderToStaticMarkup(createElement(BrandButton, { href: '/x', variant: 'secondary' }, 'Label'));
    const [outer, bar] = classLists(html);
    expect(outer).toContain('group/brand-cta');
    expect(outer).not.toContain('group');
    expect(bar).toContain('group-hover/brand-cta:opacity-0');
  });

  it("the sweep rule's hover group is BrandButton's alone: no other control can reveal a copy through it", () => {
    // the rule reveals every .sweep-copy inside any element of that group, so a group of the same name elsewhere
    // (encrypted-erc's HeroCard is group/cta) would wipe a copy placed inside it
    const name = ruleAt(':hover > .sweep-copy', [`@media ${HOVER_MEDIA}`])
      .selectors.map((selector) => selector.match(/^\.group\\\/([\w-]+):hover \.sweep-copy$/)?.[1])
      .find(Boolean);
    expect(name, 'a .group\\/name:hover .sweep-copy selector').toBeDefined();
    const groupClass = new RegExp(`(?<![\\w/-])group\\/${name}(?![\\w-])`);
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (['.tsx', '.ts'].includes(extname(entry.name)) && groupClass.test(read(path))) users.push(path);
      }
    };
    ['components', 'app'].forEach(walk);
    expect(users).toEqual([BRAND_BUTTON]);
  });

  it('keyboard focus shows the hovered state too', () => {
    expect(valueOf(ruleAt(':focus-visible > .sweep-copy'), 'clip-path')).toBe('inset(0)');
  });

  it("keyboard focus on a BrandButton fades the secondary's edge bar too, as it reveals the copy", () => {
    const html = renderToStaticMarkup(createElement(BrandButton, { href: '/x', variant: 'secondary' }, 'Label'));
    const [, bar] = classLists(html);
    // the link inside the block holds the focus: the block has a :focus-visible descendant
    expect(bar).toContain('group-has-focus-visible/brand-cta:opacity-0');
  });

  it('under Reduce Motion the copy fades in instead of wiping', () => {
    const rest = ruleAt('.sweep-copy', [`@media ${REDUCE}`]);
    expect(valueOf(rest, 'clip-path')).toBe('none');
    expect(valueOf(rest, 'opacity')).toBe('0');
    expect(valueOf(ruleAt(':focus-visible > .sweep-copy', [`@media ${REDUCE}`]), 'opacity')).toBe('1');
    expect(valueOf(ruleAt(':hover > .sweep-copy', [`@media ${REDUCE}`, `@media ${HOVER_MEDIA}`]), 'opacity')).toBe('1');
  });

  it('BrandButton carries one aria-hidden copy with the same label, and no separately timed label colour', () => {
    const html = renderToStaticMarkup(createElement(BrandButton, { href: '/console' }, 'Build an L1'));
    expect(copies(html)).toHaveLength(1);
    expect(anyCopies(html)).toHaveLength(1);
    expect(html.match(/Build an L1/g)).toHaveLength(2);
    const classes = classLists(html).flat();
    expect(classes).not.toContain('transition-colors');
    expect(classes.filter((name) => /^group-hover:text-/.test(name))).toEqual([]);
    expect(classes.filter((name) => /scale-x-/.test(name))).toEqual([]);
    expect(read(BRAND_BUTTON)).not.toMatch(/transition-colors|group-hover:text-|scale-x-/);
  });

  it.each([
    ['primary', 'bg-[#EBF0FA] text-[#1F1F1F]'],
    ['secondary', 'bg-[#EBF0FA] text-[#1F1F1F]'],
    ['light', 'bg-[#1F1F1F] text-white'],
  ] as const)('the %s copy is the hovered state: %s, with the red arrow', (variant, ground) => {
    const html = renderToStaticMarkup(createElement(BrandButton, { href: '/x', variant }, 'Label'));
    const [copy] = copies(html);
    expect(copy[1]).toBe(`sweep-copy ${ground}`);
    const inside = html.slice(html.indexOf(copy[0]));
    expect(inside).toMatch(/<svg[^>]*class="[^"]*text-\[#E6212F\]/);
  });

  it('the whole BrandButton presses in to 0.97 in 160ms on the strong ease-out, with no scale under Reduce Motion', () => {
    const html = renderToStaticMarkup(createElement(BrandButton, { href: '/x', variant: 'secondary' }, 'Label'));
    const [outer] = classLists(html);
    for (const name of [
      'active:scale-[0.97]',
      'motion-reduce:active:scale-100',
      'transition-[scale]',
      'duration-160',
    ]) {
      expect(outer, name).toContain(name);
    }
    expect(outer).toContain('ease-out');
  });

  it('ConsoleBar carries the same copy and does not press (a full-width bar)', () => {
    const html = renderToStaticMarkup(createElement(ConsoleBar));
    expect(copies(html)).toHaveLength(1);
    expect(anyCopies(html)).toHaveLength(1);
    expect(copies(html)[0][1]).toBe('sweep-copy bg-[#EBF0FA]');
    expect(html.match(/Build yours in the Console/g)).toHaveLength(2);
    expect(read(CONSOLE_BAR)).not.toMatch(/transition-colors|group-hover:|scale-x-|active:scale/);
  });

  it('the home "Explore the network" bar carries the same copy and does not press', () => {
    const bar = between(story, 'href="/explorer"', '</HoverPrefetchLink>');
    expect(bar).toMatch(/<span aria-hidden inert className="sweep-copy bg-\[#EBF0FA\]">/);
    expect(bar.match(/className="sweep-copy\b/g)).toHaveLength(1);
    expect(bar).not.toMatch(/transition-colors|group-hover:|group-focus-visible:|scale-x-|active:scale/);
  });

  it('the audits sweep keeps its control red under the copy and drops the scaled fill and the label colour', () => {
    expect(rulesFor('.audits-sweep::before')).toEqual([]);
    const host = ruleAt('.audits-sweep');
    expect(valueOf(host, 'position')).toBe('relative');
    expect(valueOf(host, 'overflow')).toBe('hidden');
    const copy = ruleAt('.audits-sweep > .sweep-copy');
    expect(valueOf(copy, 'background-color')?.toLowerCase()).toBe('#ebf0fa');
    expect(valueOf(copy, 'color')?.toLowerCase()).toBe('#1f1f1f');
    const hover = ruleAt('.audits-sweep:hover', [`@media ${HOVER_MEDIA}`]);
    expect(declsOf(hover).map((decl) => decl.prop)).toEqual(['background-color']);
    expect(valueOf(hover, 'background-color')?.toLowerCase()).toBe('#e6212f');
    expect(rulesFor('.audits-sweep:hover').length).toBe(1);
  });

  it('SweepLabel renders the label, then its aria-hidden, inert copy', () => {
    const html = renderToStaticMarkup(createElement(SweepLabel, null, 'Request quotes'));
    expect(html).toBe('Request quotes<span aria-hidden="true" inert="" class="sweep-copy">Request quotes</span>');
  });

  it.each(AUDITS_CTAS)('%s puts a SweepLabel in every .audits-sweep control', (path) => {
    const src = read(path);
    const controls = src.match(/className="audits-sweep\b/g) ?? [];
    expect(controls.length).toBeGreaterThan(0);
    expect((src.match(/<SweepLabel>/g) ?? []).length).toBe(controls.length);
  });

  it('the audits links press in like the brand block (the shared Button already does)', () => {
    for (const path of AUDITS_CTAS) {
      for (const match of read(path).matchAll(/<Link\s[^>]*className="(audits-sweep[^"]*)"/g)) {
        const names = match[1].split(/\s+/);
        for (const name of [
          'active:scale-[0.97]',
          'motion-reduce:active:scale-100',
          'transition-[scale]',
          'duration-160',
        ]) {
          expect(names, `${path}: ${name}`).toContain(name);
        }
        expect(names, path).not.toContain('transition-colors');
      }
    }
  });

  it('no other control uses .audits-sweep without its copy', () => {
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (['.tsx', '.ts'].includes(extname(entry.name)) && read(path).includes('audits-sweep')) users.push(path);
      }
    };
    ['components', 'app'].forEach(walk);
    expect(users.filter((path) => path !== SWEEP_LABEL).sort()).toEqual([...AUDITS_CTAS].sort());
  });
});

describe('home-hero-first-paint: the hero copy rises from the first frame, in CSS', () => {
  const hero = between(story, 'function ChapterOne()', '\n}\n');

  it('no hero block is a framer element with a hidden start', () => {
    expect(hero).not.toMatch(/\brise\(/);
    expect(hero).not.toMatch(/motion\.h1/);
    expect(hero).not.toMatch(/initial=\{\{\s*opacity:\s*0/);
  });

  it.each([
    ['the headline', /<h1\s+className="hero-enter \[--hero-delay:50ms\] /],
    ['the buttons', /<div className="hero-enter \[--hero-delay:300ms\] mt-12 /],
    ['the tape', /<div className="hero-enter \[--hero-delay:450ms\]">\s*<BuiltOnMarquee embedded \/>/],
  ])('%s enters through .hero-enter, in the authored order', (_, pattern) => {
    expect(hero).toMatch(pattern);
  });

  it('hero-rise starts 16px down at opacity 0 and ends on the element at rest', () => {
    expect(fromFrame('hero-rise')).toEqual({ opacity: '0', transform: 'translateY(var(--hero-rise-y, 16px))' });
  });

  it('.hero-enter plays it for 600ms on the strong ease-out after --hero-delay, holding only the start', () => {
    // backwards: the start pose holds through the delay, and nothing (no identity transform, so no stacking
    // context or containing block) stays on the element once the animation ends
    expect(valueOf(ruleAt('.hero-enter'), 'animation')).toBe(
      'hero-rise var(--hero-duration, 600ms) var(--ease-out) var(--hero-delay, 0ms) backwards',
    );
  });

  it('under Reduce Motion it is a 200ms fade with no rise', () => {
    const reduced = ruleAt('.hero-enter', [`@media ${REDUCE}`]);
    // the site's plain fade (exp-view-switch)
    expect(valueOf(reduced, 'animation-name')).toBe('vs-fade-in');
    expect(importantOf(reduced, 'animation-name')).toBe(true);
    expect(valueOf(reduced, 'animation-duration')).toBe('200ms');
    expect(importantOf(reduced, 'animation-duration')).toBe(true);
    expect(fromFrame('vs-fade-in')).toEqual({ opacity: '0' });
  });
});

describe('the home hydrates as sent: the server HTML is the first client render, with Reduce Motion on or off', () => {
  /** The home as the server sends it (null) or as a client first renders it (true: Reduce Motion on, false: off). */
  function home(reduced: boolean | null = null): string {
    motionPref.reduced = reduced;
    try {
      return renderToStaticMarkup(
        createElement(StoryHome, {
          globeData: { metrics: null, icmFlows: [] } as never,
          academyLine: null,
          l1Count: 70,
          primaryStakeAvax: null,
          primaryStakeUsd: null,
          avaxUsdPrice: null,
          supplyStakedPct: null,
          defi: { tvlUsd: null, stablesUsd: null, dexVolume30dUsd: null },
        }),
      );
    } finally {
      motionPref.reduced = null;
    }
  }

  it('the hero, whose exit dim holds still under Reduce Motion in CSS rather than through a branch in its render', () => {
    const server = home();
    expect(server).toMatch(/<section data-chapter="hero"/);
    expect(home(true)).toBe(server);
    expect(home(false)).toBe(server);
    // the dim keeps its MotionValue either way; under Reduce Motion a layered !important holds it at 1
    expect(between(story, 'function ChapterOne()', '\n}\n')).toMatch(
      /className=["'][^"']*\bmotion-reduce:opacity-100!/,
    );
  });
});

describe('home-hero-word: each word lands, the full stop confirms it', () => {
  it('the next noun enters in 320ms while the last leaves in 240ms, both blurred 2px as they cross', () => {
    expect(NOUN_ROLL.initial).toEqual({ y: '100%', filter: 'blur(2px)' });
    expect(NOUN_ROLL.animate).toEqual({
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.32, ease: EASE_OUT },
      transitionEnd: { filter: 'none' },
    });
    expect(NOUN_ROLL.exit).toEqual({ y: '-100%', filter: 'blur(2px)', transition: { duration: 0.24, ease: EASE_OUT } });
  });

  it('the slot width settles with the roll: 320ms on the strong ease-out', () => {
    expect(NOUN_WIDTH).toBe('width 320ms var(--ease-out)');
    expect(story).toMatch(/transition: NOUN_WIDTH/);
  });

  it('the full stop drops 0.16em into place once per word, in 260ms, then holds still', () => {
    expect(STOP_DROP).toEqual({
      initial: { opacity: 0.3, y: '-0.16em' },
      animate: { opacity: 1, y: '0em' },
      transition: { duration: 0.26, delay: 0.22, ease: EASE_OUT },
    });
  });

  it('the words roll together (no wait), and the full stop no longer pulses', () => {
    expect(story).not.toMatch(/mode="wait"/);
    expect(story).toMatch(/\{\.\.\.NOUN_ROLL\}/);
    expect(story).not.toMatch(/animate-\[pulse/);
    expect(story).toMatch(/initial=\{turn === 0 \? false : STOP_DROP\.initial\}/);
  });

  it("the leaving noun leaves the heading's accessible name at once", () => {
    expect(story).toMatch(/aria-hidden=\{isPresent \? undefined : true\}/);
  });

  it('under Reduce Motion the noun does not rotate', () => {
    expect(between(story, 'function ChapterOne()', 'setInterval')).toMatch(/if \(reducedMotion\) return;/);
  });
});

describe('home-board-arrival: a quicker arrival, figures that land instead of counting from zero', () => {
  it('the board is in place at once; its rows settle 8px in 300ms, 50ms apart', () => {
    expect(BOARD_VARIANTS).toEqual({ hidden: {}, show: { transition: { staggerChildren: 0.05 } } });
    expect(ROW_VARIANTS).toEqual({
      hidden: { opacity: 0, y: 8 },
      show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
    });
  });

  it('under Reduce Motion the rows show at once, with no cascade', () => {
    expect(BOARD_STATIC).toEqual({ hidden: {}, show: { transition: { staggerChildren: 0 } } });
    expect(ROW_STATIC).toEqual({
      hidden: ROW_VARIANTS.hidden,
      show: { opacity: 1, y: 0, transition: { duration: 0 } },
    });
  });

  it('the heading settles 8px in 400ms, like the chapter titles below', () => {
    expect(HEADING_RISE).toEqual({ initial: { opacity: 0, y: 8 }, transition: { duration: 0.4, ease: EASE_OUT } });
    expect(story).toMatch(/initial=\{HEADING_RISE\.initial\}/);
  });

  it('a figure counts only its last 6%, in 600ms on the strong ease-out', () => {
    expect(COUNT_FROM).toBe(0.94);
    expect(COUNT).toEqual({ duration: 0.6, ease: EASE_OUT });
  });

  it('a figure never counts up from 0: the server sends the figure itself', () => {
    const figure = between(story, 'function LedgerFigure(', '\n}\n');
    expect(figure).not.toMatch(/useState\(0\)/);
    expect(figure).toMatch(/useState\(value\)/);
    expect(figure).toMatch(/value \* COUNT_FROM/);
    expect(figure).toMatch(/\.\.\.COUNT,/);
  });

  it('the home no longer carries the old production curve', () => {
    expect(story).not.toMatch(/0\.22,\s*1,\s*0\.36,\s*1/);
    expect(story).toMatch(/from ['"]@\/components\/landing-v2\/home-motion['"]/);
  });
});

describe('home scroll padding: the site-wide anchor rule pads the home', () => {
  it('StoryHome no longer tags <html> with v2-snap, and global.css has no html.v2-snap rule', () => {
    expect(story).not.toMatch(/classList\.(add|remove)\("v2-snap"\)/);
    expect(rulesFor('html.v2-snap')).toEqual([]);
    expect(css).not.toMatch(/html\.v2-snap/);
  });
});
