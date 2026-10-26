import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { EASE_DRAWER, EASE_IN_OUT, EASE_OUT, cssEase } from '@/lib/motion-curves';
import { contrast, cssBlock, declsOf, globalCss, read, rulesFor as rulesIn, type RGB, ungatedHover } from './helpers';

/**
 * Task 1 of the hub motion pass: the strong curves as tokens, Reduce Motion that keeps fades, framer-motion that
 * follows Reduce Motion, the browser surfaces, the phone baseline and the Explorer view switch.
 */
const CSS = 'app/global.css';
const PROVIDERS = 'app/layout.client.tsx';
const LAYOUT = 'app/layout.tsx';
const THEME_OBSERVER = 'components/content-design/theme-observer.tsx';
const CURVES = 'lib/motion-curves.ts';
const CSS_BLOCKS = [
  'site-motion-tokens',
  'site-reduced-motion-policy',
  'site-browser-surfaces',
  'site-phone-baseline',
  'exp-view-switch',
];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const REDUCE = 'prefers-reduced-motion: reduce';

const css = read(CSS);
const root = globalCss;

/** Every declaration of `prop` in global.css, with the at-rule it sits in (`@theme` or `@theme inline`). */
function definitions(prop: string): { value: string; atRule: string }[] {
  const found: { value: string; atRule: string }[] = [];
  root.walkDecls(prop, (decl) => {
    const parent = decl.parent as AtRule | Rule | undefined;
    const atRule = parent?.type === 'atrule' ? `@${parent.name}${parent.params ? ` ${parent.params}` : ''}` : '';
    found.push({ value: decl.value, atRule });
  });
  return found;
}

/** The rules whose selector list holds `selector`, with whether they sit inside `@media (prefers-reduced-motion: reduce)`. */
function rulesFor(selector: string): { rule: Rule; reduced: boolean }[] {
  return rulesIn(selector).map(({ rule }) => {
    const parent = rule.parent as AtRule | undefined;
    return { rule, reduced: parent?.type === 'atrule' && parent.params.includes(REDUCE) };
  });
}

const valueOf = (rule: Rule, prop: string): string | undefined =>
  declsOf(rule).find((decl) => decl.prop === prop)?.value;

describe('cssEase', () => {
  it('formats a curve as a CSS cubic-bezier()', () => {
    expect(cssEase([0.23, 1, 0.32, 1])).toBe('cubic-bezier(0.23, 1, 0.32, 1)');
    expect(cssEase([0, 0, 1, 1])).toBe('cubic-bezier(0, 0, 1, 1)');
  });
});

describe('site-motion-tokens', () => {
  it('tokens match the strong curves', () => {
    expect(css).toContain('--ease-out: cubic-bezier(0.23, 1, 0.32, 1)');
    expect(css).toContain('--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)');
    expect(css).toContain('--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)');
    // one definition each, in a `@theme static` block: Tailwind makes the ease-* utilities from it and always puts the
    // variables on :root, so hand-written CSS anywhere can use var(--ease-out); lib/motion-curves.ts holds the same
    // numbers for JS
    expect(definitions('--ease-out')).toEqual([{ value: cssEase(EASE_OUT), atRule: '@theme static' }]);
    expect(definitions('--ease-in-out')).toEqual([{ value: cssEase(EASE_IN_OUT), atRule: '@theme static' }]);
    expect(definitions('--ease-drawer')).toEqual([{ value: cssEase(EASE_DRAWER), atRule: '@theme static' }]);
  });
});

describe('site-reduced-motion-policy', () => {
  it('reduced motion keeps fades', () => {
    expect(css).not.toContain('transition-duration: 0.01ms');
    const reducers = rulesFor('*::before').filter(({ reduced }) => reduced);
    expect(reducers).toHaveLength(1);
    const reducer = reducers[0].rule;
    expect(reducer.selectors).toEqual(['*', '*::before', '*::after']);
    expect(declsOf(reducer).every((decl) => decl.important)).toBe(true);
    const properties = (valueOf(reducer, 'transition-property') ?? '').split(/,\s*/);
    expect(properties).toEqual(expect.arrayContaining(['color', 'opacity', 'background-color', 'box-shadow']));
    expect(properties).not.toContain('transform');
    expect(properties).not.toContain('all');
    expect(valueOf(reducer, 'transition-duration')).toBe('150ms');
    expect(valueOf(reducer, 'transition-delay')).toBe('0ms');
    expect(valueOf(reducer, 'animation-duration')).toBe('1ms');
    expect(valueOf(reducer, 'animation-iteration-count')).toBe('1');
    expect(valueOf(reducer, 'animation-delay')).toBe('0ms');
    expect(valueOf(reducer, 'scroll-behavior')).toBe('auto');
  });
});

describe('exp-view-switch', () => {
  it('explorer view switch eases out', () => {
    const enter = rulesFor('::view-transition-new(.vs-in)');
    const leave = rulesFor('::view-transition-old(.vs-out)');
    const enterAnimation = enter.find(({ reduced }) => !reduced)?.rule;
    const leaveAnimation = leave.find(({ reduced }) => !reduced)?.rule;
    expect(enterAnimation && valueOf(enterAnimation, 'animation')).toBe('200ms var(--ease-out) 60ms both vs-fade-in');
    // the exit runs its own keyframes forward: played in reverse, vs-fade-in would also run the ease-out backwards (an
    // ease-in)
    expect(leaveAnimation && valueOf(leaveAnimation, 'animation')).toBe('120ms var(--ease-out) both vs-fade-out');
    for (const { rule } of [...enter, ...leave]) {
      expect(rule.toString()).not.toMatch(EASE_IN);
      expect(rule.toString()).not.toContain('80ms');
    }
  });

  it('an untyped transition into either view holds the root still, so no plain link fades the whole page', () => {
    // React starts a view transition whenever the view-switch boundary mounts, typed or not: a plain link into either
    // view got the browser's default 250ms root fade (measured); both views render the explorer subnav
    const held = ['::view-transition-old(root)', '::view-transition-new(root)'].map((pseudo) =>
      rulesFor(`:root:has([data-explorer-subnav])${pseudo}`),
    );
    for (const found of held) {
      expect(found).toHaveLength(1);
      expect(declsOf(found[0].rule).map((decl) => `${decl.prop}: ${decl.value}`)).toEqual(['animation: none']);
    }
    expect(cssBlock('exp-view-switch')).toContain(':root:has([data-explorer-subnav])::view-transition-old(root)');
    expect(read('components/explorer-v2/ExplorerSubnav.tsx')).toContain('<div data-explorer-subnav');
    expect(read('components/explorer-v2/network/NetworkShell.tsx')).toContain('<ExplorerSubnav');
    expect(read('components/explorer-v2/network/NetworkChains.tsx')).toContain('<ExplorerSubnav');
  });

  it('the exit keyframes fade the old view from opacity 1 to 0, forward', () => {
    const frames: Record<string, string> = {};
    root.walkAtRules('keyframes', (atRule) => {
      if (atRule.params !== 'vs-fade-out') return;
      atRule.walkDecls((decl) => {
        frames[(decl.parent as Rule).selector] = `${decl.prop}: ${decl.value}`;
      });
    });
    expect(frames).toEqual({ to: 'opacity: 0' });
  });

  it('keeps a 150ms crossfade under Reduce Motion, with no blur', () => {
    const enter = rulesFor('::view-transition-new(.vs-in)').find(({ reduced }) => reduced)?.rule;
    const leave = rulesFor('::view-transition-old(.vs-out)').find(({ reduced }) => reduced)?.rule;
    expect(enter && valueOf(enter, 'animation')).toBe('150ms var(--ease-out) both vs-fade-in');
    // the exit runs vs-fade-out forward here too: vs-fade-in played in reverse would run its ease-out backwards
    expect(leave && valueOf(leave, 'animation')).toBe('150ms var(--ease-out) both vs-fade-out');
    for (const { rule } of rulesFor('::view-transition-old(.vs-out)')) {
      expect(valueOf(rule, 'animation')).not.toContain('reverse');
    }
    expect(cssBlock('exp-view-switch')).not.toContain('blur');
  });
});

describe('site-browser-surfaces', () => {
  it('selection takes the brand blue tint and keeps the text colour; fields get the red caret', () => {
    const block = postcss.parse(cssBlock('site-browser-surfaces'));
    const selection: Rule[] = [];
    block.walkRules((rule) => {
      if (rule.selector.includes('::selection')) selection.push(rule);
    });
    expect(selection.map((rule) => [rule.selector, valueOf(rule, 'background-color')])).toEqual([
      ['*:not(input, textarea)::selection', 'rgb(0 97 226 / 0.14)'],
      ['.dark *:not(input, textarea)::selection', 'rgb(108 157 255 / 0.16)'],
    ]);
    expect(selection.flatMap((rule) => declsOf(rule).map((decl) => decl.prop))).toEqual([
      'background-color',
      'background-color',
    ]);
    expect(cssBlock('site-browser-surfaces')).toMatch(/caret-color: #e6212f/i);
  });
});

describe('site-browser-surfaces: selected text contrast', () => {
  /** a translucent highlight painted over an opaque ground */
  const over = (top: RGB, alpha: number, ground: RGB): RGB =>
    [0, 1, 2].map((i) => top[i] * alpha + ground[i] * (1 - alpha)) as RGB;
  /** the tint and alpha that a selection rule in global.css paints */
  function tintOf(selector: string): { tint: RGB; alpha: number } {
    let value = '';
    root.walkRules((rule) => {
      if (rule.selector === selector) value = valueOf(rule, 'background-color') ?? '';
    });
    const match = value.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
    if (!match) throw new Error(`no rgb(r g b / a) background on ${selector}: "${value}"`);
    return { tint: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: Number(match[4]) };
  }

  it('measures contrast the WCAG way', () => {
    expect(contrast([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrast([230, 33, 47], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  // The rule, in both themes, applies to text that passes 4.5:1 at rest: selected, such text is never less legible
  // than under the browser's own default highlight (what the site showed before the house tint), except where it still
  // passes 4.5:1. Text that already fails at rest is out of scope. Listed near-threshold colours fall below 4.5:1 when
  // selected; representative pairs are pinned below, and the full list is in the handover.
  // Chromium's default highlight, measured: light rgba(128 188 254 / 0.6), dark rgba(63 99 139 / 0.8).
  type Theme = 'light' | 'dark';
  type Pair = { theme: Theme; text: string; fg: RGB; textAlpha?: number; ground: RGB };
  const BROWSER: Record<Theme, { tint: RGB; alpha: number }> = {
    light: { tint: [128, 188, 254], alpha: 0.6 },
    dark: { tint: [63, 99, 139], alpha: 0.8 },
  };
  const HOUSE: Record<Theme, string> = {
    light: '*:not(input, textarea)::selection',
    dark: '.dark *:not(input, textarea)::selection',
  };
  /** contrast of a (possibly translucent) text colour on its ground, with a highlight painted under it when given */
  const legibility = ({ fg, textAlpha = 1, ground }: Pair, highlight?: { tint: RGB; alpha: number }): number => {
    const back = highlight ? over(highlight.tint, highlight.alpha, ground) : ground;
    return contrast(over(fg, textAlpha, back), back);
  };

  // Colour pairs measured on /docs/primary-network, /docs/nodes/architecture/proposervm, /, /blog,
  // /blog/helicon-upgrade, /explorer/mainnet and /console at 1440 and 390 (rest ratios in the comments).
  const KEEPS: Pair[] = [
    { theme: 'dark', text: 'the brand red link', fg: [255, 57, 74], ground: [10, 10, 10] }, // 5.60 (4.53 selected)
    { theme: 'dark', text: 'a code token', fg: [147, 153, 178], ground: [18, 18, 18] }, // 6.64
    { theme: 'dark', text: 'a card description', fg: [159, 159, 169], ground: [17, 17, 19] }, // 7.19
    { theme: 'dark', text: 'the Note callout title', fg: [95, 157, 255], ground: [10, 10, 10] }, // 7.31
    { theme: 'light', text: 'body text', fg: [10, 10, 10], ground: [245, 245, 245] }, // 18.16
  ];
  it.each(KEEPS)('$theme: $text passes 4.5:1 at rest and keeps it selected', (pair) => {
    expect(legibility(pair)).toBeGreaterThanOrEqual(4.5);
    expect(legibility(pair, tintOf(HOUSE[pair.theme]))).toBeGreaterThanOrEqual(4.5);
  });

  // Near-threshold colours: they pass 4.5:1 at rest and fall below it when selected (the browser's own highlight takes
  // them lower still). Representative listed exemptions, held to the browser's default highlight instead of 4.5:1.
  const EXEMPT: Pair[] = [
    { theme: 'dark', text: 'a blog author name', fg: [158, 158, 158], textAlpha: 0.8, ground: [23, 23, 23] }, // 4.72
    { theme: 'dark', text: 'a blog tag pill', fg: [158, 158, 158], ground: [38, 38, 38] }, // 5.64
    { theme: 'dark', text: 'a blog chart legend', fg: [59, 130, 246], ground: [16, 24, 40] }, // 4.83
    { theme: 'light', text: 'brand red text', fg: [230, 33, 47], ground: [255, 255, 255] }, // 4.54
    { theme: 'light', text: 'a console label', fg: [113, 113, 123], ground: [249, 249, 249] }, // 4.58
    { theme: 'light', text: 'a code token', fg: [30, 102, 245], ground: [250, 250, 250] }, // 4.71
    { theme: 'light', text: 'a sidebar link', fg: [95, 107, 122], ground: [245, 245, 245] }, // 4.98
    { theme: 'light', text: 'the Note callout title', fg: [0, 97, 226], ground: [245, 245, 245] }, // 5.06
    { theme: 'light', text: 'an explorer link', fg: [0, 97, 226], ground: [255, 255, 255] }, // 5.51
  ];
  it.each(EXEMPT)(
    '$theme: $text (an exemption) is at least as legible selected as under the browser default highlight, not 4.5:1',
    (pair) => {
      expect(legibility(pair)).toBeGreaterThanOrEqual(4.5);
      expect(legibility(pair, tintOf(HOUSE[pair.theme]))).toBeGreaterThanOrEqual(legibility(pair, BROWSER[pair.theme]));
    },
  );
});

describe('site-phone-baseline', () => {
  it('drops the tap flash and the double-tap wait on controls', () => {
    const block = cssBlock('site-phone-baseline');
    expect(block).toMatch(/html \{\s*-webkit-tap-highlight-color: transparent;\s*\}/);
    expect(block).toContain(':is(a, button, [role="button"], summary, label) {\n    touch-action: manipulation;');
  });

  it('the status bar follows the theme picked on the site', () => {
    const layout = read(LAYOUT);
    const observer = read(THEME_OBSERVER);
    expect(layout).toContain('const THEME_COLOR = { light: "#fff", dark: "#0A0A0A" };');
    expect(layout).toContain('{ media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark }');
    expect(layout).toContain('{ media: "(prefers-color-scheme: light)", color: THEME_COLOR.light }');
    expect(layout).toContain('<ThemeProvider themeColor={THEME_COLOR}>');
    // the observer's own entry goes first in <head>: the browser takes the first theme-color that matches, and Next
    // re-renders its per-scheme entries on every client navigation, so rewriting those would not hold
    expect(observer).toContain('meta[name="theme-color"][data-site-theme]');
    expect(observer).toContain('document.head.prepend(meta)');
  });
});

describe('X1: framer-motion follows Reduce Motion', () => {
  it('framer follows the OS', () => {
    const providers = read(PROVIDERS);
    expect(providers).toMatch(/<MotionConfig reducedMotion="user">\{children\}<\/MotionConfig>/);
    // Body wraps every page once: the root layout renders it around the whole app
    expect(read(LAYOUT)).toMatch(/<Body>[\s\S]*\{children\}[\s\S]*<\/Body>/);
  });
});

describe('conventions', () => {
  it.each([PROVIDERS, LAYOUT, THEME_OBSERVER, CURVES])('%s has no transition-all and no ease-in', (file) => {
    const src = read(file);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it('global.css has no ease-in', () => {
    expect(css).not.toMatch(EASE_IN);
  });

  it.each(CSS_BLOCKS)('global.css heads a %s block, with no transition-all and no ungated hover', (id) => {
    const block = cssBlock(id);
    expect(block).not.toBe('');
    expect(block).not.toMatch(TRANSITION_ALL);
    expect(ungatedHover(block)).toBe(0);
  });
});
