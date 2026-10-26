import { type AtRule, type Rule } from 'postcss';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  atRulesAround,
  block,
  contrast,
  declaration as sourceOf,
  declOf,
  declsOf,
  globalCss,
  palette,
  read,
  rulesFor,
  ungatedHover,
} from './helpers';

/*
 * Radix's tooltip parts as plain marked elements, so a server render shows which provider each tooltip root sits
 * under, the delays each one gets, and the classes the shared content and arrow carry. The real parts render nothing
 * on the server (the content sits in a portal).
 */
vi.mock('@radix-ui/react-tooltip', async () => {
  const { createElement: h } = await import('react');
  type Props = Record<string, unknown> & { children?: ReactNode };
  const marked =
    (tag: string) =>
    ({ children, className, delayDuration, skipDelayDuration }: Props) =>
      h(
        tag,
        {
          className: className as string | undefined,
          'data-delay': delayDuration as number | undefined,
          'data-skip': skipDelayDuration as number | undefined,
        },
        children,
      );
  return {
    Provider: marked('tip-provider'),
    Root: marked('tip-root'),
    Trigger: marked('tip-trigger'),
    Portal: ({ children }: Props) => children,
    Content: marked('tip-content'),
    Arrow: marked('tip-arrow'),
  };
});

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Toaster, toasterOrder } from '@/components/ui/toaster';
import type { SearchMotionEvent, SearchMotionState } from '@/lib/search/dialog-motion';

/**
 * Task 4 of the hub motion pass: the site search opens at once from the keyboard (site-search-dialog, variant a), the
 * chat panel grows out of its bubble and folds back into it (site-chat-bubble, variant a), and tooltips wait on the
 * first hover, then open at once, on an ink fill (site-tooltips, variant a). Extras from Task 2's review: the house
 * focus ring on the phone search toggle, the signed-in profile trigger, and Log in and Sign up. Extra X6: each
 * use-toast toast shows once. Specs: .scratch/hub-motion/proposals/10-site.js.
 */
const CSS = 'app/global.css';
const SEARCH = 'components/search.tsx';
const SEARCH_MOTION = 'lib/search/dialog-motion.ts';
const TOASTER = 'components/ui/toaster.tsx';
const CHAT = 'components/chat/chat-bubble.tsx';
const TOOLTIP = 'components/ui/tooltip.tsx';
const FEES = 'components/toolbox/components/genesis/FeeConfig.tsx';
const PROVIDERS = 'app/layout.client.tsx';
const USER_BUTTON = 'components/login/user-button/UserButton.tsx';
const AUTH_BUTTONS = 'components/login/user-button/AuthButtons.tsx';
const PROJECT_OPTIONS = 'components/showcase/ProjectOptions.tsx';
const ASSIGN_BADGE = 'components/showcase/assign-badge.tsx';
const SHOWCASE = 'components/showcase/ShowCaseCard.tsx';
const MEMBERS = 'components/hackathons/project-submission/components/Members.tsx';

const TOUCHED = [
  CSS,
  SEARCH,
  SEARCH_MOTION,
  CHAT,
  TOOLTIP,
  FEES,
  PROVIDERS,
  USER_BUTTON,
  AUTH_BUTTONS,
  PROJECT_OPTIONS,
  ASSIGN_BADGE,
  TOASTER,
];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const BRAND_RED = '#e6212f';

const root = globalCss;

/* ---------- global.css lookups ---------- */

/** The one rule for `selector`, outside any at-rule or inside exactly `within`. */
function ruleFor(selector: string, within: string[] = []): Rule {
  const found = rulesFor(selector)
    .filter(({ at }) => at.join(' | ') === within.join(' | '))
    .map(({ rule }) => rule);
  expect(found, `${within.join(' ')} ${selector}`.trim()).toHaveLength(1);
  return found[0];
}

const REDUCED = ['@media (prefers-reduced-motion: reduce)'];
const valueOf = (rule: Rule, prop: string) => declOf(rule, prop)?.value.replace(/\s+/g, ' ').trim();

/** The steps of `@keyframes name` as `{ from: { opacity: '0' }, to: {...} }`. */
function keyframes(name: string): Record<string, Record<string, string>> {
  let found: AtRule | undefined;
  root.walkAtRules('keyframes', (rule) => {
    if (rule.params === name) found = rule;
  });
  expect(found, `@keyframes ${name}`).toBeDefined();
  const steps: Record<string, Record<string, string>> = {};
  (found as AtRule).walkRules((step) => {
    steps[step.selector] = Object.fromEntries(declsOf(step).map((decl) => [decl.prop, decl.value]));
  });
  return steps;
}

/** How many classes, attributes and pseudo-classes a plain selector holds (none of ours use ids or :is()). */
const weight = (selector: string) =>
  (selector.match(/\.[\w-]+/g)?.length ?? 0) +
  (selector.match(/\[[^\]]+\]/g)?.length ?? 0) +
  (selector.match(/(?<!:):[\w-]+/g)?.length ?? 0);

/* ---------- source lookups ---------- */

/** The source of one top-level function or const in a file, which must declare it. */
function declaration(src: string, name: string): string {
  const found = sourceOf(src, name);
  expect(found, `${name} is declared`).not.toBe('');
  return found;
}

/** The classes in the quoted strings of a declaration. */
const tokensOf = (source: string): string[] =>
  [...source.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
    .flatMap((m) => (m[1] ?? m[2] ?? m[3]).split(/\s+/))
    .filter(Boolean);

/** The class list of the first `<tag ...>` in some markup. */
const classesOf = (html: string, tag: string): string[] =>
  (html.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))?.[1] ?? '').split(/\s+/).filter(Boolean);

/* ---------- WCAG contrast (helpers.ts reads the palette Tailwind ships) ---------- */

/** The colour a class list sets for `utility` (`bg`, `text`) in the light theme, or with `dark:` in the dark one. */
function colourOf(tokens: string[], utility: string, theme: 'light' | 'dark'): string {
  const prefix = theme === 'dark' ? `dark:${utility}-` : `${utility}-`;
  const found = tokens.filter((t) => t.startsWith(prefix) && /-(?:white|[a-z]+-\d+)$/.test(t)).at(-1);
  expect(found, `${prefix}* in ${tokens.join(' ')}`).toBeDefined();
  return (found as string).slice(prefix.length);
}

/* ======================================================================== */

describe('every file this task touches', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(['site-search-dialog', 'site-chat-bubble', 'site-tooltips'])(
    'the %s block in global.css exists and gates every hover',
    (id) => {
      const text = block(id);
      expect(text, `a comment-headed block for ${id}`).not.toBe('');
      expect(ungatedHover(text)).toBe(0);
    },
  );
});

describe('site-search-dialog: instant from the keyboard, a short settle from a click', () => {
  const search = read(SEARCH);
  const overlay = search.match(/<SearchDialogOverlay\b[^>]*\/>/)?.[0] ?? '';
  const content = search.match(/<SearchDialogContent\b[^>]*>/)?.[0] ?? '';

  it('both parts carry the hooks global.css styles, and data-instant from one value', () => {
    expect(overlay).toContain('className="site-search-overlay"');
    expect(content).toContain('className="site-search-content"');
    const flag = overlay.match(/data-instant=\{(\w+)\}/)?.[1];
    expect(flag, 'data-instant on the overlay').toBeDefined();
    expect(content).toContain(`data-instant={${flag}}`);
  });

  it('the dialog hears each key and pointer press in the capture phase, before fumadocs opens it on Cmd K', () => {
    // fumadocs' own Cmd K listener sits on window in the bubble phase, so the input is known when the dialog opens.
    expect(search).toMatch(/addEventListener\(\s*["']keydown["'],\s*\w+,\s*true\s*\)/);
    expect(search).toMatch(/addEventListener\(\s*["']pointerdown["'],\s*\w+,\s*true\s*\)/);
    expect(search).toMatch(/useReducer\(searchMotion, SEARCH_MOTION_START\)/);
  });

  it('opened from the keyboard, neither part animates, either way, Reduce Motion included', () => {
    for (const part of ['.site-search-overlay', '.site-search-content']) {
      const rule = ruleFor(`${part}[data-instant][data-state]`);
      expect(valueOf(rule, 'animation')).toBe('none');
      // it outweighs every state rule, the reduced ones included
      root.walkRules((other) => {
        if (other === rule || !other.selectors.some((s) => s.startsWith(`${part}[data-state`))) return;
        for (const s of other.selectors) expect(weight(rule.selector.split(',')[0]), s).toBeGreaterThan(weight(s));
      });
    }
  });

  it('opened with a click, the dialog settles from 97% in 180ms on the strong ease-out, centred', () => {
    expect(valueOf(ruleFor('.site-search-content[data-state="open"]'), 'animation')).toBe(
      'site-search-in 180ms var(--ease-out)',
    );
    expect(keyframes('site-search-in')).toEqual({ from: { opacity: '0', transform: 'scale(0.97)' } });
    // centred: no rule for the content moves its transform origin off the default 50% 50%
    root.walkRules((rule) => {
      if (rule.selectors.some((s) => s.startsWith('.site-search-content'))) {
        expect(declOf(rule, 'transform-origin'), rule.selector).toBeUndefined();
      }
    });
    // the backdrop takes the site's plain fades (exp-view-switch)
    expect(valueOf(ruleFor('.site-search-overlay[data-state="open"]'), 'animation')).toBe(
      'vs-fade-in 180ms var(--ease-out)',
    );
    expect(keyframes('vs-fade-in')).toEqual({ from: { opacity: '0' } });
  });

  it('it leaves to 98% in 120ms, faster than it came, and the backdrop leaves with it', () => {
    expect(valueOf(ruleFor('.site-search-content[data-state="closed"]'), 'animation')).toBe(
      'site-search-out 120ms var(--ease-out) forwards',
    );
    expect(keyframes('site-search-out')).toEqual({ to: { opacity: '0', transform: 'scale(0.98)' } });
    expect(valueOf(ruleFor('.site-search-overlay[data-state="closed"]'), 'animation')).toBe(
      'vs-fade-out 120ms var(--ease-out) forwards',
    );
    expect(keyframes('vs-fade-out')).toEqual({ to: { opacity: '0' } });
  });

  it('under Reduce Motion a click open only fades, in 120ms both ways', () => {
    const open = ruleFor('.site-search-content[data-state="open"]', REDUCED);
    const closed = ruleFor('.site-search-content[data-state="closed"]', REDUCED);
    expect(valueOf(open, 'animation-name')).toBe('vs-fade-in');
    expect(valueOf(closed, 'animation-name')).toBe('vs-fade-out');
    for (const rule of [open, closed, ruleFor('.site-search-overlay[data-state]', REDUCED)]) {
      // past the site policy's 1ms !important (more specific than its *)
      expect(declOf(rule, 'animation-duration')?.value).toBe('120ms');
      expect(declOf(rule, 'animation-duration')?.important).toBe(true);
    }
  });

  it('no entry name sits inside an exit name, so an Escape during the entrance still plays the exit', () => {
    // Radix Presence ends an exit on the end or cancel of any animation whose name the exit's contains
    const first = (rule: Rule) => valueOf(rule, 'animation')?.split(' ')[0];
    const named = (state: string) => [
      first(ruleFor(`.site-search-content[data-state="${state}"]`)),
      first(ruleFor(`.site-search-overlay[data-state="${state}"]`)),
      valueOf(ruleFor(`.site-search-content[data-state="${state}"]`, REDUCED), 'animation-name'),
    ];
    const exits = named('closed');
    for (const entry of named('open')) {
      for (const exit of exits) expect(exit, `${exit} holds ${entry}`).not.toContain(entry);
    }
  });
});

describe('site-search-dialog: the input that opened it decides both ways (lib/search/dialog-motion.ts)', () => {
  type MotionModule = {
    SEARCH_MOTION_START: SearchMotionState;
    searchMotion: (state: SearchMotionState, event: SearchMotionEvent) => SearchMotionState;
  };
  /** The module, loaded at test time so a missing one fails these tests only. */
  const MOTION_MODULE = '@/lib/search/dialog-motion';
  const load = () => import(/* @vite-ignore */ MOTION_MODULE) as Promise<MotionModule>;
  const KEY: SearchMotionEvent = { type: 'input', input: 'keyboard' };
  const POINTER: SearchMotionEvent = { type: 'input', input: 'pointer' };
  const OPEN: SearchMotionEvent = { type: 'open', open: true };
  const CLOSE: SearchMotionEvent = { type: 'open', open: false };
  /** Whether the dialog shows and leaves at once after `events`, from a fresh page load. */
  const instantAfter = async (...events: SearchMotionEvent[]) => {
    const { SEARCH_MOTION_START, searchMotion } = await load();
    return events.reduce(searchMotion, SEARCH_MOTION_START).instant;
  };

  it('Cmd K as the first action after load: it opens at once, and leaves at once by Escape or by a click', async () => {
    expect(await instantAfter(KEY, OPEN)).toBe(true);
    expect(await instantAfter(KEY, OPEN, KEY, CLOSE)).toBe(true);
    expect(await instantAfter(KEY, OPEN, POINTER, CLOSE)).toBe(true);
  });

  it('a click: it settles in, and leaves with its exit by a click or by Escape', async () => {
    expect(await instantAfter(POINTER, OPEN)).toBe(false);
    expect(await instantAfter(POINTER, OPEN, POINTER, CLOSE)).toBe(false);
    expect(await instantAfter(POINTER, OPEN, KEY, CLOSE)).toBe(false);
  });

  it('Cmd K while a click-opened dialog is open, then a backdrop click: it keeps its exit', async () => {
    // fumadocs' Cmd K only opens, so on an open dialog it changes nothing but the last input
    expect(await instantAfter(POINTER, OPEN, KEY, OPEN, POINTER, CLOSE)).toBe(false);
  });

  it('Enter on the focused search pill opens it from the keyboard, even after a click elsewhere', async () => {
    expect(await instantAfter(POINTER, KEY, OPEN)).toBe(true);
  });

  it('an input after the dialog has closed leaves its exit alone; the next open reads it', async () => {
    expect(await instantAfter(POINTER, OPEN, CLOSE, KEY)).toBe(false);
    expect(await instantAfter(POINTER, OPEN, CLOSE, KEY, OPEN)).toBe(true);
  });

  it('a step that changes nothing returns the same state, so React skips the render; a state is never changed', async () => {
    const { SEARCH_MOTION_START, searchMotion } = await load();
    const start = Object.freeze({ ...SEARCH_MOTION_START });
    expect(start).toEqual({ last: 'pointer', open: false, instant: false });
    expect(searchMotion(start, POINTER)).toBe(start);
    expect(searchMotion(start, CLOSE)).toBe(start);
    expect(searchMotion(start, KEY)).toEqual({ last: 'keyboard', open: false, instant: false });
  });
});

describe('site-chat-bubble: the panel grows out of its bubble and folds back into it', () => {
  const chat = read(CHAT);
  const bubble = () => tokensOf(declaration(chat, 'BUBBLE_MOTION'));
  const back = () => tokensOf(declaration(chat, 'BUBBLE_RETURN'));
  const panel = () => tokensOf(declaration(chat, 'PANEL_MOTION'));

  it('the bubble grows to 1.04 on hover in 200ms on the strong ease-out, naming what it animates; no transition-all', () => {
    expect(chat).not.toMatch(TRANSITION_ALL);
    expect(bubble()).toContain('hover:scale-[1.04]');
    const transition = bubble().filter((t) => t.startsWith('transition'));
    expect(transition).toHaveLength(1);
    expect(transition[0]).toMatch(/^transition-\[(?=[^\]]*\bscale\b)[\w,-]+\]$/);
    expect(bubble()).toEqual(expect.arrayContaining(['[transition-duration:200ms]', 'ease-out']));
    expect(chat).not.toMatch(/hover:scale-110/);
  });

  it("the bubble's durations time only its transitions, so they cannot stretch its 180ms return", () => {
    // tailwindcss-animate makes duration-* set animation-duration as well, and its rule outranks the return class.
    expect(bubble().filter((t) => /(?:^|:)duration-/.test(t))).toEqual([]);
  });

  it('the icon holds still', () => {
    expect(chat).not.toMatch(/group-hover:scale/);
  });

  it('the bubble answers a press: 0.96 in 120ms', () => {
    expect(bubble()).toEqual(expect.arrayContaining(['active:scale-[0.96]', 'active:[transition-duration:120ms]']));
  });

  it("the panel's transform origin is the bubble's corner, and it grows from there, 8px and 96%, in 220ms", () => {
    expect(chat).toMatch(/'chatbot-container fixed bottom-6 right-6 /);
    expect(panel()).toContain('origin-bottom-right');
    expect(panel()).toContain('data-[state=open]:animate-[site-chat-in_220ms_var(--ease-out)]');
    expect(keyframes('site-chat-in')).toEqual({ from: { opacity: '0', transform: 'translateY(8px) scale(0.96)' } });
    expect(chat).not.toMatch(/slide-in-from-bottom|animate-in|duration-300/);
  });

  it('closing, the panel folds back into the corner in 140ms, ignoring the pointer, then the bubble returns from 90% in 180ms', () => {
    expect(panel()).toContain('data-[state=closed]:animate-[site-chat-out_140ms_var(--ease-out)_forwards]');
    expect(panel()).toContain('data-[state=closed]:pointer-events-none');
    expect(keyframes('site-chat-out')).toEqual({ to: { opacity: '0', transform: 'translateY(4px) scale(0.98)' } });
    expect(back()).toContain('animate-[site-chat-return_180ms_var(--ease-out)]');
    expect(keyframes('site-chat-return')).toEqual({ from: { opacity: '0', scale: '0.9' } });
    // both panels use it, and stay mounted through their exit
    expect(chat.match(/PANEL_MOTION\b/g)?.length).toBeGreaterThanOrEqual(3);
    expect(chat.match(/data-state=\{closing \? 'closed' : 'open'\}/g)).toHaveLength(2);
    expect(chat).toMatch(/getAnimations\(\)/);
  });

  it('under Reduce Motion the panel only fades, 150ms in and 100ms out, and nothing scales on hover or press', () => {
    expect(panel()).toContain('motion-reduce:data-[state=open]:animate-[vs-fade-in_150ms_var(--ease-out)]!');
    expect(panel()).toContain(
      'motion-reduce:data-[state=closed]:animate-[vs-fade-out_100ms_var(--ease-out)_forwards]!',
    );
    expect(back()).toContain('motion-reduce:animate-[vs-fade-in_120ms_var(--ease-out)]!');
    expect(bubble()).toEqual(
      expect.arrayContaining(['motion-reduce:hover:scale-100', 'motion-reduce:active:scale-100']),
    );
    // the site's plain fades (exp-view-switch)
    expect(keyframes('vs-fade-in')).toEqual({ from: { opacity: '0' } });
    expect(keyframes('vs-fade-out')).toEqual({ to: { opacity: '0' } });
  });

  it('the 11px hint line passes 4.5:1: zinc-500 on the white panel, zinc-400 on the zinc-900 one', () => {
    const hint = chat.match(/<p className="(text-\[11px\][^"]*)">Enter to send/)?.[1].split(/\s+/) ?? [];
    expect(hint).toEqual(expect.arrayContaining(['text-zinc-500', 'dark:text-zinc-400']));
    expect(contrast(palette('zinc-500'), palette('white'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette('zinc-400'), palette('zinc-900'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the strong in-out curve stays off the moves it would slow (final review, ruling; extras)', () => {
  // Task 1's --ease-in-out (cubic-bezier(0.77, 0, 0.175, 1)) suits a move across the screen; an entering drawer or a
  // hover nudge on it waits about 150ms before it moves
  it('the shadcn Sheet slides on the drawer curve, open and closed', () => {
    const content = tokensOf(declaration(read('components/ui/sheet.tsx'), 'SheetContent'));
    expect(content).toContain('ease-drawer');
    expect(content).not.toContain('ease-in-out');
    expect(content).toEqual(
      expect.arrayContaining(['data-[state=open]:duration-500', 'data-[state=closed]:duration-300']),
    );
  });

  // only the page a route renders: /hackathon redirects to /hackathons, and hackathon/partners.tsx is imported nowhere
  it.each(['app/(home)/hackathon_bba/page.tsx'])('%s: the card arrow nudges on ease-out', (path) => {
    const arrows = [...read(path).matchAll(/<ArrowUpRight\b[^>]*className="([^"]+)"/g)].map((m) => m[1].split(/\s+/));
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toEqual(expect.arrayContaining(['transition-transform', 'duration-300', 'ease-out']));
    expect(arrows[0]).not.toContain('ease-in-out');
    expect(arrows[0].join(' ')).not.toMatch(TRANSITION_ALL);
  });
});

describe("site-chat-bubble: the pulse and the keyboard (the final review's findings)", () => {
  const chat = read(CHAT);
  type ChatModule = {
    fromKeyboard: (control: Element) => boolean;
    watchPulse: (setPulse: (on: boolean) => void, every?: number) => () => void;
  };
  /** The module, loaded at test time so a missing export fails these tests only. */
  const CHAT_MODULE = '@/components/chat/chat-bubble';
  const load = () => import(/* @vite-ignore */ CHAT_MODULE) as Promise<ChatModule>;

  it('the pulse lasts 2 s, first 3 s after the bubble shows, then on its interval', async () => {
    const { watchPulse } = await load();
    vi.useFakeTimers();
    try {
      const calls: boolean[] = [];
      const stop = watchPulse((on) => calls.push(on), 10_000);
      vi.advanceTimersByTime(2_999);
      expect(calls).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(calls).toEqual([true]);
      vi.advanceTimersByTime(2_000);
      expect(calls).toEqual([true, false]);
      vi.advanceTimersByTime(5_000);
      expect(calls).toEqual([true, false, true]);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the panel opening ends a pulse in progress, so the bubble comes back with its return, not the pulse', async () => {
    // the pulse is an inline animation: left on, it would replace the returning bubble's site-chat-return class
    const { watchPulse } = await load();
    vi.useFakeTimers();
    try {
      const calls: boolean[] = [];
      const stop = watchPulse((on) => calls.push(on), 10_000);
      vi.advanceTimersByTime(3_500);
      stop();
      expect(calls).toEqual([true, false]);
      vi.advanceTimersByTime(30_000);
      expect(calls).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
    // React runs the cleanup when the panel opens (state leaves 'collapsed')
    expect(chat).toMatch(
      /useEffect\(\(\) => \(state === ['"]collapsed['"] && mounted \? watchPulse\(setShouldPulse\) : undefined\), \[state, mounted\]\);/,
    );
  });

  it('a press comes from the keyboard when its control holds the keyboard focus (the phone-menu rule)', async () => {
    const { fromKeyboard } = await load();
    const control = (focusVisible: boolean) =>
      ({ matches: (query: string) => focusVisible && query === ':focus-visible' }) as unknown as Element;
    expect(fromKeyboard(control(true))).toBe(true);
    expect(fromKeyboard(control(false))).toBe(false);
  });

  it('opened from the keyboard (Enter on the bubble), the panel shows at once: it takes no motion classes', () => {
    expect(chat).toMatch(/onClick=\{\(event\) => handleBubbleClick\(event\.currentTarget\)\}/);
    expect(declaration(chat, 'ChatBubble')).toMatch(
      /const handleBubbleClick = \(bubble: Element\) => \{\s*if \(state === ['"]collapsed['"]\) \{\s*setInstant\(fromKeyboard\(bubble\)\);/,
    );
    // both panels (the field and the full chat) drop the grow and fold, the Reduce Motion fades included
    expect(chat.match(/instant \? undefined : PANEL_MOTION/g)).toHaveLength(2);
  });

  it('closed from the keyboard (Escape, or Enter on close or minimize), it goes at once and so does the bubble', () => {
    expect(chat).toMatch(/if \(e\.key === ['"]Escape['"]\) \{\s*fold\(['"]minimize['"], true\);/);
    expect(chat).toMatch(
      /const handleClose = \(event: [^)]+\) => fold\(['"]close['"], fromKeyboard\(event\.currentTarget\)\);/,
    );
    expect(chat).toMatch(
      /const handleMinimize = \(event: [^)]+\) => fold\(['"]minimize['"], fromKeyboard\(event\.currentTarget\)\);/,
    );
    expect(chat).toMatch(/setReturning\(!instant\);/);
    // a pointer keeps the motion: the decision is made per open and per close, and "Ask about this" always grows
    expect(chat).toMatch(/setInstant\(byKey\);\s*setClosing\(how\);/);
    expect(declaration(chat, 'ChatBubble')).toMatch(/const onAsk = [\s\S]*?setInstant\(false\);/);
  });
});

describe('site-tooltips: a 400ms first wait, instant neighbours, an ink fill', () => {
  const render = (...children: ReturnType<typeof createElement>[]) =>
    renderToStaticMarkup(createElement('div', null, ...children));
  const tip = (text: string) => createElement(Tooltip, null, createElement(TooltipTrigger, null, text));
  const count = (html: string, tag: string) => html.match(new RegExp(`<${tag}\\b`, 'g'))?.length ?? 0;

  it('the provider waits 400ms on the first hover and skips the wait for 300ms after a tooltip closes', () => {
    const html = render(createElement(TooltipProvider, null, 'x'));
    expect(html).toContain('<tip-provider data-delay="400" data-skip="300">');
  });

  it('tooltips under one provider share it, so a neighbour opens at once; a lone tooltip brings its own', () => {
    const shared = render(createElement(TooltipProvider, null, tip('a'), tip('b'), tip('c')));
    expect(count(shared, 'tip-provider')).toBe(1);
    expect(count(shared, 'tip-root')).toBe(3);
    const alone = render(tip('a'));
    expect(count(alone, 'tip-provider')).toBe(1);
  });

  it('the tooltip root sets no wait of its own, so it takes its provider defaults: 400ms first, 300ms skip', () => {
    expect(render(tip('a'))).toContain('<tip-provider data-delay="400" data-skip="300"><tip-root>');
    expect(render(createElement(TooltipProvider, null, tip('a')))).toContain(
      '<tip-provider data-delay="400" data-skip="300"><tip-root>',
    );
  });

  it('a provider with no props of its own inside another passes its children through: one provider, one skip', () => {
    // app/events/edit, ProjectCard, RemoveButton, TeamMembers and the token allocation list wrap tooltips this way
    const html = render(createElement(TooltipProvider, null, createElement(TooltipProvider, null, tip('a'), tip('b'))));
    expect(count(html, 'tip-provider')).toBe(1);
    expect(count(html, 'tip-root')).toBe(2);
  });

  it('a provider that sets a wait keeps it for the tooltips under it (the evaluate board 150, the chart picker 300)', () => {
    for (const delayDuration of [0, 150, 300]) {
      const html = render(
        createElement(TooltipProvider, null, createElement(TooltipProvider, { delayDuration }, tip('a'))),
      );
      expect(count(html, 'tip-provider')).toBe(2);
      expect(html).toContain(`<tip-provider data-delay="${delayDuration}" data-skip="300"><tip-root>`);
    }
  });

  it("the console sidebar's provider sets nothing of its own, so console tooltips take the site's waits", async () => {
    // The console wraps every page in SidebarProvider; the genesis fee fields, the proposal's demo, sit under it.
    const { SidebarProvider } = await import('@/components/ui/sidebar');
    const html = render(createElement(TooltipProvider, null, createElement(SidebarProvider, null, tip('a'), tip('b'))));
    expect(count(html, 'tip-provider')).toBe(1);
    expect(html).toContain('<tip-provider data-delay="400" data-skip="300">');
    expect(count(html, 'tip-root')).toBe(2);
  });

  it('every page sits under one provider, so tooltips anywhere share the skip', () => {
    const providers = read(PROVIDERS);
    expect(providers).toMatch(/import \{ TooltipProvider \} from ['"]@\/components\/ui\/tooltip['"];/);
    expect(providers).toMatch(
      /<TooltipProvider>\s*<MotionConfig reducedMotion="user">\{children\}<\/MotionConfig>\s*<\/TooltipProvider>/,
    );
  });

  const html = render(createElement(TooltipContent, null, 'tip'));
  const content = classesOf(html, 'tip-content');
  const arrow = classesOf(html, 'tip-arrow');

  it('the fill is ink with near-white text, zinc-100 with ink text in the dark theme, and nothing pink is left', () => {
    expect(html).not.toMatch(/d66666/i);
    for (const theme of ['light', 'dark'] as const) {
      const fill = colourOf(content, 'bg', theme);
      expect(colourOf(arrow, 'bg', theme)).toBe(fill);
      expect(colourOf(arrow, 'fill', theme)).toBe(fill);
      expect(contrast(palette(colourOf(content, 'text', theme)), palette(fill))).toBeGreaterThanOrEqual(4.5);
    }
    expect(colourOf(content, 'bg', 'light')).toBe('zinc-900');
    expect(colourOf(content, 'bg', 'dark')).toBe('zinc-100');
  });

  /** The palette colour the plate gives a theme token (`--primary`) in a theme, from its arbitrary-property class. */
  const tokenOn = (name: string, theme: 'light' | 'dark') => {
    const pattern = new RegExp(`^${theme === 'dark' ? 'dark:' : ''}\\[--${name}:var\\(--color-([a-z]+-\\d+)\\)\\]$`);
    const found = content.map((t) => t.match(pattern)?.[1]).filter(Boolean);
    expect(found, `--${name} on the plate (${theme})`).toHaveLength(1);
    return found[0] as string;
  };

  it('the plate re-points --primary and --muted-foreground for what it holds, and both pass 4.5:1 on it', () => {
    // The stats export tooltips write text-primary and text-muted-foreground, made for the page's ground, not the plate.
    expect([tokenOn('primary', 'light'), tokenOn('primary', 'dark')]).toEqual(['zinc-50', 'zinc-900']);
    expect([tokenOn('muted-foreground', 'light'), tokenOn('muted-foreground', 'dark')]).toEqual([
      'zinc-400',
      'zinc-600',
    ]);
    for (const theme of ['light', 'dark'] as const) {
      const fill = palette(colourOf(content, 'bg', theme));
      for (const name of ['primary', 'muted-foreground']) {
        expect(contrast(palette(tokenOn(name, theme)), fill), `${name} (${theme})`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('a delayed open grows from 97% at the trigger in 150ms on the strong ease-out and leaves in 100ms', () => {
    expect(content).toContain('origin-(--radix-tooltip-content-transform-origin)');
    // shared keyframes: the search's settle in, the path card's exit
    expect(content).toContain('data-[state=delayed-open]:animate-[site-search-in_150ms_var(--ease-out)]');
    expect(content).toContain('data-[state=closed]:animate-[acad-path-out_100ms_var(--ease-out)_forwards]');
    expect(keyframes('site-search-in')).toEqual({ from: { opacity: '0', transform: 'scale(0.97)' } });
    expect(keyframes('acad-path-out')).toEqual({ to: { opacity: '0', transform: 'scale(0.97)' } });
    // Radix Presence ends an exit on the end or cancel of any animation whose name the exit's contains
    const names = (state: string) =>
      content
        .filter((t) => t.includes(`data-[state=${state}]:animate-[`))
        .map((t) => t.split('animate-[')[1].split('_')[0]);
    for (const entry of names('delayed-open')) {
      for (const exit of names('closed')) expect(exit, `${exit} holds ${entry}`).not.toContain(entry);
    }
  });

  it('an instant open (a neighbour) carries no animation class at all', () => {
    const animated = content.filter((t) => /animate|zoom-|fade-|slide-in/.test(t));
    expect(animated.length).toBeGreaterThan(0);
    for (const t of animated)
      expect(t).toMatch(/^(?:motion-reduce:)?data-\[state=(?:delayed-open|closed)\]:animate-\[/);
  });

  it('under Reduce Motion the delayed open only fades in, in 100ms; the delay rules stay', () => {
    expect(content).toContain('motion-reduce:data-[state=delayed-open]:animate-[vs-fade-in_100ms_var(--ease-out)]!');
    expect(keyframes('vs-fade-in')).toEqual({ from: { opacity: '0' } });
  });

  it('the genesis fee tooltips: the description passes 4.5:1 on the fill in both themes, and the emoji is gone', () => {
    const fees = read(FEES);
    const field = declaration(fees, 'FieldTooltip');
    const description = field.match(/<p className="([^"]*)">\{info\.description\}/)?.[1].split(/\s+/) ?? [];
    for (const theme of ['light', 'dark'] as const) {
      const fill = colourOf(content, 'bg', theme);
      expect(contrast(palette(colourOf(description, 'text', theme)), palette(fill))).toBeGreaterThanOrEqual(4.5);
    }
    expect(fees).not.toContain('\u{1F4A1}');
    // the recommendation takes the tooltip's own text colour, which passes in both themes
    expect(field).toMatch(/<p className="text-xs">\{info\.recommendation\}<\/p>/);
  });
});

describe("extras from Task 2's review: the house focus ring", () => {
  it('the phone search toggle drops its grey ring for the house ring, set at rest so it never fades in', () => {
    const rest = ruleFor('button[data-search]');
    expect(valueOf(rest, 'outline-width')).toBe('2px');
    expect(valueOf(rest, 'outline-color')?.toLowerCase()).toBe(BRAND_RED);
    expect(valueOf(rest, 'outline-offset')).toBe('2px');
    expect(declOf(rest, 'outline-style')).toBeUndefined();
    const focus = ruleFor('button[data-search]:focus-visible');
    expect(valueOf(focus, 'outline-style')).toBe('solid');
    expect(valueOf(focus, 'box-shadow')).toBe('none');
    // unlayered, so they beat fumadocs' focus-visible:ring-2 and focus-visible:outline-none utilities
    expect(atRulesAround(rest)).toEqual([]);
    expect(atRulesAround(focus)).toEqual([]);
  });

  const OWN_FOCUS = /\bfocus(?:-visible)?:(?:outline|ring)/;

  it('the signed-in profile trigger draws no focus style of its own, so the house ring shows', () => {
    expect(declaration(read(USER_BUTTON), 'WRAPPER_CLASS')).not.toMatch(OWN_FOCUS);
  });

  it('Log in and Sign up draw no focus style of their own, so their ring is the static house ring', () => {
    const auth = read(AUTH_BUTTONS);
    for (const name of ['BUTTON_CLASS', 'LOG_IN_CLASS', 'SIGN_UP_CLASS']) {
      expect(declaration(auth, name)).not.toMatch(OWN_FOCUS);
    }
  });
});

describe('X6: each use-toast toast shows once, however many Toasters a page mounts', () => {
  const MOUNT = /<Toaster\b/;
  const IMPORT = /import \{ Toaster \} from ['"](?:@\/components|\.\.)\/ui\/toaster['"]/;

  it('the first Toaster mounted is the one that renders the toasts; the next ones wait their turn', () => {
    const order = toasterOrder(toasterOrder([], { mount: 'host' }), { mount: 'members' });
    expect(order).toEqual(['host', 'members']);
  });

  it('when the one that renders unmounts, the next one mounted takes over', () => {
    expect(toasterOrder(['host', 'members', 'modal'], { unmount: 'host' })).toEqual(['members', 'modal']);
    expect(toasterOrder(['host', 'members', 'modal'], { unmount: 'members' })).toEqual(['host', 'modal']);
  });

  it('a Toaster mounted twice (Strict Mode) is listed once, and an unknown one changes nothing', () => {
    const order = ['host'];
    expect(toasterOrder(order, { mount: 'host' })).toBe(order);
    expect(toasterOrder(order, { unmount: 'gone' })).toBe(order);
  });

  it('a change returns a new list and never changes the one it was given', () => {
    const order = Object.freeze(['host']);
    const next = toasterOrder(order, { mount: 'members' });
    expect(next).not.toBe(order);
    expect(order).toEqual(['host']);
  });

  it('on the server, and so in the first client render, a Toaster renders nothing: hydration matches', () => {
    expect(renderToStaticMarkup(createElement(Toaster))).toBe('');
  });

  it("the showcase grid mounts no Toaster per card or per badge modal: ShowCaseCard's renders theirs", () => {
    expect(read(SHOWCASE)).toMatch(MOUNT);
    for (const path of [PROJECT_OPTIONS, ASSIGN_BADGE]) {
      expect(read(path)).not.toMatch(MOUNT);
      expect(read(path)).not.toMatch(IMPORT);
    }
  });

  it('Members keeps its own: on the hackathon stage form it is the only one; under a host with one it waits', () => {
    expect(read(MEMBERS)).toMatch(MOUNT);
  });
});
