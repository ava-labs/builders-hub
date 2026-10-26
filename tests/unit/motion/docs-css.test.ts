import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { declOf, declsOf, read, rulesFor as rulesIn, ungatedHover } from './helpers';

/**
 * Task 9 of the hub motion pass, the docs CSS polish: docs-phone-drawer, docs-anchor-flash, docs-tabs-slide,
 * docs-mermaid-fade, docs-pager-nudge and docs-colorkey-fade, with the values of each proposal's spec and its
 * Reduce Motion path. Under Reduce Motion the site policy (app/global.css) runs every keyframe animation in 1ms
 * and keeps only colour, opacity and shadow transitions, at 150ms.
 */
const GLOBAL = 'app/global.css';
const DOCS = 'app/docs/styles.css';
const ACADEMY = 'app/academy/styles.css';
const TOKENS = 'app/docs/book/tokens.css';
const CODE = 'app/docs/book/code.css';
const MERMAID = 'app/docs/book/mermaid.css';
const COLORKEY = 'app/docs/book/colorkey.css';
const WRAPPER = 'app/docs/docs-layout-wrapper.tsx';
const MERMAID_TSX = 'components/content-design/mermaid.tsx';
const COLORKEY_TSX = 'components/docs-book/color-key-toggle.tsx';
const CSS_FILES = [DOCS, ACADEMY, TOKENS, CODE, MERMAID, COLORKEY];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const REDUCE = /prefers-reduced-motion:\s*reduce/;

interface Found {
  rule: Rule;
  /** the params of each @media the rule sits in, outermost first */
  media: string[];
}

const isReduced = (found: Found) => found.media.some((params) => REDUCE.test(params));

/** Each rule in `css` whose selector list holds `selector` exactly. */
function rulesFor(css: string, selector: string): Found[] {
  return rulesIn(selector, { root: postcss.parse(css) }).map(({ rule, at }) => ({
    rule,
    media: at.filter((around) => around.startsWith('@media ')).map((around) => around.slice('@media '.length)),
  }));
}

/** The one rule for `selector` outside Reduce Motion, or the one inside it. */
function one(css: string, selector: string, reduced = false): Found {
  const found = rulesFor(css, selector).filter((f) => isReduced(f) === reduced);
  expect(found, `${reduced ? 'reduced ' : ''}rule for ${selector}`).toHaveLength(1);
  return found[0];
}

const valueOf = (rule: Rule, prop: string): string | undefined => declOf(rule, prop)?.value;

const toMs = (time: string) => (time.endsWith('ms') ? Number(time.slice(0, -2)) : Number(time.slice(0, -1)) * 1000);
const TIME = /^[\d.]+m?s$/;
const FILL_AND_FRIENDS = new Set(['both', 'forwards', 'backwards', 'none', 'normal', 'reverse', 'infinite', 'running']);
const EASING = /^(var\(--ease|cubic-bezier|ease|linear|steps)/;

/** An `animation` shorthand with one animation: its keyframes name, duration, delay, easing and fill. */
function parseAnimation(value: string | undefined) {
  const tokens = value?.match(/[\w-]+\([^)]*\)|\S+/g) ?? [];
  const times = tokens.filter((token) => TIME.test(token)).map(toMs);
  const easing = tokens.find((token) => EASING.test(token));
  const name = tokens.find((token) => !TIME.test(token) && token !== easing && !FILL_AND_FRIENDS.has(token));
  return { name, ms: times[0], delayMs: times[1] ?? 0, easing, fill: tokens.find((token) => token === 'both') };
}

/** The @keyframes named `name` in `css`: each keyframe selector with its declarations. */
function keyframes(css: string, name: string | undefined): Record<string, Record<string, string>> {
  const frames: Record<string, Record<string, string>> = {};
  postcss.parse(css).walkAtRules('keyframes', (atRule) => {
    if (atRule.params !== name) return;
    atRule.walkRules((frame) => {
      frames[frame.selector] = Object.fromEntries(
        frame.nodes.filter((node): node is Declaration => node.type === 'decl').map((decl) => [decl.prop, decl.value]),
      );
    });
  });
  return frames;
}

/** Every property a @keyframes block animates. */
const animated = (frames: Record<string, Record<string, string>>) =>
  [...new Set(Object.values(frames).flatMap((frame) => Object.keys(frame)))].sort();

describe('docs-phone-drawer', () => {
  it('global.css no longer pins the phone drawer with an !important transform', () => {
    const pinned: string[] = [];
    postcss.parse(read(GLOBAL)).walkRules((rule) => {
      if (!rule.selector.includes('nd-sidebar-mobile')) return;
      rule.walkDecls(/^(transform|translate)$/, (decl) => {
        if (decl.important) pinned.push(`${rule.selector} { ${decl.toString()} }`);
      });
    });
    expect(pinned).toEqual([]);
  });

  it('once fumadocs hides the closed drawer (.invisible), it waits behind the left edge, without !important', () => {
    // a row of the drawer keeps visibility: visible (global.css forces it on the section description), so in place,
    // after a Reduce Motion fade, the hidden drawer would still take taps
    const pin = one(read(GLOBAL), '#nd-sidebar-mobile.invisible');
    expect(pin.media).toEqual(['(max-width: 1023px)']);
    expect(declOf(pin.rule, 'translate')?.value).toBe('-100% 0');
    expect(declOf(pin.rule, 'translate')?.important).not.toBe(true);
    // and it runs no animation: the exit rules skip a hidden drawer, so without this fumadocs' own
    // data-[state=closed]:animate-fd-sidebar-out would move it across the screen at a page load
    expect(valueOf(pin.rule, 'animation')).toBe('none');
  });

  it('docs: the backdrop keeps its dim while it fades out, so dim and blur leave as one', () => {
    const css = read(DOCS);
    const dimOpen = 'body[data-layout="docs"] div.fixed.inset-0[data-state="open"]:not(aside):not([id])';
    const dimLeaving = 'body[data-layout="docs"] div.backdrop-blur-xs[data-state="closed"]:has(+ #nd-sidebar-mobile)';
    const open = valueOf(one(css, dimOpen).rule, 'background-color');
    expect(open).toBe('rgba(0, 0, 0, 0.5)');
    expect(valueOf(one(css, dimLeaving).rule, 'background-color')).toBe(open);
  });

  const LAYOUTS = [
    { file: DOCS, scope: '' },
    { file: ACADEMY, scope: 'body[data-layout="academy"] ' },
  ];

  describe.each(LAYOUTS)('$file', ({ file, scope }) => {
    const css = read(file);
    // The exit runs only while the closed drawer is still shown: fumadocs mounts it after hydration already closed and
    // hidden (.invisible), and an exit there would start it at translate 0, on screen for a few frames.
    const panel = (state: string) =>
      `${scope}#nd-sidebar-mobile[data-state="${state}"]${state === 'closed' ? ':not(.invisible)' : ''}`;
    const backdrop = (state: string) => `${scope}div.backdrop-blur-xs[data-state="${state}"]:has(+ #nd-sidebar-mobile)`;
    const animationOf = (selector: string, reduced = false) => {
      const found = one(css, selector, reduced);
      expect(found.media.some((params) => params.includes('max-width: 1023px'))).toBe(true);
      return {
        ...parseAnimation(valueOf(found.rule, 'animation')),
        important: declOf(found.rule, 'animation')?.important,
      };
    };

    it('the panel slides in from the left edge on the drawer curve in 300ms, with no fade', () => {
      const open = animationOf(panel('open'));
      expect(open).toMatchObject({ ms: 300, delayMs: 0, easing: 'var(--ease-drawer)', fill: 'both' });
      const frames = keyframes(css, open.name);
      expect(animated(frames)).toEqual(['translate']);
      expect(frames.from.translate).toBe('-100% 0');
      expect(frames.to.translate).toBe('0 0');
    });

    it('the panel leaves in 200ms on the strong ease-out, and its backdrop leaves in the same 200ms', () => {
      const close = animationOf(panel('closed'));
      expect(close).toMatchObject({ ms: 200, delayMs: 0, easing: 'var(--ease-out)', fill: 'both' });
      const frames = keyframes(css, close.name);
      expect(animated(frames)).toEqual(['translate']);
      expect(frames.from.translate).toBe('0 0');
      expect(frames.to.translate).toBe('-100% 0');

      const blurOut = animationOf(backdrop('closed'));
      expect(blurOut).toMatchObject({ ms: 200, delayMs: 0, easing: 'var(--ease-out)', fill: 'both' });
      expect(keyframes(css, blurOut.name)).toEqual({ from: { opacity: '1' }, to: { opacity: '0' } });

      const blurIn = animationOf(backdrop('open'));
      expect(blurIn).toMatchObject({ ms: 300, delayMs: 0, easing: 'var(--ease-drawer)', fill: 'both' });
      expect(keyframes(css, blurIn.name)).toEqual({ from: { opacity: '0' }, to: { opacity: '1' } });
    });

    it('a drawer that is already hidden runs no exit keyframes, so it never shows at a page load', () => {
      const unguarded = rulesFor(css, `${scope}#nd-sidebar-mobile[data-state="closed"]`).filter(({ rule }) =>
        declOf(rule, 'animation'),
      );
      expect(unguarded.map(({ rule }) => rule.selector)).toEqual([]);
    });

    it('open and closed run different keyframes, so Radix Presence waits for the exit to end', () => {
      expect(animationOf(panel('open')).name).not.toBe(animationOf(panel('closed')).name);
      expect(animationOf(backdrop('open')).name).not.toBe(animationOf(backdrop('closed')).name);
      // and the Reduce Motion fades too
      expect(animationOf(panel('open'), true).name).not.toBe(animationOf(panel('closed'), true).name);
      expect(animationOf(backdrop('open'), true).name).not.toBe(animationOf(backdrop('closed'), true).name);
    });

    it('Reduce Motion: panel and backdrop cross-fade, 150ms in and 120ms out, with no travel', () => {
      for (const selector of [panel('open'), backdrop('open')]) {
        const fadeIn = animationOf(selector, true);
        // !important beats the site policy, which runs every animation in 1ms
        expect(fadeIn).toMatchObject({ ms: 150, delayMs: 0, easing: 'var(--ease-out)', important: true });
        expect(keyframes(css, fadeIn.name)).toEqual({ from: { opacity: '0' }, to: { opacity: '1' } });
      }
      for (const selector of [panel('closed'), backdrop('closed')]) {
        const fadeOut = animationOf(selector, true);
        expect(fadeOut).toMatchObject({ ms: 120, delayMs: 0, easing: 'var(--ease-out)', important: true });
        expect(keyframes(css, fadeOut.name)).toEqual({ from: { opacity: '1' }, to: { opacity: '0' } });
      }
    });
  });

  it.each([
    { file: DOCS, layout: 'docs' },
    { file: ACADEMY, layout: 'academy' },
  ])(
    '$layout: opened or closed from the keyboard, the drawer and its backdrop show and go at once, Reduce Motion included',
    ({ file, layout }) => {
      // the phone menu's approach (site-phone-menu): while the keyboard focus sits on the navbar's toggle (which opens the
      // drawer) or anywhere in the drawer (its close button, a link), nothing animates; a tap focuses with no ring. The
      // docs and the Academy drawers take the same rule, each in its own layout's stylesheet.
      const css = read(file);
      const keyboard = `body[data-layout="${layout}"]:has([data-docs-sidebar-toggle]:focus-visible, #nd-sidebar-mobile :focus-visible)`;
      const panel = `${keyboard} #nd-sidebar-mobile[data-state]`;
      const backdrop = `${keyboard} div.backdrop-blur-xs[data-state]:has(+ #nd-sidebar-mobile)`;
      const instant = one(css, panel);
      expect(instant.rule.selectors).toEqual([panel, backdrop]);
      expect(instant.media).toEqual(['(max-width: 1023px)']);
      // The keyframes run in 0s and keep their name, as the mega menu's hold does (site-mega-menu, app/global.css): a
      // key pressed during an exit the pointer started ends that exit at once, so Radix Presence still unmounts the
      // drawer and its backdrop.
      expect(declsOf(instant.rule).map((decl) => decl.toString())).toEqual(['animation-duration: 0s !important']);
      // it comes after every drawer animation, the Reduce Motion fades included, and outranks them with a second id
      const at = instant.rule.source?.start?.offset ?? 0;
      postcss.parse(css).walkRules((rule) => {
        const offset = rule.source?.start?.offset ?? 0;
        if (offset === at || !/nd-sidebar-mobile/.test(rule.selector) || !declOf(rule, 'animation')) return;
        expect(offset, rule.selector).toBeLessThan(at);
        for (const selector of rule.selectors)
          expect((selector.match(/#[\w-]+/g) ?? []).length, selector).toBeLessThan(2);
      });
    },
  );

  it.each([DOCS, ACADEMY])('%s: a keyboard rule of the drawer never drops the keyframes name', (file) => {
    // Radix Presence (fumadocs mounts the drawer and its backdrop through it) ends an exit only on an end or cancel
    // whose name the current animation holds. With `animation: none` or `animation-name: none`, a key pressed during an
    // exit the pointer started cancels that exit under a name that is gone: the drawer stays on screen, closed, with
    // its backdrop over the page. The shorthand resets the name too, so these rules set no shorthand at all.
    const keyboard: string[] = [];
    const dropped: string[] = [];
    postcss.parse(read(file)).walkRules((rule) => {
      if (!rule.selector.includes('nd-sidebar-mobile') || !rule.selector.includes(':focus-visible')) return;
      keyboard.push(rule.selector);
      for (const decl of declsOf(rule)) {
        if (decl.prop === 'animation' || (decl.prop === 'animation-name' && /\bnone\b/.test(decl.value)))
          dropped.push(`${rule.selector} { ${decl.toString()} }`);
      }
    });
    expect(keyboard.length).toBeGreaterThan(0);
    expect(dropped).toEqual([]);
  });
});

describe('docs-anchor-flash', () => {
  const css = read(TOKENS);
  const MARK = '[data-route-layout="docs"] #nd-page article [data-bk-anchor-mark]';
  const WASH = 'color-mix(in oklab, currentColor 9%, transparent)';

  it('tokens.css gives the heading an ink wash: held 400ms, then faded over 1.2s on the strong ease-out', () => {
    const { rule } = one(css, MARK);
    const wash = parseAnimation(valueOf(rule, 'animation'));
    expect(wash).toMatchObject({ ms: 1600, delayMs: 0, easing: 'var(--ease-out)', fill: 'both' });
    // 0% to 25% of 1600ms holds the wash for 400ms; the fade to transparent takes the other 1200ms
    expect(keyframes(css, wash.name)).toEqual({
      '0%, 25%': { 'background-color': WASH, 'box-shadow': `0 0 0 6px ${WASH}` },
      '100%': { 'background-color': 'transparent', 'box-shadow': '0 0 0 6px transparent' },
    });
  });

  it('the mark changes no box: background and box-shadow only', () => {
    const { rule } = one(css, MARK);
    const wash = parseAnimation(valueOf(rule, 'animation'));
    expect(animated(keyframes(css, wash.name))).toEqual(['background-color', 'box-shadow']);
    const props = rule.nodes.filter((node): node is Declaration => node.type === 'decl').map((decl) => decl.prop);
    expect(props.sort()).toEqual(['animation', 'border-radius']);
  });

  it('Reduce Motion keeps the wash, a colour change with no movement, at 1s', () => {
    const { rule } = one(css, MARK, true);
    expect(valueOf(rule, 'animation-duration')).toBe('1000ms');
    // !important beats the site policy, which runs every animation in 1ms
    expect(declOf(rule, 'animation-duration')?.important).toBe(true);
  });

  it('the docs layout marks the heading when the jump lands: on scrollend, or at once when no scroll starts', () => {
    const src = read(WRAPPER);
    expect(src).toContain("const ANCHOR_MARK = 'data-bk-anchor-mark';");
    expect(src).toMatch(/addEventListener\('scrollend', land\)/);
    // the scroll that a jump starts arrives within a frame or two; no scroll by then means the heading is in place
    expect(src).toMatch(/const NO_SCROLL_MS = \d{2,3};/);
    expect(src).toMatch(/setTimeout\(land, NO_SCROLL_MS\)/);
    // a link in the page (On this page, a heading link) and a #section deep link on load both mark
    expect(src).toMatch(/document\.addEventListener\('click', onClick, true\)/);
    expect(src).toMatch(/idFromHash\(location\.hash\)/);
  });

  it('below 1024px a #section link opened on load also stops below the fixed bars', () => {
    // Scoped to the server-rendered [data-route-layout], not body[data-layout] (set after hydration): the browser's
    // fragment scroll on load runs before hydration. The margin itself is unchanged.
    const heading = '[data-route-layout="docs"] #nd-tocnav ~ article :is(h1, h2, h3, h4, h5, h6)[id]';
    const { rule, media } = one(read(DOCS), heading);
    expect(media).toEqual(['(max-width: 1023px)']);
    expect(valueOf(rule, 'scroll-margin-top')).toBe('calc(var(--fd-banner-height, 0px) + 9.5rem)');
    expect(rulesFor(read(DOCS), heading.replace('[data-route-layout="docs"]', 'body[data-layout="docs"]'))).toEqual([]);
  });

  it('on a phone, a mark that lands under the open On this page popover starts when the popover closes', () => {
    const src = read(WRAPPER);
    expect(src).toContain(`const TOC_POPOVER_OPEN = '#nd-tocnav[data-state="open"]';`);
    expect(src).toMatch(/observe\(toc, \{ attributes: true, attributeFilter: \['data-state'\] \}\)/);
  });
});

describe('docs-tabs-slide', () => {
  const css = read(CODE);
  const LIST = '[data-route-layout="docs"] [role="tablist"][data-bk-tab-line]';

  it('code.css draws one 1px underline that travels with transform on the in-out curve in 250ms', () => {
    const { rule } = one(css, `${LIST}::after`);
    expect(valueOf(rule, 'transition')).toBe('transform 250ms var(--ease-in-out)');
    expect(valueOf(rule, 'transform')).toBe('translateX(var(--bk-tab-x)) scaleX(var(--bk-tab-w))');
    expect(valueOf(rule, 'transform-origin')).toBe('0 0');
    expect(valueOf(rule, 'height')).toBe('1px');
    expect(valueOf(rule, 'width')).toBe('1px');
    expect(valueOf(rule, 'position')).toBe('absolute');
    expect(valueOf(rule, 'background')).toBe('var(--color-fd-primary)');
  });

  it('the active tab hands its own line to the travelling one, which the list positions', () => {
    expect(valueOf(one(css, `${LIST} > [role="tab"][data-state="active"]`).rule, 'border-color')).toBe('transparent');
    const { rule } = one(css, LIST);
    // position only: flex-shrink 0 mattered only for variant B's height ease, which is not built
    expect(rule.nodes.filter((node): node is Declaration => node.type === 'decl').map((d) => d.toString())).toEqual([
      'position: relative',
    ]);
  });

  it('a first draw or a resize places the line without travel', () => {
    const still = '[data-route-layout="docs"] [role="tablist"][data-bk-tab-line="still"]::after';
    expect(valueOf(one(css, still).rule, 'transition')).toBe('none');
  });

  it('the docs layout measures the active tab of each tab list', () => {
    const src = read(WRAPPER);
    expect(src).toContain("const TAB_LINE = 'data-bk-tab-line';");
    expect(src).toMatch(/setProperty\('--bk-tab-x', `\$\{x\}px`\)/);
    expect(src).toMatch(/setProperty\('--bk-tab-w', String\(w\)\)/);
    // the observers watch the page's article only, not the whole docs layout (sidebar, sub-nav, TOC)
    expect(src).toContain("const article = document.querySelector<HTMLElement>('#nd-page article');");
    expect(src).toMatch(
      /changes\.observe\(article, \{ subtree: true, childList: true, attributes: true, attributeFilter: \['data-state'\] \}\)/,
    );
  });
});

describe('docs-mermaid-fade', () => {
  const css = read(MERMAID);
  const SVG = '[data-route-layout="docs"] [data-mermaid] > svg';

  it('a chart fades in on its first draw: opacity 0 to 1 in 240ms on the strong ease-out', () => {
    const fade = rulesFor(css, SVG).filter(({ rule }) => declOf(rule, 'transition'));
    expect(fade).toHaveLength(1);
    expect(valueOf(fade[0].rule, 'transition')).toBe('opacity 240ms var(--ease-out)');
    const start: Rule[] = [];
    postcss.parse(css).walkAtRules('starting-style', (atRule) => {
      atRule.walkRules((rule) => {
        start.push(rule);
      });
    });
    expect(start.map((rule) => rule.selector)).toEqual([
      '[data-route-layout="docs"] [data-mermaid]:not([data-bk-redraw]) > svg',
    ]);
    expect(start[0].nodes.map((node) => node.toString())).toEqual(['opacity: 0']);
  });

  it('a redraw of the same chart (after a light/dark switch) shows at once, with no fade', () => {
    const src = read(MERMAID_TSX);
    const mark = src.indexOf('container.toggleAttribute("data-bk-redraw", drawnChart.get(container) === chart);');
    const swap = src.indexOf('container.innerHTML = svg;');
    const remember = src.indexOf('drawnChart.set(container, chart);');
    expect(mark).toBeGreaterThan(-1);
    // the mark is set before the new drawing goes in, so its first style already skips the starting style
    expect(swap).toBeGreaterThan(mark);
    expect(remember).toBeGreaterThan(swap);
  });

  it('the chart never moves: no transform, translate or scale in mermaid.css', () => {
    const moves: string[] = [];
    postcss.parse(css).walkDecls(/^(transform|translate|scale|rotate)$/, (decl) => {
      moves.push(decl.toString());
    });
    expect(moves).toEqual([]);
  });
});

describe('docs-pager-nudge', () => {
  describe.each([
    { file: DOCS, scope: '[data-route-layout="docs"]' },
    { file: ACADEMY, scope: '[data-route-layout="academy"]' },
  ])('$file', ({ file, scope }) => {
    const css = read(file);
    // fumadocs PageFooter: the Previous card, then the Next card (text-end); the related-cards grid has no pb-6
    const pager = `${scope} .\\@container.grid.pb-6 >`;

    it('the chevrons ease on the strong ease-out in 180ms', () => {
      expect(valueOf(one(css, `${pager} a > div > svg`).rule, 'transition')).toBe('transform 180ms var(--ease-out)');
    });

    it('on hover, the chevron moves 2px toward where the link goes, for a hovering fine pointer only', () => {
      const previous = one(css, `${pager} a:not(.text-end):hover > div > svg`);
      const next = one(css, `${pager} a.text-end:hover > div > svg`);
      expect(valueOf(previous.rule, 'transform')).toBe('translateX(-2px)');
      expect(valueOf(next.rule, 'transform')).toBe('translateX(2px)');
      for (const { media } of [previous, next]) {
        // Reduce Motion: no nudge; the card's background fade stays
        expect(media).toEqual(['(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)']);
      }
    });
  });
});

describe('docs-colorkey-fade', () => {
  const css = read(COLORKEY);

  it('terms and figure parts fade between their role colour and ink in 200ms, once the switch is used', () => {
    const { rule } = one(css, 'html[data-colorkey-fade] [data-route-layout="docs"] [data-bk-role]');
    expect(valueOf(rule, 'transition')).toBe('color 200ms ease');
    // no fade without the switch: a saved Off applied after a page load switches at once
    const ungated = rulesFor(css, '[data-route-layout="docs"] [data-bk-role]').filter(({ rule: r }) =>
      declOf(r, 'transition'),
    );
    expect(ungated).toEqual([]);
  });

  it('Reduce Motion keeps the 200ms colour fade unchanged (the site policy would cut it to 150ms)', () => {
    const { rule } = one(css, 'html[data-colorkey-fade] [data-route-layout="docs"] [data-bk-role]', true);
    expect(valueOf(rule, 'transition-duration')).toBe('200ms');
    expect(declOf(rule, 'transition-duration')?.important).toBe(true);
  });

  it('only a click on the switch turns the fade on, never the saved choice restored on load', () => {
    const src = read(COLORKEY_TSX);
    const toggle = src.match(/const toggle = \(\) => \{([\s\S]*?)\n {2}\};/)?.[1] ?? '';
    expect(toggle).toMatch(/document\.documentElement\.dataset\.colorkeyFade = '';\s*applyOn\(!on\);/);
    const restore = src.match(/useEffect\(\(\) => \{\s*if \(restored\) return;[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
    expect(restore).toContain('applyOn(readSavedOn());');
    expect(restore).not.toContain('colorkeyFade');
  });
});

describe('conventions', () => {
  it.each([...CSS_FILES, WRAPPER, MERMAID_TSX, COLORKEY_TSX])('%s has no transition-all and no ease-in', (file) => {
    const src = read(file);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(CSS_FILES)('%s has no :hover outside @media (hover: hover)', (file) => {
    expect(ungatedHover(read(file))).toBe(0);
  });

  it('global.css: the drawer rules this task touched have no transition-all, ease-in or ungated hover', () => {
    const STATES = ['#nd-sidebar-mobile[data-state="closed"]', '#nd-sidebar-mobile[data-state="open"]'];
    const touched: string[] = [];
    postcss.parse(read(GLOBAL)).walkRules((rule) => {
      if (rule.selectors.some((selector) => STATES.includes(selector))) touched.push(rule.toString());
    });
    expect(touched.length).toBeGreaterThan(0);
    for (const block of touched) {
      expect(block).not.toMatch(TRANSITION_ALL);
      expect(block).not.toMatch(EASE_IN);
      expect(ungatedHover(block)).toBe(0);
    }
    expect(read(GLOBAL)).not.toMatch(EASE_IN);
  });
});
