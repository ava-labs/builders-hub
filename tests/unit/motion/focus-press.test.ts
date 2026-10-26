import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  atRulesAround,
  block,
  classesOf,
  declOf,
  declsOf,
  firstTag,
  globalCss,
  read,
  rulesFor,
  ungatedHover,
} from './helpers';

// The user button pulls in the auth client; the menus under test never render it.
vi.mock('@/components/login/user-button/UserButtonWrapper', () => ({ UserButtonWrapper: () => null }));

import { consoleMenu, developersMenu, ecosystemMenu, explorerMenu, solutionsMenu } from '@/app/layout.config';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Task 2 of the hub motion pass: one focus ring for keyboard users (site-focus-ring, variant a), buttons that press in
 * (site-press-feedback), in-page links that land below the navbar (site-anchor-offset) and one tab stop per navbar
 * item (site-nav-tab-stops).
 */
const BUTTON = 'components/ui/button.tsx';
const NAV_CONFIG = 'app/layout.config.tsx';
/** The source files this task touched; its global.css is read block by block (the file is shared). */
const TOUCHED = [BUTTON, NAV_CONFIG];
const BLOCKS = ['site-focus-ring', 'site-press-feedback', 'site-anchor-offset'];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const BRAND_RED = '#e6212f';
/** The named press list (site-press-feedback): Tailwind 4's scale-* sets the scale property, so scale is named too. */
const PRESS_PROPERTIES = ['color', 'background-color', 'border-color', 'box-shadow', 'transform', 'scale'];

const root = globalCss;

/** Every rule in global.css whose selector list holds `selector` exactly. */
const rulesAt = (selector: string): Rule[] => rulesFor(selector).map(({ rule }) => rule);

/** `found`, or a failed assertion that names what is missing. */
function must<T>(found: T | undefined, what: string): T {
  expect(found, what).toBeDefined();
  return found as T;
}

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** A selector that reaches links or buttons inside a nav element. */
const NAV_CONTROL = /(^|[\s>])nav\b[^,]*\s(a|button)\b/;

/** A class that sets a top scroll margin: scroll-m-*, scroll-mt-* or scroll-my-*, with any variant prefix. */
const TOP_MARGIN_CLASS = /(?<![\w:-])((?:[a-z0-9-]+:)*scroll-m[ty]?-(?:\d+|\[[^\]\s'"`]+\]))(?![\w-])/g;
/** Margins inside an inner scroller, never on a page anchor: the shadcn Select viewport's scroll-my-1. */
const INNER_SCROLLERS = new Set(['scroll-my-1']);
/** What the site renders: its source, and the fumadocs components whose classes Tailwind compiles. */
const SOURCES = [
  'app',
  'components',
  'content',
  'lib',
  'hooks',
  'node_modules/fumadocs-ui/dist',
  'node_modules/fumadocs-openapi/dist',
];
const TEXT = new Set(['.ts', '.tsx', '.js', '.mdx', '.md', '.css']);

/** Every top scroll margin class named in SOURCES. */
function topMarginClasses(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (TEXT.has(extname(entry.name))) {
        for (const match of readFileSync(join(process.cwd(), path), 'utf8').matchAll(TOP_MARGIN_CLASS)) {
          found.add(match[1]);
        }
      }
    }
  };
  SOURCES.forEach(walk);
  return found;
}

describe('every file this task touches', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(BLOCKS)(
    'the %s block in global.css exists, transitions no "all", never eases in and gates every hover',
    (id) => {
      const text = block(id);
      expect(text, `a comment-headed block for ${id}`).not.toBe('');
      expect(text).not.toMatch(TRANSITION_ALL);
      expect(text).not.toMatch(EASE_IN);
      expect(ungatedHover(text)).toBe(0);
    },
  );
});

describe('site-press-feedback and site-focus-ring: the nav transition rule', () => {
  it('no rule gives nav links or buttons a transition on "all" or an !important transition', () => {
    root.walkDecls(/^transition/, (decl) => {
      const rule = decl.parent as Rule;
      if (rule.type !== 'rule' || !rule.selectors.some((s) => NAV_CONTROL.test(s))) return;
      expect(decl.important ?? false, `${rule.selector} { ${decl.prop} }`).toBe(false);
      expect(decl.value, `${rule.selector} { ${decl.prop} }`).not.toMatch(/\ball\b/);
    });
  });

  it('nav a and nav button name the press list, never outline, in 150ms on the strong ease-out', () => {
    const rules = rulesAt('nav a').filter((found) => found.selectors.includes('nav button'));
    expect(rules, 'one rule for nav a, nav button').toHaveLength(1);
    const rule = must(rules[0], 'the nav a, nav button rule');
    expect(atRulesAround(rule), 'outside any at-rule, like the rules it replaces').toEqual([]);
    const props = list(declOf(rule, 'transition-property')?.value);
    for (const prop of [...PRESS_PROPERTIES, 'opacity']) expect(props, prop).toContain(prop);
    expect(props.filter((prop) => prop.startsWith('outline') || prop === 'all')).toEqual([]);
    expect(declOf(rule, 'transition-duration')?.value).toBe('150ms');
    expect(declOf(rule, 'transition-timing-function')?.value).toBe('var(--ease-out)');
    expect(declsOf(rule).filter((decl) => decl.important)).toEqual([]);
  });

  it('the old nav a and nav button rules keep their geometry but set no transition of their own', () => {
    for (const selector of ['nav a', 'nav button']) {
      const own = rulesAt(selector).filter((rule) => rule.selectors.length === 1);
      expect(own, selector).toHaveLength(1);
      expect(declsOf(own[0]).filter((decl) => decl.prop.startsWith('transition'))).toEqual([]);
    }
  });
});

describe('site-press-feedback: buttons press in', () => {
  it('navbar buttons scale to 0.97 while pressed, only when Reduce Motion is off', () => {
    const rules = rulesAt('#nd-nav button:not(:disabled):active');
    expect(rules).toHaveLength(1);
    const press = must(rules[0], 'the navbar press rule');
    expect(declOf(press, 'scale')?.value).toBe('0.97');
    expect(atRulesAround(press)).toEqual(['@media (prefers-reduced-motion: no-preference)']);
  });

  it('the shared Button names its transitions, scale included, and presses in on the strong ease-out', () => {
    const tokens = buttonVariants().split(/\s+/);
    expect(tokens).toContain(`transition-[${PRESS_PROPERTIES.join(',')}]`);
    expect(tokens).toContain('duration-150');
    expect(tokens).toContain('ease-out');
    expect(tokens).toContain('active:scale-[0.97]');
    expect(tokens.filter((token) => token.startsWith('transition-'))).toHaveLength(1);
  });

  it('the shared Button keeps no press scale under Reduce Motion', () => {
    expect(buttonVariants().split(/\s+/)).toContain('motion-reduce:active:scale-100');
  });

  it('a full-width Button can take the 0.98 press of the convention', () => {
    const tokens = cn(buttonVariants({ className: 'w-full active:scale-[0.98]' })).split(/\s+/);
    expect(tokens).toContain('active:scale-[0.98]');
    expect(tokens).not.toContain('active:scale-[0.97]');
    expect(tokens).toContain('motion-reduce:active:scale-100');
  });

  it('a full-width Button presses to 0.98 by itself, as the toolbox Button does; any other keeps 0.97', () => {
    // the convention's 0.98 for full-width buttons (the 4 sidebar actions on every docs page among them), so their
    // edges do not jump; the same w-full check as components/toolbox/components/Button.tsx
    const press = (className?: string) =>
      classesOf(firstTag(renderToStaticMarkup(createElement(Button, { className }, 'Go')), 'button'));
    for (const wide of ['w-full', 'w-full justify-start gap-2', 'w-full sm:w-auto']) {
      expect(press(wide), wide).toContain('active:scale-[0.98]');
      expect(press(wide), wide).not.toContain('active:scale-[0.97]');
      expect(press(wide), wide).toContain('motion-reduce:active:scale-100');
    }
    for (const narrow of [undefined, 'w-auto', 'sm:w-full']) {
      expect(press(narrow), String(narrow)).toContain('active:scale-[0.97]');
      expect(press(narrow), String(narrow)).not.toContain('active:scale-[0.98]');
    }
    // a press the caller sets still wins
    expect(press('w-full active:scale-[0.95]')).toContain('active:scale-[0.95]');
    expect(press('w-full active:scale-[0.95]')).not.toContain('active:scale-[0.98]');
  });
});

describe('site-focus-ring: one 2px brand red ring', () => {
  // read from the task's own block: another block's base-layer ring could otherwise answer for it
  const rings: Rule[] = [];
  postcss.parse(block('site-focus-ring')).walkRules((rule) => {
    if (rule.selector.includes(':focus-visible') && declOf(rule, 'outline')) rings.push(rule);
  });
  const ring = () =>
    must(
      rings.find((rule) => atRulesAround(rule).includes('@layer base')),
      'a :focus-visible outline rule in @layer base',
    );

  it('sits in the base layer, so a component that styles its own focus keeps it', () => {
    expect(declOf(ring(), 'outline')?.value.toLowerCase()).toBe(`2px solid ${BRAND_RED}`);
    expect(declOf(ring(), 'outline-offset')?.value).toBe('2px');
  });

  it('skips elements with their own ring or outline, and containers focused by script', () => {
    const { selector } = ring();
    expect(selector).toContain('[class*="focus-visible:ring"]');
    expect(selector).toContain('[class*="focus-visible:outline"]');
    expect(selector).toContain('[tabindex]:not([tabindex="-1"])');
  });

  it('appears and leaves at once: the ring rule animates nothing', () => {
    expect(declsOf(ring()).filter((decl) => /^(transition|animation)/.test(decl.prop))).toEqual([]);
  });

  it('holds its width, colour and offset at rest, so focus changes only the discrete style', () => {
    // Without this, a control with transition-colors or transition-all (or any control under the Reduce Motion rule,
    // which fades outline-color) would tween the ring in from the base outline colour.
    const squash = (selector: string) => selector.replace(/\s+/g, ' ');
    const atRest = squash(ring().selector.replace(':focus-visible', ''));
    let found: Rule | undefined;
    root.walkRules((rule) => {
      if (squash(rule.selector) === atRest) found = rule;
    });
    const rest = must(found, `the at-rest rule ${atRest}`);
    expect(atRulesAround(rest)).toContain('@layer base');
    expect(declOf(rest, 'outline-width')?.value).toBe('2px');
    expect(declOf(rest, 'outline-color')?.value.toLowerCase()).toBe(BRAND_RED);
    expect(declOf(rest, 'outline-offset')?.value).toBe('2px');
    expect(declOf(rest, 'outline-style')).toBeUndefined();
  });
});

describe('site-anchor-offset: in-page links land below the navbar', () => {
  /** The anchor offset: the navbar's height and 1rem less 1px of room for a focus ring, 4.5rem in all. */
  const OFFSET = 'calc(var(--site-nav-h) + 1rem - 1px)';
  const paddings: Rule[] = [];
  root.walkDecls('scroll-padding-top', (decl) => {
    if (decl.value === OFFSET && decl.parent?.type === 'rule') paddings.push(decl.parent as Rule);
  });
  const rule = () => must(paddings[0], `a scroll-padding-top: ${OFFSET} rule`);

  /** Every declaration of `prop` in global.css whose rule's selector holds `selector`. */
  const declsAt = (selector: string, prop: string) => {
    const found: Declaration[] = [];
    root.walkDecls(prop, (decl) => {
      if (decl.parent?.type === 'rule' && (decl.parent as Rule).selector.includes(selector)) found.push(decl);
    });
    return found;
  };
  /** A length written as rem and px terms, in px at a root font size, with the navbar token read in and no banner. */
  const px = (value: string, rootPx: number) => {
    const nav = must(declsAt(':root', '--site-nav-h')[0], 'the --site-nav-h token').value;
    const terms =
      value
        .replace(/var\(--site-nav-h\)/g, nav)
        .replace(/var\(--fd-banner-height, 0px\)/g, '0px')
        .match(/[+-]?\s*[\d.]+(?:rem|px)/g) ?? [];
    return terms.reduce((sum, term) => {
      const n = Number(term.replace(/\s|rem|px/g, ''));
      return sum + (term.endsWith('rem') ? n * rootPx : n);
    }, 0);
  };

  it('the navbar height is one token, and the four places below the navbar keep their lengths', () => {
    // the navbar's 3.5rem bar and its 1px rule, set once on :root
    expect(declsAt(':root', '--site-nav-h').map((decl) => [(decl.parent as Rule).selector, decl.value])).toEqual([
      [':root', 'calc(3.5rem + 1px)'],
    ]);
    const anchor = rule().nodes.find((node): node is Declaration => node.type === 'decl')?.value ?? '';
    const docsClip = must(declsAt('[data-route-layout="docs"]', '--bk-bars')[0], 'the docs page-fade clip').value;
    const tabClip = must(
      declsAt('active-view-transition-type(sol-tab)', '--sol-navbar')[0],
      'the Solutions clip',
    ).value;
    const line = must(declsAt('.blog-reading-line', 'top')[0], 'the reading line').value;
    for (const value of [anchor, docsClip, tabClip, line]) expect(value).toContain('var(--site-nav-h)');
    // at the default 16px root: the 72px anchor offset, the 104px docs clip, and the 57px Solutions clip and line
    expect([anchor, docsClip, tabClip, line].map((value) => px(value, 16))).toEqual([72, 104, 57, 57]);
    // and in rem where they were in rem: 4.5rem, 6.5rem, 3.5rem + 1px at a 20px root too
    expect([anchor, docsClip, tabClip].map((value) => px(value, 20))).toEqual([90, 130, 71]);
  });

  /** The rule's selector without whitespace (none of its parts uses a descendant combinator). */
  const selector = () => rule().selector.replace(/\s+/g, '');
  /** The selectors inside the rule's html:not(:has(...)). */
  const leftOut = () => {
    const inner = selector().match(/^html:not\(:has\((.*)\)\)$/)?.[1];
    return postcss.list.comma(must(inner, 'html:not(:has(...))'));
  };

  it('pads the page scroll by 4.5rem outside the docs layout', () => {
    expect(selector()).toMatch(/^html:not\(:has\(#nd-docs-layout,/);
  });

  it('leaves out every page whose targets carry a scroll margin class of their own, so no offset doubles', () => {
    // Padding and a target's own scroll margin add up (a blog heading's scroll-m-28 would land at 184px, not 112).
    const listed = new Set(leftOut());
    const missing = [...topMarginClasses()]
      .filter((name) => !INNER_SCROLLERS.has(name))
      .filter((name) => !listed.has(`.${name.replace(/[:[\]./]/g, '\\$&')}`));
    expect(missing, 'scroll margin classes in use that the anchor rule does not leave out').toEqual([]);
  });

  it('matches classes by name, never by substring: a [class*=] test in :has() on html costs a style pass', () => {
    // Measured on the dev server: html:not(:has([class*="scroll-m"])) made each class change cost 19ms on
    // /integrations and 1.4ms on /grants; a list of class names costs what the rule without it does (under 1us).
    expect(leftOut().filter((part) => /\[class/.test(part))).toEqual([]);
  });

  it('replaces the Integrations page fix, which would double the offset', () => {
    root.walkRules((found) => {
      if (!found.selector.includes('.integrations-page')) return;
      expect(declsOf(found).map((decl) => decl.prop)).not.toContain('scroll-margin-top');
      expect(declsOf(found).map((decl) => decl.prop)).not.toContain('scroll-padding-top');
    });
  });
});

describe('site-nav-tab-stops: one tab stop per navbar item', () => {
  type TriggerProps = { href?: string; tabIndex?: number; prefetch?: boolean; children?: unknown };
  type Menu = { url?: string; text?: unknown; items: { url?: string }[] };
  const trigger = (menu: unknown) => {
    const { text } = menu as Menu;
    return isValidElement(text) ? (text as ReactElement<TriggerProps>).props : null;
  };

  // [label, menu, the trigger's page, its prefetch: false where the menu turned it off, else Next's default]
  it.each<[string, unknown, string, boolean | undefined]>([
    ['Solutions', solutionsMenu, '/solutions', undefined],
    ['Developers', developersMenu, '/docs/primary-network', false],
    ['Console', consoleMenu, '/console', false],
    ['Explorer', explorerMenu, '/explorer/mainnet', undefined],
  ])(
    '%s: the link inside the trigger is out of the tab order and its page is in the menu',
    (label, menu, href, prefetch) => {
      // A menu url would make fumadocs wrap the text in a Link of its own, a second tab stop.
      expect((menu as Menu).url).toBeUndefined();
      expect(trigger(menu)).toMatchObject({ href, tabIndex: -1, children: label });
      expect(trigger(menu)?.prefetch).toBe(prefetch);
      expect((menu as Menu).items.map((item) => item.url)).toContain(href);
    },
  );

  it('Ecosystem keeps its link as a tab stop: /ecosystem is not in its menu', () => {
    expect(trigger(ecosystemMenu)).toMatchObject({ href: '/ecosystem', children: 'Ecosystem' });
    expect(trigger(ecosystemMenu)?.tabIndex).toBeUndefined();
    expect((ecosystemMenu as Menu).items.map((item) => item.url)).not.toContain('/ecosystem');
  });
});
