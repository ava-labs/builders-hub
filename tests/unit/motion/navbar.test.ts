import postcss, { type ChildNode, type Root } from 'postcss';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atRulesAround, block, globalCss, read, ungatedHover } from './helpers';

// The user button pulls in the auth client; the menus under test never render it.
vi.mock('@/components/login/user-button/UserButtonWrapper', () => ({ UserButtonWrapper: () => null }));

/**
 * Task 3 of the hub motion pass, the navbar menus: the desktop menus drop in without stretching (site-mega-menu,
 * variant a), the phone sheet drops from its button and folds back (site-phone-menu, variant a), a theme change spreads
 * from the toggle (site-theme-switch, variant a) and a slow navbar link shows that the click landed (site-link-pending,
 * variant a).
 */
const NAV_CONFIG = 'app/layout.config.tsx';
const DROPDOWN = 'components/navigation/navbar-dropdown.tsx';
const HINT = 'components/navigation/pending-hint.tsx';
const SWITCH = 'components/navigation/theme-switch.tsx';
const SOURCES = [NAV_CONFIG, DROPDOWN, HINT, SWITCH];
/** This task's blocks in global.css: the file is shared, so other lanes' text never decides this test. */
const BLOCKS = ['site-mega-menu', 'site-phone-menu', 'site-theme-switch', 'site-link-pending'];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const EASE_OUT = 'var(--ease-out)';
const EASE_IN_OUT = 'var(--ease-in-out)';
const REDUCE = '@media (prefers-reduced-motion: reduce)';
const STARTING = '@starting-style';

const norm = (selector: string) => selector.replace(/'/g, '"').replace(/\s+/g, ' ').trim();

/** The declarations of every rule in `css` whose selector list holds `selector`, inside exactly `context` at-rules. */
function decls(css: Root, selector: string, context = ''): Record<string, string> {
  const found: Record<string, string> = {};
  css.walkRules((rule) => {
    if (!rule.selectors.map(norm).includes(norm(selector)) || atRulesAround(rule).join(' ') !== context) return;
    rule.each((node) => {
      if (node.type === 'decl') found[node.prop] = node.important ? `${node.value} !important` : node.value;
    });
  });
  return found;
}

/** Split a CSS list on its top-level commas (the commas inside cubic-bezier() or var() stay). */
function split(value: string | undefined): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value ?? '') {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const ms = (time: string | undefined) => {
  const match = (time ?? '').match(/^([\d.]+)(ms|s)$/);
  return match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) : Number.NaN;
};

/** Each transitioned property with its duration (ms) and curve, from the longhands (the lists repeat to the longest). */
function transitions(found: Record<string, string>): Record<string, { duration: number; easing: string }> {
  const properties = split(found['transition-property']);
  const durations = split(found['transition-duration']);
  const easings = split(found['transition-timing-function']);
  return Object.fromEntries(
    properties.map((property, i) => [
      property,
      { duration: ms(durations[i % durations.length]), easing: easings[i % easings.length] ?? '' },
    ]),
  );
}

/** The keyframes named `name` in `css`, as the text of its blocks. */
function keyframes(css: Root, name: string): string {
  let text = '';
  css.walkAtRules('keyframes', (rule) => {
    if (rule.params === name) text = rule.toString();
  });
  return text;
}

const animationName = (value: string | undefined) => (value ?? '').split(/\s+/)[0];

describe('the touched files keep the motion rules', () => {
  it.each(SOURCES)('%s names its transitions and never eases in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(BLOCKS)('global.css has a %s block that names its transitions, never eases in and gates hover', (id) => {
    const text = block(id);
    expect(text, `a comment-headed block for ${id}`).not.toBe('');
    expect(text).not.toMatch(TRANSITION_ALL);
    expect(text).not.toMatch(EASE_IN);
    expect(ungatedHover(text)).toBe(0);
  });
});

describe('site-mega-menu: the desktop menus drop in without stretching', () => {
  const css = postcss.parse(block('site-mega-menu'));
  const PANEL = '#nd-nav > :last-child > div';
  const OPEN = `${PANEL}[data-state="open"]`;
  const CLOSED = `${PANEL}[data-state="closed"]`;
  const MENU = `${PANEL} > [data-motion]`;
  const LEAVING = `${PANEL} > [data-motion^="to-"]`;
  const KEYBOARD = '#nd-nav:has(nav > ul > li > button[aria-controls]:focus-visible) > :last-child > div';

  it('the panel arrives at full size: no height keyframes from 0, a fade from 6px up and 98.5% from the top centre', () => {
    const panel = decls(css, PANEL);
    // fumadocs' fd-nav-menu-in grows the height from 0px; the panel's own animation is switched off
    expect(panel.animation).toBe('none');
    expect(block('site-mega-menu')).not.toMatch(/fd-nav-menu-(in|out)/);
    css.walkAtRules('keyframes', (rule) => expect(rule.toString(), rule.params).not.toMatch(/\bheight\b/));
    expect(panel['transform-origin']).toBe('top center');
    expect(decls(css, OPEN, STARTING)).toEqual({ opacity: '0', translate: '0 -6px', scale: '0.985' });
  });

  it('the panel enters in 150 to 250ms on the strong ease-out and leaves faster, 4px up', () => {
    const enter = transitions(decls(css, PANEL));
    for (const property of ['opacity', 'translate', 'scale']) {
      expect(enter[property]?.easing, property).toBe(EASE_OUT);
      expect(enter[property]?.duration, property).toBeGreaterThanOrEqual(150);
      expect(enter[property]?.duration, property).toBeLessThanOrEqual(250);
    }
    expect(enter.opacity.duration).toBe(180);
    const closed = decls(css, CLOSED);
    expect(closed).toMatchObject({ opacity: '0', translate: '0 -4px' });
    const leave = transitions({ ...decls(css, PANEL), ...closed });
    expect(leave.opacity.duration).toBe(120);
    expect(leave.opacity.duration).toBeLessThan(enter.opacity.duration);
    expect(leave.translate.duration).toBe(leave.opacity.duration);
  });

  it('the panel follows the menu height in 250ms on the in-out curve', () => {
    const resize = transitions(decls(css, PANEL));
    expect(resize.height).toEqual({ duration: 250, easing: EASE_IN_OUT });
    expect(resize.width).toEqual({ duration: 250, easing: EASE_IN_OUT });
  });

  it('a closing panel stays mounted exactly as long as its fade: Radix waits for an animation that changes nothing', () => {
    const closed = decls(css, CLOSED);
    const hold = animationName(closed.animation);
    expect(hold).not.toBe('none');
    expect(ms(closed.animation.split(/\s+/)[1])).toBe(120);
    const frames = keyframes(css, hold);
    expect(frames, `@keyframes ${hold}`).not.toBe('');
    expect(frames).not.toMatch(/\b(opacity|translate|scale|transform|height|width|clip-path)\s*:/);
  });

  it('menu to menu: a 16px slide with fade, 200ms in and 150ms out, as transitions a sweep across triggers retargets', () => {
    const menu = transitions(decls(css, MENU));
    expect(decls(css, MENU).animation).toBe('none');
    expect(menu.opacity).toEqual({ duration: 200, easing: EASE_OUT });
    expect(menu.translate).toEqual({ duration: 200, easing: EASE_OUT });
    expect(decls(css, `${PANEL} > [data-motion="from-end"]`, STARTING)).toEqual({ opacity: '0', translate: '16px 0' });
    expect(decls(css, `${PANEL} > [data-motion="from-start"]`, STARTING)).toEqual({
      opacity: '0',
      translate: '-16px 0',
    });
    expect(decls(css, `${PANEL} > [data-motion="to-start"]`)).toEqual({ translate: '-16px 0' });
    expect(decls(css, `${PANEL} > [data-motion="to-end"]`)).toEqual({ translate: '16px 0' });
    const leaving = decls(css, LEAVING);
    expect(leaving.opacity).toBe('0');
    expect(ms(leaving['transition-duration'])).toBe(150);
    expect(animationName(leaving.animation)).toBe(animationName(decls(css, CLOSED).animation));
    expect(ms(leaving.animation.split(/\s+/)[1])).toBe(150);
  });

  it('a menu on its way out, or a closing panel, takes no pointer, and neither do their links', () => {
    expect(decls(css, LEAVING)['pointer-events']).toBe('none');
    expect(decls(css, `${LEAVING} *`)['pointer-events']).toBe('none');
    // Radix sets pointer-events: none on the closing panel itself; its links would still take clicks
    // (#nd-nav > :last-child * { pointer-events: auto } in global.css)
    expect(decls(css, `${CLOSED} *`)['pointer-events']).toBe('none');
  });

  it('under Reduce Motion nothing moves: the exits drop their offset and fade as long as the site policy (150ms)', () => {
    for (const selector of [CLOSED, LEAVING]) {
      const reduced = decls(css, selector, REDUCE);
      expect(reduced.translate, selector).toBe('none');
      expect(reduced['animation-duration'], selector).toBe('150ms !important');
    }
  });

  it('a menu opened, switched or closed from the keyboard shows and goes at once, and Radix still unmounts it', () => {
    // The exit hold keeps its name and only drops to 0s: Radix Presence unmounts on the hold's animationend, which a 0s
    // hold fires at once, and so does a hold cut to 0s when a key is pressed during a pointer close. `animation: none`
    // would cancel the hold instead, and an invisible closed panel would stay mounted.
    for (const selector of [KEYBOARD, `${KEYBOARD} > [data-motion]`]) {
      expect(decls(css, selector), selector).toEqual({
        transition: 'none !important',
        'animation-duration': '0s !important',
      });
    }
  });
});

describe('site-phone-menu: the phone sheet drops from its button and folds back', () => {
  const src = read(DROPDOWN);
  const sheet = src.match(/<div\s+data-state=\{[^}]+\}[\s\S]*?className="([^"]+)"/)?.[1] ?? '';
  const classes = sheet.split(/\s+/);
  const chevron = src.match(/<ChevronDown\s+className=\{`([^`]+)`\}/)?.[1] ?? '';

  it('grows from the top right corner, where its button sits', () => {
    expect(classes).toContain('origin-top-right');
  });

  it('runs 200ms in on the strong ease-out from 6px up and 98%, and 140ms out, 4px up', () => {
    expect(classes).toEqual(
      expect.arrayContaining([
        'transition-[opacity,translate,scale]',
        'duration-200',
        'ease-out',
        'starting:opacity-0',
        'motion-safe:starting:-translate-y-1.5',
        'motion-safe:starting:scale-[0.98]',
        'data-[state=closed]:opacity-0',
        'data-[state=closed]:duration-[140ms]',
        'motion-safe:data-[state=closed]:-translate-y-1',
      ]),
    );
  });

  it('stays mounted through its exit, takes no tap or focus while it closes, then unmounts', () => {
    expect(src).not.toMatch(/\{isOpen && \(/);
    expect(src).toMatch(/data-state=\{isOpen \? 'open' : 'closed'\}/);
    expect(src).toMatch(/inert=\{!isOpen\}/);
    const exit = Number(src.match(/const SHEET_EXIT_MS = (\d+);/)?.[1]);
    // the fade takes 140ms, or the site's 150ms under Reduce Motion: the sheet goes once the longer one has ended
    expect(exit).toBe(150);
    expect(src).toMatch(/setTimeout\(\(\) => setSheet\('closed'\), SHEET_EXIT_MS\)/);
    expect(src).toMatch(/clearTimeout\(timer\)/);
  });

  it('turns its chevron on the sheet curve, 200ms, rotate named', () => {
    expect(chevron.split(/\s+/)).toEqual(expect.arrayContaining(['transition-[rotate]', 'duration-200', 'ease-out']));
    expect(chevron).not.toMatch(/duration-300|transition-transform/);
  });

  it('opened or closed from the keyboard, it shows and goes at once, chevron included', () => {
    const css = postcss.parse(block('site-phone-menu'));
    for (const selector of [
      '[data-navbar-dropdown]:has(> button:focus-visible) > div',
      '[data-navbar-dropdown] > button:focus-visible svg',
    ]) {
      expect(decls(css, selector), selector).toEqual({ transition: 'none !important' });
    }
  });
});

describe('site-theme-switch: a theme change spreads from the toggle', () => {
  type Deferred = { promise: Promise<void>; resolve: () => void };
  const deferred = (): Deferred => {
    let resolve = () => {};
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  /** A browser stub: <html> with its class, attributes and inline style, matchMedia and (optionally) view transitions. */
  function stubBrowser({ dark = false, reduce = false, transitions = true } = {}) {
    const attributes = new Map<string, string>();
    const style = new Map<string, string>();
    const updates: (() => void)[] = [];
    const finishes: Deferred[] = [];
    const html = {
      classList: { contains: (name: string) => name === 'dark' && dark },
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      style: {
        setProperty: (name: string, value: string) => style.set(name, value),
        removeProperty: (name: string) => style.delete(name),
      },
    };
    const startViewTransition = vi.fn((update: () => void) => {
      updates.push(update);
      const finished = deferred();
      finishes.push(finished);
      return { finished: finished.promise, ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
    });
    vi.stubGlobal('document', { documentElement: html, ...(transitions ? { startViewTransition } : {}) });
    vi.stubGlobal('window', {
      innerWidth: 1440,
      innerHeight: 900,
      matchMedia: (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }),
    });
    return { attributes, style, updates, finishes, startViewTransition };
  }

  const toggle = {
    getBoundingClientRect: () => ({ left: 1380, top: 12, width: 40, height: 32 }),
  } as unknown as Element;
  const settle = () => new Promise((done) => setTimeout(done, 0));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('centres the circle on the toggle and grows it to the farthest corner of the window', async () => {
    const { revealCircle } = await import('@/components/navigation/theme-switch');
    expect(revealCircle({ left: 1380, top: 12, width: 40, height: 32 }, { width: 1440, height: 900 })).toEqual({
      x: 1400,
      y: 28,
      r: Math.ceil(Math.hypot(1400, 872)),
    });
    // a toggle at the top left reaches for the bottom right
    expect(revealCircle({ left: 0, top: 0, width: 20, height: 20 }, { width: 390, height: 844 }).r).toBe(
      Math.ceil(Math.hypot(380, 834)),
    );
  });

  it('with motion allowed, calls startViewTransition and sets the theme inside it, from the toggle', async () => {
    const { switchTheme } = await import('@/components/navigation/theme-switch');
    const browser = stubBrowser({ reduce: false });
    const setTheme = vi.fn();
    switchTheme(toggle, setTheme);
    expect(browser.startViewTransition).toHaveBeenCalledTimes(1);
    expect(setTheme).not.toHaveBeenCalled();
    expect(browser.attributes.has('data-theme-reveal')).toBe(true);
    expect(Object.fromEntries(browser.style)).toEqual({
      '--theme-reveal-x': '1400px',
      '--theme-reveal-y': '28px',
      '--theme-reveal-r': `${Math.ceil(Math.hypot(1400, 872))}px`,
    });
    browser.updates[0]();
    expect(setTheme).toHaveBeenCalledWith('dark');
    browser.finishes[0].resolve();
    await settle();
    expect(browser.attributes.has('data-theme-reveal')).toBe(false);
    expect(browser.style.size).toBe(0);
  });

  it('under Reduce Motion it still runs a view transition (the CSS cross-fades it), with the theme set inside it', async () => {
    const { switchTheme } = await import('@/components/navigation/theme-switch');
    const browser = stubBrowser({ reduce: true, dark: true });
    const setTheme = vi.fn();
    switchTheme(toggle, setTheme);
    expect(browser.startViewTransition).toHaveBeenCalledTimes(1);
    expect(setTheme).not.toHaveBeenCalled();
    expect(browser.attributes.has('data-theme-reveal')).toBe(true);
    browser.updates[0]();
    expect(setTheme).toHaveBeenCalledWith('light');
    browser.finishes[0].resolve();
    await settle();
    expect(browser.attributes.has('data-theme-reveal')).toBe(false);
  });

  it('a browser without view transitions swaps at once, as today', async () => {
    const { switchTheme } = await import('@/components/navigation/theme-switch');
    stubBrowser({ transitions: false });
    const setTheme = vi.fn();
    switchTheme(toggle, setTheme);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('a second press during the reveal takes it over: the first one ending leaves the second one its marks', async () => {
    const { switchTheme } = await import('@/components/navigation/theme-switch');
    const browser = stubBrowser();
    switchTheme(toggle, vi.fn());
    switchTheme(toggle, vi.fn());
    browser.finishes[0].resolve();
    await settle();
    expect(browser.attributes.has('data-theme-reveal')).toBe(true);
    expect(browser.style.size).toBe(3);
    browser.finishes[1].resolve();
    await settle();
    expect(browser.attributes.has('data-theme-reveal')).toBe(false);
  });

  it('the desktop toggle keeps fumadocs markup and the phone toggle uses the same switch', async () => {
    const { ThemeSwitch } = await import('@/components/navigation/theme-switch');
    const { baseOptions } = await import('@/app/layout.config');
    const component = baseOptions.themeSwitch?.component;
    expect(isValidElement(component) && component.type).toBe(ThemeSwitch);
    const html = renderToStaticMarkup(createElement(ThemeSwitch));
    expect(html).toMatch(/^<button[^>]*aria-label="Toggle Theme"[^>]*data-theme-toggle=""/);
    expect(html).toMatch(/class="inline-flex items-center rounded-full border p-1"/);
    const dropdown = read(DROPDOWN);
    expect(dropdown).toMatch(/useThemeSwitch\(\)/);
    expect(dropdown).not.toMatch(/classList\.(add|remove)\(/);
    expect(dropdown).not.toMatch(/localStorage\.setItem\('theme'/);
  });

  it('the new theme is revealed by a circle from the toggle, 450ms on the strong ease-out, over an old page held still', () => {
    const css = postcss.parse(block('site-theme-switch'));
    const old = decls(css, ':root[data-theme-reveal]::view-transition-old(root)');
    const fresh = decls(css, ':root[data-theme-reveal]::view-transition-new(root)');
    expect(old).toEqual({ animation: 'none !important', 'mix-blend-mode': 'normal' });
    expect(fresh['mix-blend-mode']).toBe('normal');
    const [name, duration, ...rest] = fresh.animation.split(/\s+/);
    expect(ms(duration)).toBe(450);
    expect(rest.join(' ')).toBe(`${EASE_OUT} !important`);
    const frames = keyframes(css, name);
    expect(frames).toMatch(/from\s*\{\s*clip-path:\s*circle\(0 at var\(--theme-reveal-x\) var\(--theme-reveal-y\)\)/);
    expect(frames).toMatch(
      /to\s*\{\s*clip-path:\s*circle\(var\(--theme-reveal-r\) at var\(--theme-reveal-x\) var\(--theme-reveal-y\)\)/,
    );
  });

  it('nothing on the page fades its colours inside the circle: no transition starts while the reveal runs', () => {
    // next-themes holds transitions for one timer tick only, which ends before the new theme is drawn. <html> is in the
    // list too: under Reduce Motion the site policy (its `*` matches <html>) gives it colour fades of its own.
    const css = postcss.parse(block('site-theme-switch'));
    for (const selector of [
      ':root[data-theme-reveal]',
      ':root[data-theme-reveal] *',
      ':root[data-theme-reveal] *::before',
      ':root[data-theme-reveal] *::after',
    ]) {
      expect(decls(css, selector), selector).toEqual({ transition: 'none !important' });
    }
  });

  it('under Reduce Motion the two pages cross-fade in 150ms, with no circle, and no later root hold stops it', () => {
    const css = postcss.parse(block('site-theme-switch'));
    const old = decls(css, ':root[data-theme-reveal]::view-transition-old(root)', REDUCE);
    const fresh = decls(css, ':root[data-theme-reveal]::view-transition-new(root)', REDUCE);
    // plus-lighter adds the two pages, so the cross-fade never dips; !important outranks the root holds that come later
    // in global.css with the same specificity (the next test: the site policy cannot reach these pseudo-elements)
    for (const [rule, opacity] of [
      [old, /to\s*\{\s*opacity:\s*0;?\s*\}/],
      [fresh, /from\s*\{\s*opacity:\s*0;?\s*\}/],
    ] as const) {
      expect(rule['mix-blend-mode']).toBe('plus-lighter');
      const [name, duration, ...rest] = rule.animation.split(/\s+/);
      expect(ms(duration)).toBe(150);
      expect(rest.join(' ')).toBe(`${EASE_OUT} both !important`);
      // the site's plain fades, vs-fade-out and vs-fade-in (exp-view-switch)
      const frames = keyframes(globalCss, name);
      expect(frames, name).toMatch(opacity);
      expect(frames, name).not.toMatch(/clip-path|transform|translate|scale/);
    }
  });

  it('under Reduce Motion the root group lasts as long as the cross-fade, so the transition ends with the fade', () => {
    // the UA gives ::view-transition-group 250ms, and the transition (with every press landing on <html>) lasts until
    // its longest animation ends: 100ms after the visible fade. With motion allowed the 450ms circle outlasts it.
    const css = postcss.parse(block('site-theme-switch'));
    const group = decls(css, ':root[data-theme-reveal]::view-transition-group(root)', REDUCE);
    const fade = decls(css, ':root[data-theme-reveal]::view-transition-new(root)', REDUCE).animation.split(/\s+/)[1];
    expect(group).toEqual({ 'animation-duration': fade });
    expect(ms(group['animation-duration'])).toBe(150);
    expect(decls(css, ':root[data-theme-reveal]::view-transition-group(root)')).toEqual({});
  });

  it("the !important is for the later root holds: the site policy's selectors cannot reach a view-transition pseudo", () => {
    // the policy (site-reduced-motion-policy) matches elements, ::before and ::after only, so its 1ms never reaches
    // ::view-transition-*: what the reveal must outrank are the root holds placed later in the file
    const policy = postcss.parse(block('site-reduced-motion-policy'));
    policy.walkRules((rule) => {
      for (const selector of rule.selectors) expect(selector).not.toMatch(/::view-transition/);
    });
    const revealAt = globalCss.nodes.findIndex(
      (node) => node.type === 'comment' && node.text.startsWith('site-theme-switch:'),
    );
    // a plain `animation: none` on the root, after the reveal in the file: at the same specificity it would win
    const laterHolds: string[] = [];
    globalCss.walkRules((rule) => {
      if (!rule.selectors.some((s) => /::view-transition-(old|new)\(root\)/.test(s))) return;
      let top: ChildNode = rule;
      while (top.parent && top.parent.type !== 'root') top = top.parent as ChildNode;
      const holds = rule.nodes.some(
        (node) => node.type === 'decl' && node.prop === 'animation' && node.value === 'none' && !node.important,
      );
      if (holds && globalCss.nodes.indexOf(top) > revealAt) laterHolds.push(rule.selector);
    });
    expect(laterHolds.length).toBeGreaterThan(0);
  });

  it('nothing outside this block can outrank the reveal: no other root view-transition animation is !important', () => {
    // the docs, the Academy landing and the explorer hold their root with `animation: none` at (0,2,1) specificity,
    // the reveal's own specificity: only the reveal may be !important, or a later hold would stop it
    const comments = globalCss.nodes.filter((node) => node.type === 'comment');
    const start = comments.findIndex((node) => node.type === 'comment' && node.text.startsWith('site-theme-switch:'));
    expect(start).toBeGreaterThanOrEqual(0);
    const from = comments[start].source?.start?.offset ?? 0;
    const to = comments[start + 1]?.source?.start?.offset ?? Number.POSITIVE_INFINITY;
    const outranking: string[] = [];
    const reveal: string[] = [];
    globalCss.walkRules((rule) => {
      if (!rule.selectors.some((s) => /::view-transition-(old|new)\(root\)/.test(s))) return;
      const offset = rule.source?.start?.offset ?? -1;
      const inBlock = offset >= from && offset < to;
      rule.walkDecls(/^animation/, (decl) => {
        if (inBlock) reveal.push(`${decl.important}`);
        else if (decl.important) outranking.push(`${rule.selector} { ${decl.prop}: ${decl.value} !important }`);
      });
    });
    expect(outranking).toEqual([]);
    // the reveal's own animations (the circle, and the Reduce Motion cross-fade) are all !important
    expect(reveal.length).toBe(4);
    expect(new Set(reveal)).toEqual(new Set(['true']));
  });
});

describe('site-link-pending: slow navbar links show that the click landed', () => {
  type TriggerProps = { href?: string; tabIndex?: number; prefetch?: boolean; children?: unknown };
  const trigger = (menu: unknown) => {
    const { text } = menu as { text?: unknown };
    return isValidElement(text) ? (text as ReactElement<TriggerProps>) : null;
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 120ms before it shows, so a fast navigation never flashes it', async () => {
    const { PENDING_HINT_DELAY_MS, watchPending } = await import('@/components/navigation/pending-hint');
    expect(PENDING_HINT_DELAY_MS).toBe(120);
    vi.useFakeTimers();
    const setLate = vi.fn();
    watchPending(true, setLate);
    vi.advanceTimersByTime(119);
    expect(setLate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setLate).toHaveBeenCalledWith(true);
    expect(setLate).toHaveBeenCalledTimes(1);
  });

  it('clears its timer when the navigation ends or the link unmounts, and does nothing while idle', async () => {
    const { watchPending } = await import('@/components/navigation/pending-hint');
    vi.useFakeTimers();
    const setLate = vi.fn();
    expect(watchPending(false, setLate)).toBeUndefined();
    const cleanup = watchPending(true, setLate);
    vi.advanceTimersByTime(60);
    cleanup?.();
    vi.advanceTimersByTime(500);
    expect(setLate).toHaveBeenCalledTimes(1);
    expect(setLate).toHaveBeenCalledWith(false);
  });

  it('reads the Link status and runs the timer as an effect of it', () => {
    const src = read(HINT);
    expect(src).toMatch(/useLinkStatus\(\)/);
    expect(src).toMatch(/setTimeout\(\(\) => setLate\(true\), PENDING_HINT_DELAY_MS\)/);
    expect(src).toMatch(/useEffect\(\(\) => watchPending\(pending, setLate\), \[pending\]\)/);
  });

  it('is always in the page and hidden at rest, inside the Link it reports on', async () => {
    const { PendingHint, PendingLink } = await import('@/components/navigation/pending-hint');
    expect(renderToStaticMarkup(createElement(PendingHint))).toBe(
      '<span aria-hidden="true" class="nav-pending-hint"></span>',
    );
    const link = renderToStaticMarkup(createElement(PendingLink, { href: '/console', prefetch: false }, 'Console'));
    expect(link).toMatch(
      /^<a [^>]*class="relative"[^>]*>Console<span aria-hidden="true" class="nav-pending-hint"><\/span><\/a>$/,
    );
    expect(link).toMatch(/href="\/console"/);
  });

  it('sits in the Developers, Console and Ecosystem triggers, which skip prefetch, with their props unchanged', async () => {
    const { PendingLink } = await import('@/components/navigation/pending-hint');
    const { consoleMenu, developersMenu, ecosystemMenu } = await import('@/app/layout.config');
    const cases: [unknown, TriggerProps][] = [
      [developersMenu, { href: '/docs/primary-network', prefetch: false, tabIndex: -1, children: 'Developers' }],
      [consoleMenu, { href: '/console', prefetch: false, tabIndex: -1, children: 'Console' }],
      [ecosystemMenu, { href: '/ecosystem', prefetch: false, children: 'Ecosystem' }],
    ];
    for (const [menu, props] of cases) {
      const element = trigger(menu);
      expect(element?.type, String(props.children)).toBe(PendingLink);
      expect(element?.props, String(props.children)).toEqual(props);
    }
  });

  it('draws a 2px line under the label that fades to 70% and sweeps a segment, 900ms linear; still under Reduce Motion', () => {
    const css = postcss.parse(block('site-link-pending'));
    const hint = decls(css, '.nav-pending-hint');
    expect(hint).toMatchObject({
      position: 'absolute',
      height: '2px',
      'background-color': 'currentColor',
      opacity: '0',
      'pointer-events': 'none',
    });
    const shown = decls(css, '.nav-pending-hint[data-shown]');
    expect(shown.opacity).toBe('0.7');
    expect(shown.transition).toBe(`opacity 120ms ${EASE_OUT}`);
    const [name, duration, easing, count] = shown.animation.split(/\s+/);
    expect([ms(duration), easing, count]).toEqual([900, 'linear', 'infinite']);
    expect(keyframes(css, name)).toMatch(/clip-path:\s*inset\(/);
    expect(keyframes(css, name)).not.toMatch(/\b(width|left|right|transform|translate)\s*:/);
    expect(decls(css, '.nav-pending-hint[data-shown]', REDUCE)).toEqual({ animation: 'none' });
  });
});
