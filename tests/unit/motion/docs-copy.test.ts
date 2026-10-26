import postcss, { type Declaration, type Rule } from 'postcss';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pressMode, watchPageFade } from '@/app/docs/docs-layout-wrapper';
import { DocsCodeBlock } from '@/components/docs-book/code-block';
import { CopyMarkdownLabels } from '@/components/ui/copy-markdown-labels';
import { Feedback } from '@/components/ui/feedback';
import { SidebarActions } from '@/components/ui/sidebar-actions';
import { createCopiedFlash, holdCopiedFlash, type CopiedFlash } from '@/hooks/use-copied-flash';
import { block, read, rulesFor as rulesIn, ungatedHover } from './helpers';

/**
 * Task 10 of the hub motion pass: docs-code-copy, docs-copy-markdown and site-page-transition, with the values of each
 * proposal's spec and its Reduce Motion path. The site policy (app/global.css) runs colour and opacity transitions in
 * 150ms under Reduce Motion with !important; a reduced line that needs another duration restores it with its own
 * !important, which a Tailwind utility (layered) takes over the unlayered policy.
 */
const CODE_BLOCK = 'components/docs-book/code-block.tsx';
const FLASH = 'hooks/use-copied-flash.ts';
const LABELS = 'components/ui/copy-markdown-labels.tsx';
const FEEDBACK = 'components/ui/feedback.tsx';
const SIDEBAR = 'components/ui/sidebar-actions.tsx';
const PAGE = 'app/docs/[...slug]/page.tsx';
const WRAPPER = 'app/docs/docs-layout-wrapper.tsx';
/** The files this task wrote or edited; global.css is shared, so only its site-page-transition block is read. */
const TOUCHED = [CODE_BLOCK, FLASH, LABELS, FEEDBACK, SIDEBAR, PAGE, WRAPPER];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const REDUCE = /prefers-reduced-motion:\s*reduce/;

/** The copied mark the components ask for: the delay they pass, and what the test makes them show. */
const flash = vi.hoisted(() => ({ shown: false, delays: [] as number[] }));

vi.mock('@/hooks/use-copied-flash', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/use-copied-flash')>();
  return {
    ...real,
    useCopiedFlash: (ms: number) => {
      flash.delays.push(ms);
      return [flash.shown, () => undefined, () => undefined] as const;
    },
  };
});
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/docs/nodes/architecture/proposervm',
}));

/** renderToStaticMarkup escapes these in attribute values; class names like has-[>svg]:px-2.5 need them back. */
const decode = (text: string) =>
  text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');

/** The server markup of a component, escaped as rendered: no attribute value holds a raw > or quote. */
function render<P extends object>(component: ComponentType<P>, props: P, ...children: ReactNode[]) {
  return renderToStaticMarkup(createElement(component, props, ...children));
}

const FEEDBACK_PROPS = {
  path: 'content/docs/x.mdx',
  title: 'X',
  pagePath: '/docs/x',
  onRateAction: async () => undefined,
};
const SIDEBAR_PROPS = { editUrl: 'https://example.com', title: 'X', pagePath: '/x' };

/** The class list of an opening tag. */
const classesOf = (tag: string) =>
  new Set(
    decode(tag.match(/class="([^"]*)"/)?.[1] ?? '')
      .split(/\s+/)
      .filter(Boolean),
  );

/** The data-checked attribute, not the data-checked: class variant. */
const CHECKED = /\sdata-checked="/;

/** The first <button> whose markup matches `test`, as its opening tag and its whole markup. */
function button(html: string, test: RegExp) {
  const found = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => test.test(b));
  expect(found, `a button matching ${test}`).toBeDefined();
  const markup = found as string;
  return { markup, open: markup.match(/^<button\b[^>]*>/)?.[0] ?? '' };
}

/** The opening tags of the direct children of the first grid span in `markup` (the stacked cells). */
function stack(markup: string): string[] {
  const start = markup.search(/<span\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/);
  expect(start, 'a grid span holding the stacked states').toBeGreaterThanOrEqual(0);
  const tokens = markup.slice(start).matchAll(/<(\/?)([a-z]+)\b[^>]*?(\/?)>/g);
  const cells: string[] = [];
  let depth = 0;
  for (const [tag, closing, , selfClosing] of tokens) {
    if (closing) {
      depth -= 1;
      if (depth === 0) break;
      continue;
    }
    if (depth === 1) cells.push(tag);
    if (!selfClosing) depth += 1;
  }
  return cells;
}

/** The text of each stacked cell, in order. */
function cellTexts(markup: string): string[] {
  const start = markup.search(/<span\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/);
  const inner = markup.slice(start);
  return [...inner.matchAll(/<span\b[^>]*col-start-1[^>]*>([\s\S]*?)<\/span>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  );
}

const ms = (classes: Set<string>, prefix = '') =>
  [...classes]
    .filter((c) => c.startsWith(`${prefix}duration-`))
    .map((c) => Number(c.slice(`${prefix}duration-`.length).replace('!', '')));

beforeEach(() => {
  flash.shown = false;
  flash.delays = [];
});

describe('createCopiedFlash: the copied mark of a copy button', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make(delay: number) {
    const states: boolean[] = [];
    return { states, mark: createCopiedFlash((shown) => states.push(shown), delay) };
  }

  it('shows at once and clears itself after the delay', () => {
    const { states, mark } = make(1500);
    mark.show();
    expect(states).toEqual([true]);
    vi.advanceTimersByTime(1499);
    expect(states).toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(states).toEqual([true, false]);
  });

  it('a second copy restarts the wait, so the mark stays the full delay after the last copy (rapid repeat)', () => {
    const { states, mark } = make(1500);
    mark.show();
    vi.advanceTimersByTime(1000);
    mark.show();
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)).toBe(true);
    vi.advanceTimersByTime(500);
    expect(states.at(-1)).toBe(false);
    expect(states.filter((shown) => !shown)).toHaveLength(1);
  });

  it('hide clears the mark at once and cancels the pending clear', () => {
    const { states, mark } = make(2000);
    mark.show();
    mark.hide();
    expect(states).toEqual([true, false]);
    vi.advanceTimersByTime(5000);
    expect(states).toEqual([true, false]);
  });

  it('dispose (unmount) cancels the pending clear and sets nothing', () => {
    const { states, mark } = make(2000);
    mark.show();
    mark.dispose();
    vi.advanceTimersByTime(5000);
    expect(states).toEqual([true]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the hook's effect holds one mark; its cleanup (unmount) disposes it and empties the slot", () => {
    const states: boolean[] = [];
    const slot: { current: CopiedFlash | null } = { current: null };
    const cleanup = holdCopiedFlash(slot, (shown) => states.push(shown), 2000);
    expect(slot.current).not.toBeNull();
    slot.current?.show();
    cleanup();
    expect(slot.current).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(states).toEqual([true]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('docs-code-copy: the clipboard morphs into a check', () => {
  it('the docs MDX maps every code block (pre) to DocsCodeBlock, after the fumadocs defaults', () => {
    const src = read(PAGE);
    expect(src).toMatch(/import \{ DocsCodeBlock \} from ['"]@\/components\/docs-book\/code-block['"]/);
    const defaults = src.indexOf('defaultComponents;');
    const pre = src.search(/\bpre: DocsCodeBlock\b/);
    expect(defaults).toBeGreaterThan(-1);
    expect(pre).toBeGreaterThan(defaults);
  });

  it('keeps the fumadocs frame and drops its one-icon copy button for its own', () => {
    const src = read(CODE_BLOCK);
    expect(src).toMatch(/<CodeBlock\b[^>]*allowCopy=\{false\}/);
    expect(src).toMatch(/\.nd-copy-ignore/);
  });

  it('stacks both icons in one cell: the clipboard shown, the check at opacity 0, scale 0.8 and a 2px blur', () => {
    const html = render(DocsCodeBlock, {}, createElement('code', null, 'npm install x'));
    const copy = button(html, /aria-label="Copy Text"/);
    expect(copy.open).not.toMatch(CHECKED);
    const cells = stack(copy.markup);
    expect(cells).toHaveLength(2);
    const [clipboard, check] = cells.map(classesOf);
    expect(clipboard.has('lucide-clipboard')).toBe(true);
    expect(check.has('lucide-check')).toBe(true);
    for (const icon of [clipboard, check]) {
      expect(icon.has('col-start-1') && icon.has('row-start-1')).toBe(true);
      expect(icon.has('transition-[opacity,scale,filter]')).toBe(true);
      expect(icon.has('ease-out')).toBe(true);
      const [duration] = ms(icon);
      expect(duration).toBe(150);
      expect(duration).toBeLessThan(200);
    }
    expect(clipboard.has('opacity-0')).toBe(false);
    for (const off of ['opacity-0', 'motion-safe:scale-80', 'motion-safe:blur-[2px]'])
      expect(check.has(off)).toBe(true);
  });

  it('once copied, the check shows and the clipboard leaves the same way (the morph runs both ways)', () => {
    flash.shown = true;
    const html = render(DocsCodeBlock, {}, createElement('code', null, 'npm install x'));
    const copied = button(html, /aria-label="Copied Text"/);
    expect(copied.open).toMatch(CHECKED);
    const [clipboard, check] = stack(copied.markup).map(classesOf);
    for (const off of ['opacity-0', 'motion-safe:scale-80', 'motion-safe:blur-[2px]'])
      expect(clipboard.has(off)).toBe(true);
    expect(check.has('opacity-0')).toBe(false);
  });

  it('the check stays 1500ms after the last copy', () => {
    render(DocsCodeBlock, {}, createElement('code', null, 'x'));
    expect(flash.delays).toEqual([1500]);
  });

  it('the button presses in to 0.97 on the strong ease-out, with scale in its transition list', () => {
    const html = render(DocsCodeBlock, {}, createElement('code', null, 'x'));
    const press = classesOf(button(html, /aria-label="Copy Text"/).open);
    expect(press.has('active:scale-[0.97]')).toBe(true);
    const list = [...press].find((c) => c.startsWith('transition-['));
    expect(list?.slice('transition-['.length, -1).split(',')).toContain('scale');
    expect(press.has('ease-out')).toBe(true);
    const [duration] = ms(press);
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThanOrEqual(160);
  });

  it('Reduce Motion: a plain 120ms opacity cross-fade, no scale, no blur, no press', () => {
    const html = render(DocsCodeBlock, {}, createElement('code', null, 'x'));
    const copy = button(html, /aria-label="Copy Text"/);
    expect(classesOf(copy.open).has('motion-reduce:active:scale-100')).toBe(true);
    for (const icon of stack(copy.markup).map(classesOf)) {
      expect(ms(icon, 'motion-reduce:')).toEqual([120]);
      expect([...icon].some((c) => c.endsWith('!') && c.startsWith('motion-reduce:duration-'))).toBe(true);
      // scale and blur only where motion is welcome
      expect([...icon].filter((c) => /^(scale-|blur-)/.test(c))).toEqual([]);
    }
  });
});

describe('docs-copy-markdown: the label changes in place, at one width', () => {
  const STATES = [
    { state: 'idle', text: 'Copy Markdown' },
    { state: 'busy', text: 'Copying...' },
    { state: 'done', text: 'Copied' },
  ] as const;

  it.each(STATES)('$state: every label shares one grid cell, and only "$text" shows', ({ state, text }) => {
    const html = render(CopyMarkdownLabels, { state, done: 'Copied' });
    expect(cellTexts(html)).toEqual(['Copy Markdown', 'Copying...', 'Copied']);
    const cells = stack(html);
    expect(cells).toHaveLength(3);
    cells.forEach((cell, i) => {
      const classes = classesOf(cell);
      const shown = STATES[i].text === text;
      expect(classes.has('col-start-1') && classes.has('row-start-1')).toBe(true);
      expect(classes.has('whitespace-nowrap')).toBe(true);
      expect(classes.has('transition-[opacity,filter]')).toBe(true);
      expect(ms(classes)).toEqual([160]);
      expect(classes.has('ease-out')).toBe(true);
      expect(classes.has('opacity-0')).toBe(!shown);
      expect(classes.has('motion-safe:blur-[2px]')).toBe(!shown);
      // the hidden labels leave the button's accessible name
      expect(/aria-hidden="true"/.test(cell)).toBe(!shown);
      // and they are inert, so find in page never lands on a label nobody sees
      expect(/\sinert=""/.test(cell)).toBe(!shown);
    });
  });

  it('Reduce Motion: the labels cross-fade in 120ms without blur', () => {
    const html = render(CopyMarkdownLabels, { state: 'busy', done: 'Copied' });
    for (const classes of stack(html).map(classesOf)) {
      expect(ms(classes, 'motion-reduce:')).toEqual([120]);
      expect(classes.has('motion-reduce:duration-120!')).toBe(true);
      expect([...classes].filter((c) => c.startsWith('blur-'))).toEqual([]);
    }
  });

  it('the page actions pulse the copy icon while the Markdown loads, and only then', () => {
    const busy = render(CopyMarkdownLabels, { state: 'busy', done: 'Copied!', align: 'start', pulse: true });
    const icons = [...busy.matchAll(/<svg\b[^>]*>/g)].map((m) => classesOf(m[0]));
    expect(icons.map((icon) => icon.has('animate-pulse'))).toEqual([false, true, false]);
    const idle = render(CopyMarkdownLabels, { state: 'idle', done: 'Copied!', align: 'start', pulse: true });
    expect(idle).not.toMatch(/animate-pulse/);
  });

  it('feedback bar: the pill centres the shorter labels and holds Copied 2000ms after the last copy', () => {
    const copy = button(render(Feedback, FEEDBACK_PROPS), /Copy Markdown/);
    expect(copy.markup).toMatch(/<span\b[^>]*class="[^"]*\bgrid\b[^"]*\bjustify-items-center\b/);
    expect(cellTexts(copy.markup)).toEqual(['Copy Markdown', 'Copying...', 'Copied']);
    expect(flash.delays).toEqual([2000]);
  });

  it('page actions: the button keeps the padding its icon gave it, and the labels sit at the start', () => {
    const copy = button(render(SidebarActions, SIDEBAR_PROPS), /Copy Markdown/);
    const classes = classesOf(copy.open);
    expect(classes.has('px-2.5')).toBe(true);
    expect(classes.has('px-3')).toBe(false);
    expect(copy.markup).toMatch(/<span\b[^>]*class="[^"]*\bgrid\b[^"]*\bjustify-items-start\b/);
    expect(cellTexts(copy.markup)).toEqual(['Copy Markdown', 'Copying...', 'Copied!']);
    expect(flash.delays).toEqual([2000]);
  });

  it('once copied, both buttons name themselves by the shown label only', () => {
    flash.shown = true;
    for (const [html, done] of [
      [render(Feedback, FEEDBACK_PROPS), 'Copied'],
      [render(SidebarActions, SIDEBAR_PROPS), 'Copied!'],
    ]) {
      const cells = stack(button(html, /Copy Markdown/).markup);
      const shown = cells.filter((cell) => !/aria-hidden="true"/.test(cell));
      expect(shown).toHaveLength(1);
      expect(cells.indexOf(shown[0])).toBe(2);
      expect(cellTexts(button(html, /Copy Markdown/).markup)[2]).toBe(done);
    }
  });

  it.each([FEEDBACK, SIDEBAR])(
    '%s: a second copy restarts the wait and unmount clears it (no bare setTimeout)',
    (path) => {
      const src = read(path);
      expect(src).not.toMatch(/setTimeout\(/);
      expect(src).toMatch(/useCopiedFlash\(2000\)/);
    },
  );
});

/** Each rule of the site-page-transition block (global.css is shared, so the checks read only this block) whose
    selector list holds `selector`, with the @media params around it, outermost first. */
function rulesFor(selector: string): { rule: Rule; media: string[] }[] {
  return rulesIn(selector, { root: postcss.parse(block('site-page-transition')), anyQuotes: true }).map(
    ({ rule, at }) => ({
      rule,
      media: at.filter((around) => around.startsWith('@media ')).map((around) => around.slice('@media '.length)),
    }),
  );
}

function one(selector: string, reduced = false): Rule {
  const found = rulesFor(selector).filter(({ media }) => media.some((params) => REDUCE.test(params)) === reduced);
  expect(found, `${reduced ? 'reduced ' : ''}rule for ${selector}`).toHaveLength(1);
  return found[0].rule;
}

const valueOf = (rule: Rule, prop: string) =>
  rule.nodes.find((node): node is Declaration => node.type === 'decl' && node.prop === prop)?.value;

const toMs = (time: string) => (time.endsWith('ms') ? Number(time.slice(0, -2)) : Number(time.slice(0, -1)) * 1000);

/** An `animation` shorthand with one animation: its keyframes name, duration, delay, easing and fill. */
function parseAnimation(value: string | undefined) {
  const tokens = value?.match(/[\w-]+\([^)]*\)|\S+/g) ?? [];
  const times = tokens.filter((token) => /^[\d.]+m?s$/.test(token)).map(toMs);
  const easing = tokens.find((token) => /^(var\(--ease|cubic-bezier|ease|linear)/.test(token));
  const name = tokens.find((token) => !/^[\d.]+m?s$/.test(token) && token !== easing && token !== 'both');
  return { name, ms: times[0], delayMs: times[1] ?? 0, easing, fill: tokens.includes('both') ? 'both' : undefined };
}

/** Each keyframe selector of @keyframes `name`, with its declarations. The docs fade reuses the explorer's vs-fade-in
    and vs-fade-out, so they are read from the exp-view-switch block. */
function keyframes(name: string | undefined): Record<string, Record<string, string>> {
  const frames: Record<string, Record<string, string>> = {};
  postcss.parse(block('exp-view-switch')).walkAtRules('keyframes', (atRule) => {
    if (atRule.params !== name) return;
    atRule.walkRules((frame) => {
      frames[frame.selector] = Object.fromEntries(
        frame.nodes.filter((node): node is Declaration => node.type === 'decl').map((decl) => [decl.prop, decl.value]),
      );
    });
  });
  return frames;
}

const DOCS = ':root:has([data-route-layout="docs"])';
const FADE = ':root[data-bk-page-fade]';
const CUT = ':root:not([data-bk-page-fade])';
/** Docs pages, except while the theme switch reveals the new theme (Task 3's view transition). */
const DOCS_NO_REVEAL = `${DOCS}:not([data-theme-reveal])`;

describe('site-page-transition: the docs article fades, the navbar and sidebar hold', () => {
  it('each docs page wraps its DocsPage (#nd-page) in a ViewTransition that only enters and exits', () => {
    const src = read(PAGE);
    const wrap = src.match(/<ViewTransition\b([^>]*)>\s*<DocsPage\b/);
    expect(wrap, 'a ViewTransition right around DocsPage').not.toBeNull();
    const props = wrap?.[1] ?? '';
    expect(props).toMatch(/\benter="bk-page-in"/);
    expect(props).toMatch(/\bexit="bk-page-out"/);
    expect(props).toMatch(/\bdefault="none"/);
    // an auto name: the old and the new page never pair into one morphing group
    expect(props).not.toMatch(/\bname=/);
    expect(src).toMatch(/<\/DocsPage>\s*<\/ViewTransition>/);
  });

  it('the old page leaves first: opacity to 0 in 100ms on the strong ease-out (the explorer vs-fade-out)', () => {
    const out = parseAnimation(valueOf(one(`${FADE}::view-transition-old(.bk-page-out)`), 'animation'));
    expect(out).toMatchObject({ name: 'vs-fade-out', ms: 100, delayMs: 0, easing: 'var(--ease-out)', fill: 'both' });
    const frames = keyframes(out.name);
    expect(Object.values(frames).flatMap((frame) => Object.keys(frame))).toEqual(['opacity']);
    expect(frames.to?.opacity).toBe('0');
  });

  it('the new page arrives 60ms later: opacity from 0 over 180ms on the strong ease-out (the explorer vs-fade-in)', () => {
    const into = parseAnimation(valueOf(one(`${FADE}::view-transition-new(.bk-page-in)`), 'animation'));
    expect(into).toMatchObject({ name: 'vs-fade-in', ms: 180, delayMs: 60, easing: 'var(--ease-out)', fill: 'both' });
    const frames = keyframes(into.name);
    expect(Object.values(frames).flatMap((frame) => Object.keys(frame))).toEqual(['opacity']);
    expect(frames.from?.opacity).toBe('0');
  });

  it('the block defines no keyframes of its own', () => {
    let count = 0;
    postcss.parse(block('site-page-transition')).walkAtRules('keyframes', () => {
      count += 1;
    });
    expect(count).toBe(0);
  });

  it('the root (navbar, sidebar, page ground) never animates on a docs page, whatever starts the transition', () => {
    for (const pseudo of ['old', 'new']) {
      expect(valueOf(one(`${DOCS}::view-transition-${pseudo}(root)`), 'animation')).toBe('none');
    }
  });

  it('the overlay takes no pointer events: the sidebar and the bars take presses during the fade, the named article and chat none', () => {
    expect(valueOf(one(`${DOCS}::view-transition`), 'pointer-events')).toBe('none');
  });

  it('a change no pointer started (keyboard, Back or Forward) swaps at once', () => {
    expect(valueOf(one(`${CUT}::view-transition-old(.bk-page-out)`), 'display')).toBe('none');
    expect(valueOf(one(`${CUT}::view-transition-new(.bk-page-in)`), 'animation')).toBe('none');
  });

  it('Reduce Motion: nothing moves, the new page fades in over 120ms', () => {
    const into = parseAnimation(valueOf(one(`${FADE}::view-transition-new(.bk-page-in)`, true), 'animation'));
    expect(into).toMatchObject({ name: 'vs-fade-in', ms: 120, delayMs: 0, easing: 'var(--ease-out)' });
    expect(Object.keys(Object.assign({}, ...Object.values(keyframes(into.name))))).toEqual(['opacity']);
  });

  it('the fading pages are clipped below the navbar and the docs bar, except for the theme reveal', () => {
    const clip = one(`${DOCS_NO_REVEAL}::view-transition`);
    // 6.5rem: the navbar's height (--site-nav-h, 3.5rem and 1px) and the docs bar's 3rem, less 1px
    expect(valueOf(clip, '--bk-bars')).toBe('calc(var(--fd-banner-height, 0px) + var(--site-nav-h) + 3rem - 1px)');
    expect(valueOf(clip, 'clip-path')).toBe('polygon(0 var(--bk-bars), 100vw var(--bk-bars), 100vw 100vh, 0 100vh)');
  });

  it('the chat bubble takes its own name on a docs page, never during the theme reveal', () => {
    expect(valueOf(one(`${DOCS_NO_REVEAL} [data-chatbot]`), 'view-transition-name')).toBe('bk-chat');
  });

  it('the consent card takes no name: no fade runs while it shows (pressMode), so it always takes presses', () => {
    // a named element takes no presses while a view transition runs: a press on Accept mid-fade fell through to the
    // sidebar link behind the card and left the page with consent unsaved
    const text = block('site-page-transition');
    expect(text).not.toContain('bk-consent');
    postcss.parse(text).walkDecls('view-transition-name', (decl) => {
      for (const selector of (decl.parent as Rule).selectors)
        expect(selector).not.toMatch(/privacy-banner-root\s*>\s*div$/);
    });
  });

  it('while the consent card is in the page, a change that swaps at once captures no article: nothing is drawn over the card', () => {
    // React still runs a view transition for the swap, and a captured article is drawn above the whole page, over the
    // unnamed card (measured: for one to two frames the new article's text covered the card at 1440 and at 390)
    const rule = one(
      ':root:has([data-route-layout="docs"]):has(#privacy-banner-root > div):not([data-bk-page-fade]) #nd-page',
    );
    expect(
      rule.nodes.filter((node): node is Declaration => node.type === 'decl').map((decl) => decl.toString()),
    ).toEqual(['view-transition-name: none !important']);
  });

  it('the chat bubble stays still and whole above the fading pages', () => {
    const group = one('::view-transition-group(bk-chat)');
    expect(valueOf(group, 'animation')).toBe('none');
    expect(valueOf(group, 'z-index')).toBe('1');
    // the live bubble shows at once; its old picture, with the same shadow, would double the shadow under it
    expect(valueOf(one('::view-transition-old(bk-chat)'), 'display')).toBe('none');
    expect(valueOf(one('::view-transition-new(bk-chat)'), 'animation')).toBe('none');
  });

  it('nothing else is named: the navbar and the sidebar stay in the held root', () => {
    // (none: the article taking no name in a swap while the consent card is in the page, above)
    const names = [...block('site-page-transition').matchAll(/view-transition-name:\s*([\w-]+)/g)].map((m) => m[1]);
    expect(names.sort()).toEqual(['bk-chat', 'none']);
    expect(read(WRAPPER)).not.toMatch(/view-transition-name|viewTransitionName|<ViewTransition/);
    const page = read(PAGE);
    expect(page).not.toMatch(/view-transition-name|viewTransitionName/);
    expect(page.match(/<ViewTransition\b/g)).toHaveLength(1);
  });
});

/** An element of the page, for the stub document: its tag and attributes. */
interface Layer {
  tag: string;
  attrs: Record<string, string>;
}

/** Whether `layer` matches `selector`: a tag, attribute tests and one :not(tag), the forms the gate's selectors use. */
function matchesLayer(selector: string, layer: Layer): boolean {
  const parts = selector.match(/^([a-z]*)((?:\[[^\]]+\])*)(?::not\(([a-z]+)\))?$/);
  if (!parts) throw new Error(`the stub does not read ${selector}`);
  const [, tag, attrs, notTag] = parts;
  if ((tag && layer.tag !== tag) || (notTag && layer.tag === notTag)) return false;
  return [...attrs.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(
    ([, name, value]) => name in layer.attrs && (value === undefined || layer.attrs[name] === value),
  );
}

const HOVER_CARD: Layer = { tag: 'div', attrs: { 'data-slot': 'hover-card-content', 'data-state': 'open' } };
const POPPER: Layer = { tag: 'div', attrs: { 'data-radix-popper-content-wrapper': '' } };
const RADIX_DIALOG: Layer = { tag: 'div', attrs: { role: 'dialog', 'data-state': 'open' } };
const OPEN_NATIVE_DIALOG: Layer = { tag: 'dialog', attrs: { role: 'dialog', open: '' } };
/** An image zoom keeps one of these in the page for every docs image. */
const CLOSED_NATIVE_DIALOG: Layer = { tag: 'dialog', attrs: { role: 'dialog' } };

type Box = { top: number; height: number };

/** A stub element: `closest` matches the simple selectors it sits in. Its document holds `layers` (other elements of
    the page), the docs bars (their bottom on screen), and the boxes of the consent card and the chat when they exist. */
function element(
  inside: string[],
  layers: Layer[] = [],
  { bars = 104, consent, chat }: { bars?: number; consent?: Box; chat?: Box } = {},
): Element {
  const selectors = (list: string) => list.split(',').map((selector) => selector.trim());
  const boxed = (box?: Box) => (box ? { getBoundingClientRect: () => box } : null);
  return {
    closest: (list: string) => (selectors(list).some((selector) => inside.includes(selector)) ? {} : null),
    ownerDocument: {
      querySelector: (list: string) => {
        if (list === '#docs-subnav') return { getBoundingClientRect: () => ({ bottom: bars }) };
        if (list === '#privacy-banner-root > div') return boxed(consent);
        if (list === '[data-chatbot]') return boxed(chat);
        return selectors(list).some((selector) => layers.some((layer) => matchesLayer(selector, layer))) ? {} : null;
      },
    },
  } as unknown as Element;
}

const TRIGGER = '[data-slot="hover-card-trigger"]';

describe('pressMode: whether the page change a pointer press starts fades', () => {
  it.each(['#nd-page', '#nd-sidebar', '#docs-subnav'])('a press in %s with nothing floating open fades', (where) => {
    expect(pressMode(element([where]))).toBe('fade');
  });

  it.each(['#nd-sidebar-mobile', '[role="dialog"]', '[data-chatbot]', 'header'])(
    'a press in %s, off the page in view, swaps at once: a sheet closes over the change',
    (where) => {
      expect(pressMode(element([where]))).toBe('cut');
    },
  );

  it.each([
    ['a hover card', HOVER_CARD],
    ['other Radix popper content', POPPER],
    ['a Radix dialog', RADIX_DIALOG],
    ['an open native dialog (an image zoomed)', OPEN_NATIVE_DIALOG],
  ])('a press on the page while %s is open swaps at once: the fade would draw over it', (_, layer) => {
    expect(pressMode(element(['#docs-subnav'], [layer]))).toBe('cut');
    expect(pressMode(element(['#nd-page'], [layer]))).toBe('cut');
  });

  it('a closed native dialog (the image zoom every docs image keeps) does not stop the fade', () => {
    expect(pressMode(element(['#nd-sidebar'], [CLOSED_NATIVE_DIALOG]))).toBe('fade');
    expect(pressMode(element(['#nd-page'], [CLOSED_NATIVE_DIALOG, CLOSED_NATIVE_DIALOG]))).toBe('fade');
  });

  it.each(['mouse', 'pen', ''])(
    'a %s press on a hover-card trigger swaps at once, even before its card opens (desktop docs-bar tabs)',
    (pointerType) => {
      expect(pressMode(element(['#docs-subnav', TRIGGER]), pointerType)).toBe('cut');
      expect(pressMode(element(['#nd-page', TRIGGER]), pointerType)).toBe('cut');
    },
  );

  it('a press with no pointer type counts as one that can hover: a trigger swaps at once', () => {
    expect(pressMode(element(['#docs-subnav', TRIGGER]))).toBe('cut');
  });

  it('a touch tap on a hover-card trigger fades: Radix opens no card for a touch pointer (tablets from 768px)', () => {
    expect(pressMode(element(['#docs-subnav', TRIGGER]), 'touch')).toBe('fade');
  });

  it('a docs-bar tab with no hover card (phones) still fades', () => {
    expect(pressMode(element(['#docs-subnav']))).toBe('fade');
  });

  it('a press while the consent card shows swaps at once, wherever the card sits: no fade ever runs under it', () => {
    // below the bars on a tall window (its top at 560), and reaching above them on a 430px tall one (at 90)
    for (const consent of [
      { top: 560, height: 324 },
      { top: 90, height: 324 },
    ]) {
      expect(pressMode(element(['#nd-page'], [], { consent }), 'mouse')).toBe('cut');
      expect(pressMode(element(['#nd-sidebar'], [], { consent }), 'touch')).toBe('cut');
    }
  });

  it('a press while the chat reaches above the docs bars swaps at once: the clip would cut it', () => {
    // the 520px chat panel on a 600px tall window (its top at 56)
    expect(pressMode(element(['#nd-page'], [], { bars: 104, chat: { top: 56, height: 520 } }))).toBe('cut');
  });

  it('the chat below the docs bars keeps the fade: it holds still above it', () => {
    expect(pressMode(element(['#nd-page'], [], { bars: 104, chat: { top: 820, height: 56 } }))).toBe('fade');
  });

  it('with no consent card and no chat shown (none, or hidden with no height: embed mode) the press fades', () => {
    expect(pressMode(element(['#nd-page'], [], { bars: 104 }))).toBe('fade');
    const hidden = { top: 0, height: 0 };
    expect(pressMode(element(['#nd-page'], [], { bars: 104, consent: hidden, chat: hidden }))).toBe('fade');
  });

  it('a press with no element target swaps at once', () => {
    expect(pressMode(null)).toBe('cut');
    expect(pressMode({} as EventTarget)).toBe('cut');
  });
});

describe('watchPageFade: html[data-bk-page-fade] follows the input that starts a page change', () => {
  function fakes() {
    const marks = new Set<string>();
    const listeners = new Map<string, EventListener>();
    const key = (where: string, type: string, capture?: boolean) => `${where} ${type} ${capture === true}`;
    const target = (where: string) => ({
      addEventListener: (type: string, listener: EventListener, capture?: boolean) =>
        listeners.set(key(where, type, capture), listener),
      removeEventListener: (type: string, listener: EventListener, capture?: boolean) => {
        if (listeners.get(key(where, type, capture)) === listener) listeners.delete(key(where, type, capture));
      },
    });
    const doc = {
      ...target('document'),
      documentElement: {
        setAttribute: (name: string) => marks.add(name),
        removeAttribute: (name: string) => marks.delete(name),
      },
    } as unknown as Document;
    const win = target('window') as unknown as Window;
    const fire = (where: string, type: string, capture: boolean, event: object = {}) => {
      const listener = listeners.get(key(where, type, capture));
      expect(listener, `a ${type} listener on ${where}`).toBeDefined();
      listener?.(event as Event);
    };
    return { marks, listeners, doc, win, fire };
  }
  const MARK = 'data-bk-page-fade';
  const inPage = { target: element(['#nd-page']), pointerType: 'mouse' };

  it('a press on the page in view marks html; a press in a sheet, a key press or Back/Forward clears it', () => {
    const { marks, doc, win, fire } = fakes();
    watchPageFade(doc, win);
    fire('document', 'pointerdown', true, inPage);
    expect(marks.has(MARK)).toBe(true);
    fire('document', 'keydown', true);
    expect(marks.has(MARK)).toBe(false);
    fire('document', 'pointerdown', true, inPage);
    fire('window', 'popstate', false);
    expect(marks.has(MARK)).toBe(false);
    fire('document', 'pointerdown', true, inPage);
    fire('document', 'pointerdown', true, { target: element(['#nd-sidebar-mobile']), pointerType: 'touch' });
    expect(marks.has(MARK)).toBe(false);
    fire('document', 'pointerdown', true, { target: element(['#docs-subnav'], [HOVER_CARD]), pointerType: 'mouse' });
    expect(marks.has(MARK)).toBe(false);
  });

  it('a press gives the gate its pointer type: a mouse on a docs-bar tab swaps at once, a touch tap fades', () => {
    const { marks, doc, win, fire } = fakes();
    watchPageFade(doc, win);
    fire('document', 'pointerdown', true, { target: element(['#docs-subnav', TRIGGER]), pointerType: 'mouse' });
    expect(marks.has(MARK)).toBe(false);
    fire('document', 'pointerdown', true, { target: element(['#docs-subnav', TRIGGER]), pointerType: 'touch' });
    expect(marks.has(MARK)).toBe(true);
  });

  it('focus landing on a hover-card trigger clears the mark: Radix opens its card on focus, which a tap can give', () => {
    // measured in Chromium at 1024px: a touch tap focuses the docs-bar tab and its card opens ~120ms later, mid-fade
    const { marks, doc, win, fire } = fakes();
    watchPageFade(doc, win);
    fire('document', 'pointerdown', true, { target: element(['#docs-subnav', TRIGGER]), pointerType: 'touch' });
    fire('document', 'focusin', true, { target: element(['#docs-subnav', TRIGGER]) });
    expect(marks.has(MARK)).toBe(false);
    // focus elsewhere (a sidebar link a press focused) keeps the fade
    fire('document', 'pointerdown', true, { target: element(['#nd-sidebar']), pointerType: 'mouse' });
    fire('document', 'focusin', true, { target: element(['#nd-sidebar']) });
    expect(marks.has(MARK)).toBe(true);
  });

  it('the cleanup (the docs layout leaving) removes the listeners and the mark', () => {
    const { marks, listeners, doc, win, fire } = fakes();
    const cleanup = watchPageFade(doc, win);
    fire('document', 'pointerdown', true, inPage);
    cleanup();
    expect(marks.size).toBe(0);
    expect(listeners.size).toBe(0);
  });
});

describe('hygiene', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it('the site-page-transition block in global.css exists: no transition-all, no ease-in, no ungated hover', () => {
    const text = block('site-page-transition');
    expect(text, 'a comment-headed block for site-page-transition').not.toBe('');
    expect(text).not.toMatch(TRANSITION_ALL);
    expect(text).not.toMatch(EASE_IN);
    expect(ungatedHover(text)).toBe(0);
  });
});
