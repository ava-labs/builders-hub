import postcss, { type AtRule, type Root, type Rule } from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { block, declsOf, frame, globalCss, read, rulesFor as rulesIn, ungatedHover } from './helpers';

// The hero row's Team1 line reads the session; the visitor here has none.
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }));
// Next's App Router runs React's canary, which exports ViewTransition; the stable react these tests load does not.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  ViewTransition: ({ children }: { children?: import('react').ReactNode }) => children,
}));

import { CourseCertificateCard } from '@/components/academy/course/course-certificate-card';
import { CourseFacts } from '@/components/academy/course/course-header';
import { CourseModules } from '@/components/academy/course/course-modules';
import { START_BUTTON } from '@/components/academy/landing/course-marks';
import {
  cardInput,
  isInstant,
  showPath,
  type CardEvent,
  type CardInput,
  type PathState,
} from '@/components/academy/landing/course-state';
import { LandingHero } from '@/components/academy/landing/landing-hero';
import type { AcademyView } from '@/components/academy/landing/academy-views';
import { getCourseOutlines } from '@/lib/academy/course-outline';
import { permissionless, track, tree } from '../academy/helpers/tree-fixtures';

/**
 * Task 11 of the hub motion pass, the Academy landing: the learning path card grows out of the course it belongs to
 * and hands over at once (acad-path-card, variant a); the view toggle's red rule slides and the views cross-fade
 * (acad-view-switch, variant a); the course tiles and the Start buttons answer the pointer (acad-tile-hover).
 */
const CSS = 'app/global.css';
const TOKENS = 'components/academy/theme/academy-tokens.css';
const STATE = 'components/academy/landing/course-state.tsx';
const TOGGLE = 'components/academy/landing/view-toggle.tsx';
const LANDING = 'components/academy/landing/academy-landing.tsx';
const HERO = 'components/academy/landing/landing-hero.tsx';
const MARKS = 'components/academy/landing/course-marks.tsx';
const MODULES = 'components/academy/course/course-modules.tsx';
const CERTIFICATE = 'components/academy/course/course-certificate-card.tsx';
const FACTS = 'components/academy/course/course-header.tsx';
const TOUCHED = [CSS, TOKENS, STATE, TOGGLE, LANDING, HERO, MARKS, MODULES, CERTIFICATE, FACTS];
/** This task's blocks in global.css: the file is shared, so other lanes' text never decides this test. */
const BLOCKS = ['acad-view-switch', 'acad-path-card'];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const REDUCE = '(prefers-reduced-motion: reduce)';

const tokensCss = postcss.parse(read(TOKENS));

/** Selectors compare with double quotes, whichever quotes the file uses. */
const quotes = (selector: string) => selector.replace(/'/g, '"');

/** The rules of `root` whose selector list holds `selector`, outside any @media or inside the Reduce Motion one. */
function rulesFor(root: Root, selector: string, reduced = false): Rule[] {
  return rulesIn(selector, { root, anyQuotes: true })
    .filter(({ at }) => {
      const media = at.filter((around) => around.startsWith('@media'));
      return reduced ? media.join() === `@media ${REDUCE}` : media.length === 0;
    })
    .map(({ rule }) => rule);
}

/** The one rule for `selector`, or a failed assertion that names it. */
function ruleFor(root: Root, selector: string, reduced = false): Rule {
  const found = rulesFor(root, selector, reduced);
  expect(found, `${reduced ? 'reduced ' : ''}${selector}`).toHaveLength(1);
  return found[0];
}

const valueOf = (rule: Rule, prop: string) => declsOf(rule).find((decl) => decl.prop === prop)?.value;
const importantOf = (rule: Rule, prop: string) => declsOf(rule).find((decl) => decl.prop === prop)?.important ?? false;

const anchors = (html: string) =>
  html
    .split('<a ')
    .slice(1)
    .map((segment) => `<a ${segment.split('</a>')[0]}</a>`);
const svgsOf = (html: string) =>
  html
    .split('<svg ')
    .slice(1)
    .map((segment) => `<svg ${segment}`);
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? '').split(' ');

describe('every file this task touches', () => {
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

  it('the Academy tokens file gates every hover', () => {
    expect(ungatedHover(read(TOKENS))).toBe(0);
  });
});

describe('acad-path-card: the learning path card grows out of its course', () => {
  const card = postcss.parse(block('acad-path-card'));
  const CARD = "[data-academy='landing'][data-path-card]";
  const OPEN = `${CARD}[data-state='open']`;
  const CLOSED = `${CARD}[data-state='closed']`;
  const INSTANT = `${CARD}[data-instant]`;

  it('unfolds from the side of its course: the transform origin Radix sets from the trigger', () => {
    expect(valueOf(ruleFor(card, CARD), 'transform-origin')).toBe('var(--radix-hover-card-content-transform-origin)');
  });

  it('enters in 160ms on the strong ease-out, from 4px towards its course and scale 0.97', () => {
    expect(valueOf(ruleFor(card, OPEN), 'animation')).toBe('acad-path-in 160ms var(--ease-out)');
    expect(frame('acad-path-in', 'from', { root: card })).toEqual({
      opacity: '0',
      transform: 'translateX(var(--acad-path-dx, -4px)) scale(0.97)',
    });
    // On the right of its course it comes from the left; flipped to the left, from the right.
    expect(valueOf(ruleFor(card, `${CARD}[data-side='left']`), '--acad-path-dx')).toBe('4px');
  });

  it('leaves faster than it came: 100ms to opacity 0 and scale 0.97, held until Radix unmounts it', () => {
    expect(valueOf(ruleFor(card, CLOSED), 'animation')).toBe('acad-path-out 100ms var(--ease-out) forwards');
    expect(frame('acad-path-out', 'to', { root: card })).toEqual({ opacity: '0', transform: 'scale(0.97)' });
  });

  it('an instant card shows and goes at once: data-instant drops the animation, after the state rules', () => {
    const instant = ruleFor(card, INSTANT);
    expect(valueOf(instant, 'animation')).toBe('none');
    const order = card.nodes.filter((node): node is Rule => node.type === 'rule').map((rule) => quotes(rule.selector));
    expect(order.indexOf(quotes(INSTANT))).toBeGreaterThan(order.indexOf(quotes(OPEN)));
    expect(order.indexOf(quotes(INSTANT))).toBeGreaterThan(order.indexOf(quotes(CLOSED)));
  });

  it('under Reduce Motion only fades, 120ms in and 80ms out, past the site policy, and an instant card never fades', () => {
    const open = ruleFor(card, OPEN, true);
    const closed = ruleFor(card, CLOSED, true);
    const instant = ruleFor(card, INSTANT, true);
    // The explorer's opacity fades (exp-view-switch): different names in and out, so Radix Presence waits for the exit.
    // Presence ends an exit on the end or cancel of any animation whose name the exit's contains, so the entry's name
    // must not sit inside the exit's: an Escape during the entrance cancels it (as vs-fade, it cut the exit short).
    expect([valueOf(open, 'animation-name'), valueOf(open, 'animation-duration')]).toEqual(['vs-fade-in', '120ms']);
    expect([valueOf(closed, 'animation-name'), valueOf(closed, 'animation-duration')]).toEqual(['vs-fade-out', '80ms']);
    for (const [entry, exit] of [
      [valueOf(open, 'animation-name'), valueOf(closed, 'animation-name')],
      [
        valueOf(ruleFor(card, OPEN), 'animation')?.split(' ')[0],
        valueOf(ruleFor(card, CLOSED), 'animation')?.split(' ')[0],
      ],
    ]) {
      expect(exit, `${exit} holds ${entry}`).not.toContain(entry);
    }
    // The policy runs every animation in 1ms with !important; a more specific !important keeps the duration. The name
    // stays normal, so Radix's inline animation: none still holds the fade until the card is placed.
    for (const rule of [open, closed]) {
      expect(importantOf(rule, 'animation-duration'), rule.selector).toBe(true);
      expect(importantOf(rule, 'animation-name'), rule.selector).toBe(false);
    }
    expect(valueOf(instant, 'animation-name')).toBe('none');
    const reduced = card.nodes.find((node): node is AtRule => node.type === 'atrule' && node.params === REDUCE);
    const order = (reduced?.nodes ?? [])
      .filter((node): node is Rule => node.type === 'rule')
      .map((rule) => quotes(rule.selector));
    expect(order.indexOf(quotes(INSTANT))).toBeGreaterThan(
      Math.max(order.indexOf(quotes(OPEN)), order.indexOf(quotes(CLOSED))),
    );
    expect(frame('vs-fade-in', 'from')).toEqual({ opacity: '0' });
    expect(frame('vs-fade-out', 'to')).toEqual({ opacity: '0' });
  });

  it("defines only the keyframes it needs: the moving entrance and exit; the plain fades are the explorer's", () => {
    const names: string[] = [];
    card.walkAtRules('keyframes', (keyframes) => {
      names.push(keyframes.params);
    });
    expect(names).toEqual(['acad-path-in', 'acad-path-out']);
  });

  it('opens at once while another card shows, after 150ms from none, and closes after 200ms', () => {
    const src = read(STATE);
    expect(src).toContain('openDelay={active === null ? 150 : 0}');
    expect(src).toContain('closeDelay={200}');
  });

  it('wires the card to that decision: data-instant from isInstant, and an open decided once, as the card opens', () => {
    const src = read(STATE);
    expect(src).toContain('data-path-card=""');
    expect(src).toContain("data-instant={isInstant(open, card, { active, handoff }) ? '' : undefined}");
    expect(src).toContain("if (next && !open) dispatch({ type: 'open' });");
  });

  it('the course link tells the card what reached it: focus with its keyboard ring, or a pointer entering', () => {
    // cardInput reads these two events; without them every card would open as if a pointer opened it
    const link = read(STATE).match(/<Link\b[^>]*data-course-id=\{id\}[\s\S]*?>\s*\{children\}\s*<\/Link>/)?.[0] ?? '';
    expect(link, 'the course link in CourseLink').not.toBe('');
    expect(link).toContain(
      "onFocus={(event) => dispatch({ type: 'focus', visible: event.currentTarget.matches(':focus-visible') })}",
    );
    expect(link).toContain("onPointerEnter={() => dispatch({ type: 'pointer' })}");
  });
});

describe('cardInput and isInstant: a card decides once, as it opens, whether it moves', () => {
  const REST: CardInput = { keyboard: false, openedByKeyboard: false };
  const NONE: PathState = { active: null, handoff: false };
  /** Another course's card shows, opened with no card before it. */
  const SHOWN: PathState = { active: 'erc20-bridge', handoff: false };
  const after = (state: CardInput, ...events: CardEvent[]) => events.reduce(cardInput, state);
  const KEYBOARD: CardEvent = { type: 'focus', visible: true };
  const POINTER: CardEvent = { type: 'pointer' };
  const OPEN: CardEvent = { type: 'open' };

  it('opened from the keyboard it shows at once, and a pointer that then enters its course replays nothing', () => {
    const opened = after(REST, KEYBOARD, OPEN);
    expect(isInstant(true, opened, SHOWN)).toBe(true);
    const pointed = after(opened, POINTER);
    expect(pointed.keyboard).toBe(false);
    expect(isInstant(true, pointed, SHOWN)).toBe(true);
    // A keyboard-opened surface also goes at once.
    expect(isInstant(false, pointed, NONE)).toBe(true);
  });

  it('opened by a pointer it moves, and focus, then the pointer leaving and coming back, replays nothing', () => {
    const opened = after(REST, POINTER, OPEN);
    expect(isInstant(true, opened, SHOWN)).toBe(false);
    const later = after(opened, KEYBOARD, POINTER, KEYBOARD);
    expect(isInstant(true, later, SHOWN)).toBe(false);
    // It leaves with its exit when nothing takes its place.
    expect(isInstant(false, later, NONE)).toBe(false);
  });

  it('mouse focus, which shows no ring, is not the keyboard', () => {
    expect(isInstant(true, after(REST, { type: 'focus', visible: false }, OPEN), SHOWN)).toBe(false);
  });

  it('the next open decides again, from the input then', () => {
    const keyboardOpen = after(REST, KEYBOARD, OPEN);
    expect(isInstant(true, after(keyboardOpen, POINTER, OPEN), SHOWN)).toBe(false);
    expect(isInstant(true, after(after(REST, POINTER, OPEN), KEYBOARD, OPEN), SHOWN)).toBe(true);
  });

  it('a hand-off is instant for the card that takes over and for the card it replaces', () => {
    const pointerOpen = after(REST, POINTER, OPEN);
    expect(isInstant(true, pointerOpen, { active: 'erc20-bridge', handoff: true })).toBe(true);
    // Closing while another course's card shows: that card took its place.
    expect(isInstant(false, pointerOpen, SHOWN)).toBe(true);
  });

  it('keeps the same memory when an event changes nothing, so the course does not render again', () => {
    expect(cardInput(REST, POINTER)).toBe(REST);
    expect(cardInput(REST, OPEN)).toBe(REST);
    const keyboard = cardInput(REST, KEYBOARD);
    expect(cardInput(keyboard, KEYBOARD)).toBe(keyboard);
  });
});

describe('showPath: one card at a time, handed over at once', () => {
  const NONE: PathState = { active: null, handoff: false };

  it('a first card is no hand-off: it waits for the open delay and enters', () => {
    expect(showPath(NONE, 'erc20-bridge')).toEqual({ active: 'erc20-bridge', handoff: false });
  });

  it('a card that replaces an open card is a hand-off, and so is the next one', () => {
    const first = showPath(NONE, 'interchain-messaging');
    const second = showPath(first, 'erc20-bridge');
    expect(second).toEqual({ active: 'erc20-bridge', handoff: true });
    expect(showPath(second, 'native-token-bridge')).toEqual({ active: 'native-token-bridge', handoff: true });
  });

  it('closing the last card is no hand-off, so it leaves with its exit', () => {
    expect(showPath({ active: 'erc20-bridge', handoff: true }, null)).toEqual(NONE);
  });

  it('keeps the same state when nothing changes, so the landing does not render again', () => {
    const open: PathState = { active: 'erc20-bridge', handoff: true };
    expect(showPath(open, 'erc20-bridge')).toBe(open);
    expect(showPath(NONE, null)).toBe(NONE);
  });
});

describe('acad-view-switch: the red rule slides and the views cross-fade', () => {
  const views = postcss.parse(block('acad-view-switch'));

  it('the toggle links tag their navigation with the Explorer view-switch type and keep the scroll', () => {
    const src = read(TOGGLE);
    expect(src).toMatch(/import \{ VIEW_SWITCH \} from ['"]@\/components\/explorer-v2\/view-switch['"];/);
    expect(src).toContain('transitionTypes={VIEW_SWITCH}');
    expect(src).toContain('scroll={false}');
    expect(src).toContain('key={option.id}');
  });

  it('a fading part fades on that type only; any other navigation swaps it at once', () => {
    const src = read(TOGGLE);
    // ViewTransition comes from react, as in components/explorer-v2/view-switch.tsx; the tests stub it.
    expect(src).not.toContain('Partial<typeof React>');
    expect(src).toContain("enter={{ 'view-switch': 'acad-view-in', default: 'none' }}");
    expect(src).toContain("exit={{ 'view-switch': 'acad-view-out', default: 'none' }}");
    expect(src).toContain('default="none"');
  });

  it('each view is its own part, keyed by the view', () => {
    expect(read(LANDING)).toMatch(
      /<ViewFade key=\{view\}>\s*<div className=\{view === 'overview' \? 'pt-1' : 'pt-\[22px\]'\}>\s*<LandingView /,
    );
  });

  it('keeps focus on the toggle: no fading part holds the toggle, so its links are never mounted again', () => {
    for (const path of [HERO, LANDING]) {
      const parts = read(path)
        .split('<ViewFade')
        .slice(1)
        .map((part) => part.split('</ViewFade>')[0]);
      expect(parts.length, path).toBe(1);
      parts.forEach((part) => expect(part, path).not.toMatch(/<ViewToggle|<LandingHero/));
    }
  });

  it('the hero row is keyed by its content: Tree and Stages share one key and one row, Overview has its own', () => {
    const src = read(HERO);
    expect(src).toContain("const withStart = view !== 'overview';");
    expect(src).toContain("<ViewFade key={withStart ? 'start' : 'facts'}>");
    // The row's content follows the same condition as its key: the start button and the Team1 line.
    expect(src).toContain('{withStart ? (');
    expect(src).toContain('{withStart ? <Team1Line className="ml-auto max-md:ml-0" /> : null}');
    const row = (view: AcademyView) => {
      const html = renderToStaticMarkup(
        createElement(LandingHero, { view, facts: '13 courses · 377 lessons · 26 hours' }),
      );
      const start = html.indexOf('<div class="mt-5 ');
      return html.slice(start, html.indexOf('</div>', start));
    };
    expect(row('tree')).not.toBe('');
    expect(row('tree')).toBe(row('stages'));
    expect(row('overview')).not.toBe(row('tree'));
  });

  it('the old view fades out in 140ms and the new one in over 220ms after 60ms, both on the strong ease-out', () => {
    expect(valueOf(ruleFor(views, '::view-transition-old(.acad-view-out)'), 'animation')).toBe(
      '140ms var(--ease-out) both vs-fade-out',
    );
    expect(valueOf(ruleFor(views, '::view-transition-new(.acad-view-in)'), 'animation')).toBe(
      '220ms var(--ease-out) 60ms both vs-fade-in',
    );
    // The explorer's forward fades (exp-view-switch); this block defines no keyframes of its own.
    expect(frame('vs-fade-out', 'to')).toEqual({ opacity: '0' });
    expect(frame('vs-fade-in', 'from')).toEqual({ opacity: '0' });
    views.walkAtRules('keyframes', (keyframes) => expect.unreachable(`@keyframes ${keyframes.params}`));
    // Played in reverse, a curve runs backwards: the strong ease-out would leave like an ease-in.
    views.walkDecls('animation', (decl) => expect(decl.value).not.toMatch(/\breverse\b/));
  });

  it('the landing never cross-fades as a whole: Back and Forward between views start a transition with no type', () => {
    // Browser back and forward between views carry no view-switch type; the page's root must not take the browser's
    // default 250ms cross-fade then. The hold keys on the landing's own view switch, not on every Academy root.
    for (const image of ['old', 'new']) {
      const root = ruleFor(views, `:root:has([data-view-switch="academy"])::view-transition-${image}(root)`);
      expect(valueOf(root, 'animation'), image).toBe('none');
    }
    views.walkRules((rule) => expect(rule.selector).not.toContain('[data-academy'));
  });

  it('the block says when React starts a transition here, as measured: the typed switch, and Back or Forward between views', () => {
    // measured on the dev server: a link into the landing, or out to a course, starts none; mounting alone does not
    const comment = (
      globalCss.nodes.find((node) => node.type === 'comment' && node.text.startsWith('acad-view-switch:')) as
        | { text: string }
        | undefined
    )?.text.replace(/\s+/g, ' ');
    expect(comment).toContain('on the typed switch and on browser Back and Forward between views');
  });

  it('only the landing view switch carries the attribute the root hold keys on', () => {
    const html = renderToStaticMarkup(createElement(LandingHero, { view: 'tree', facts: '13 courses' }));
    expect(html).toMatch(/<div role="navigation" aria-label="Course views" [^>]*data-view-switch="academy"/);
    expect(html.match(/data-view-switch=/g)).toHaveLength(1);
    expect(read(STATE)).not.toContain('data-view-switch');
    expect(read(LANDING)).not.toContain('data-view-switch');
  });

  it('under Reduce Motion the parts cross-fade in 150ms', () => {
    expect(valueOf(ruleFor(views, '::view-transition-old(.acad-view-out)', true), 'animation')).toBe(
      '150ms var(--ease-out) both vs-fade-out',
    );
    expect(valueOf(ruleFor(views, '::view-transition-new(.acad-view-in)', true), 'animation')).toBe(
      '150ms var(--ease-out) both vs-fade-in',
    );
  });

  it('one 2px red rule on the current link box slides by transform only, in 250ms on the in-out curve', () => {
    const line = ruleFor(tokensCss, '[data-academy] [data-view-line]::after');
    // At rest it sits on the link's own box, so it paints the pixels the link's border painted.
    expect([valueOf(line, 'left'), valueOf(line, 'width')]).toEqual(['var(--view-line-x)', 'var(--view-line-w)']);
    expect(valueOf(line, 'transform')).toBe('var(--view-line-from)');
    expect(valueOf(line, 'transform-origin')).toBe('0 0');
    expect(valueOf(line, 'height')).toBe('2px');
    expect(valueOf(line, 'background-color')).toBe('var(--ac-red)');
    expect(valueOf(line, 'transition')).toBe('transform 250ms var(--ease-in-out)');
    expect(valueOf(ruleFor(tokensCss, "[data-academy] [data-view-line='still']::after"), 'transition')).toBe('none');
    // Once the list draws the rule, the current link's own border clears.
    expect(
      valueOf(ruleFor(tokensCss, "[data-academy] [data-view-line] > a[aria-current='page']"), 'border-bottom-color'),
    ).toBe('transparent');
  });

  it('under Reduce Motion the rule does not travel: the site policy transitions no transform', () => {
    const reducer = rulesFor(globalCss, '*::after', true).find((rule) => valueOf(rule, 'transition-property'));
    const props = (reducer && valueOf(reducer, 'transition-property'))?.split(',').map((prop) => prop.trim()) ?? [];
    expect(props).toContain('opacity');
    expect(props).not.toContain('transform');
    expect(importantOf(reducer as Rule, 'transition-property')).toBe(true);
  });

  it('the toggle draws the rule still at first and on a resize, and slides it from where it showed on a view change', () => {
    const src = read(TOGGLE);
    expect(src).toContain("new ResizeObserver(() => place('still'))");
    expect(src).toContain("shown.current === null || shown.current === view ? 'still' : 'travel'");
    // The slide starts from the box the rule showed on, mid-slide too, as translateX and scaleX.
    expect(src).toContain('translateX(${from.x - x}px) scaleX(${from.width / box.width})');
    expect(src).toContain("getComputedStyle(list, '::after').transform");
    expect(src).toContain("list.setAttribute('data-view-line', 'still');");
    expect(src).toContain("list.setAttribute('data-view-line', 'travel');");
  });
});

describe('acad-tile-hover: the course tiles and the Start buttons answer the pointer', () => {
  const COLOURS = 'transition-[border-color,background-color,color,box-shadow,scale]';
  const TIMING = ['duration-[150ms,150ms,150ms,150ms,160ms]', 'ease-[ease,ease,ease,ease,var(--ease-out)]'];
  const NO_PRESS_REDUCED = 'motion-reduce:active:scale-100';
  const [outline] = getCourseOutlines(tree(track('Avalanche L1', permissionless)));
  const modules = renderToStaticMarkup(createElement(CourseModules, { outline }));
  const certificate = renderToStaticMarkup(
    createElement(CourseCertificateCard, {
      academy: 'Avalanche Academy',
      courseTitle: 'Permissionless L1s',
      href: '/academy/avalanche-l1/permissionless-l1s/certificate',
      label: 'Course Completion Certificate',
      afterModules: true,
    }),
  );
  const facts = renderToStaticMarkup(createElement(CourseFacts, { outline, duration: '2 hours' }));
  const tiles = [...anchors(modules), ...anchors(certificate)];

  it('the module tiles and the certificate card ease their colours in 150ms and press to 0.99 in 160ms', () => {
    expect(tiles.length).toBeGreaterThan(1);
    for (const tile of tiles) {
      const classes = classesOf(tile);
      expect(classes).toEqual(
        expect.arrayContaining(['group', COLOURS, ...TIMING, 'active:scale-[0.99]', NO_PRESS_REDUCED]),
      );
      expect(classes.filter((name) => name.startsWith('transition-'))).toEqual([COLOURS]);
    }
  });

  it('their arrows lean 2px in 180ms on the strong ease-out, on a pointer that hovers and never under Reduce Motion', () => {
    for (const tile of tiles) {
      const arrows = svgsOf(tile).filter((svg) => classesOf(svg).includes('lucide-arrow-right'));
      expect(arrows, tile.slice(0, 80)).toHaveLength(1);
      expect(classesOf(arrows[0])).toEqual(
        expect.arrayContaining([
          'transition-[translate]',
          'duration-180',
          'ease-out',
          'motion-safe:group-hover:translate-x-0.5',
        ]),
      );
    }
  });

  it('the ink Start buttons ease their colours in 150ms and press to 0.97 in 160ms', () => {
    const start = anchors(facts).find((link) => link.includes('Start course')) ?? '';
    for (const classes of [START_BUTTON.split(/\s+/), classesOf(start)]) {
      expect(classes).toEqual(expect.arrayContaining([COLOURS, ...TIMING, 'active:scale-[0.97]', NO_PRESS_REDUCED]));
      expect(classes.filter((name) => name.startsWith('transition-'))).toEqual([COLOURS]);
    }
  });
});
