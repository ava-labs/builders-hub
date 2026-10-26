import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { codeLines, contrast, cssBlock, declaration, outranks, read, specificity, ungatedHover } from './helpers';

/**
 * Task 15 of the hub motion pass, the explorer subnav and live boards: exp-tab-answer (a), exp-chain-menu (a),
 * exp-belts-reduced (a), exp-belt-hold (a) and exp-live-breathe, plus extra X4 (the ages and state labels in the live
 * board rows read at 4.5:1). Specs: .scratch/hub-motion/proposals/70-explorer.js.
 */
const SUBNAV = 'components/explorer-v2/ExplorerSubnav.tsx';
const TAB_ANSWER = 'components/explorer-v2/tab-answer.tsx';
const BELT = 'components/explorer-v2/evm/belt.tsx';
const BOARDS = 'components/explorer-v2/evm/LiveBoards.tsx';
const OVERVIEW = 'components/explorer-v2/network/overview-live.tsx';
const UI = 'components/explorer-v2/ui.tsx';
const MOTION = 'components/explorer-v2/motion.ts';
const QUERY_TAB = 'components/explorer-v2/evm/QueryTab.tsx';
const CSS = 'app/global.css';
const TOUCHED = [SUBNAV, TAB_ANSWER, BELT, BOARDS, OVERVIEW, UI, MOTION, QUERY_TAB];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;

describe('contrast helper', () => {
  it('matches the WCAG figures the board measured', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    // production today: zinc-400 on white 2.62:1, zinc-500 on zinc-950 4.12:1 (curation.json, exempt)
    expect(contrast('#9f9fa9', '#ffffff')).toBeCloseTo(2.62, 2);
    expect(contrast('#71717b', '#09090b')).toBeCloseTo(4.12, 2);
  });
});

describe('exp-tab-answer: the section tab answers the click before the page arrives', () => {
  const subnav = read(SUBNAV);
  const answer = read(TAB_ANSWER);

  it('each tab reads its own Link with useLinkStatus, and the rail lights the clicked tab until its page lands', () => {
    const mark = declaration(answer, 'TabMark');
    expect(mark).toContain('useLinkStatus()');
    // the pending href holds the tab lit; a link that stops pending lets go only of its own href
    expect(answer).toMatch(/setPendingHref\(\(cur\) => \(pending \? href : cur === href \? null : cur\)\)/);
    expect(answer).toMatch(/pendingHref \? tab\.href === pendingHref : tab\.isActive\(pathname\)/);
    // the subnav lights tabs through it, and the mark rides inside every tab, the Query tab's own Link included
    expect(subnav).toMatch(/const \{ isLit, onPending, barRef \} = useTabAnswer\(tabs, pathname\);/);
    expect(subnav).toMatch(/\{tabText\(tab\)\}\s*\{mark\}\s*<\/Link>/);
    expect(subnav).toMatch(/bar=\{mark\}/);
  });

  it('aria-current stays on the page on screen until the next one lands, and the lit tab carries data-lit', () => {
    expect(subnav).toMatch(/const current = tab\.isActive\(pathname\);/);
    expect(subnav).toMatch(/aria-current=\{current \? "page" : undefined\}\s*data-lit=\{lit \|\| undefined\}/);
    expect(subnav).not.toMatch(/aria-current=\{lit \?/);
    // the Query tab's two Links (a phone's plain link, a desk's popover anchor) mark the same way
    expect(subnav).toMatch(/current=\{current\}\s*lit=\{lit\}/);
    const queryTab = read(QUERY_TAB);
    expect(queryTab.match(/aria-current=\{current \? "page" : undefined\}/g)).toHaveLength(2);
    expect(queryTab.match(/data-lit=\{lit \|\| undefined\}/g)).toHaveLength(2);
    expect(queryTab).not.toMatch(/\bactive\b/);
  });

  it('one bar slides by transform only, translateX and scaleX in 180ms on the explorer curve, and not under Reduce Motion', () => {
    expect(answer).toMatch(/import \{ EASE_CSS \} from ['"]@\/components\/explorer-v2\/motion['"];/);
    const start = answer.indexOf('bar.animate(');
    const slide = answer.slice(start, answer.indexOf(');', start));
    expect(slide).toMatch(
      /transform: `translateX\(\$\{from\.left - to\.left\}px\) scaleX\(\$\{from\.width \/ to\.width\}\)`/,
    );
    expect(slide).toMatch(/\{ transform: ['"]none['"] \}\],\s*\{ duration: 180, easing: EASE_CSS \}/);
    // the slide never animates layout
    expect(slide).not.toMatch(/\b(?:left|width|marginLeft)\s*:/);
    expect(answer).toMatch(/matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\) return;/);
    expect(declaration(answer, 'TabMark')).toMatch(/className="absolute inset-x-0 bottom-0 h-\[2px\] origin-left /);
  });

  it('the rail keeps the two hooks the stylesheet block names: the subnav attribute and the rail label', () => {
    expect(subnav).toContain('aria-label="Explorer sections"');
    expect(subnav).toContain('data-explorer-subnav');
  });

  it('the site underline under the current link is off in the rail, so no second bar fades under the old tab', () => {
    const block = cssBlock('exp-tab-answer');
    expect(block).not.toBe('');
    const rules: Rule[] = [];
    postcss.parse(block).walkRules((rule) => {
      rules.push(rule);
    });
    expect(rules).toHaveLength(3);
    const [rule] = rules;
    expect(rule.selector).toContain('nav[aria-label="Explorer sections"] a[aria-current="page"]');
    const decls = rule.nodes.filter((node): node is Declaration => node.type === 'decl');
    expect(decls.map((d) => [d.prop, d.value, d.important])).toEqual([['box-shadow', 'none', true]]);
    // it outranks every site rule that draws the underline, the dark hover one included, wherever it sits
    const site: string[] = [];
    postcss.parse(read(CSS)).walkRules((r) => {
      if (r.nodes.some((n) => n.type === 'decl' && n.prop === 'box-shadow' && /inset 0 -2px/.test(n.value))) {
        site.push(...r.selectors.filter((s) => /^(?:\.dark )?nav a\[aria-current="page"\]/.test(s)));
      }
    });
    expect(site.length).toBeGreaterThanOrEqual(4);
    for (const selector of site)
      expect(outranks(specificity(rule.selector), specificity(selector)), selector).toBe(true);
    expect(ungatedHover(block)).toBe(0);
  });

  it('while the next page is on its way, the current link that is not lit takes the quiet ink, so one tab reads dark', () => {
    const rules: Rule[] = [];
    postcss.parse(cssBlock('exp-tab-answer')).walkRules((rule) => {
      rules.push(rule);
    });
    const quiet = rules.slice(1);
    const RAIL = '[data-explorer-subnav] nav[aria-label="Explorer sections"] a[aria-current="page"]:not([data-lit])';
    expect(quiet.map((r) => r.selector)).toEqual([`:root ${RAIL}`, `.dark ${RAIL}`]);
    const decls = quiet.map((r) =>
      r.nodes.filter((node): node is Declaration => node.type === 'decl').map((d) => [d.prop, d.value, d.important]),
    );
    // the rail's own quiet ink: the classes a tab that is not lit wears (zinc-400, dark zinc-500)
    expect(decls).toEqual([[['color', 'var(--color-zinc-400)', true]], [['color', 'var(--color-zinc-500)', true]]]);
    expect(read(SUBNAV)).toContain('"text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"');
    // they outrank every site rule that inks the current link, light and dark, hover included
    const site: string[] = [];
    postcss.parse(read(CSS)).walkRules((r) => {
      if (r.nodes.some((n) => n.type === 'decl' && n.prop === 'color')) {
        site.push(...r.selectors.filter((s) => /^(?:\.dark )?nav a\[aria-current="page"\]/.test(s)));
      }
    });
    expect(site.length).toBeGreaterThanOrEqual(2);
    for (const r of quiet) {
      for (const selector of site)
        expect(outranks(specificity(r.selector), specificity(selector)), selector).toBe(true);
    }
  });
});

describe('exp-chain-menu: the chain menu opens out of its button', () => {
  const subnav = read(SUBNAV);
  const variants = declaration(subnav, 'menuMotion');

  it('grows from the top-left corner: opacity and scale 0.96 to 1 in 160ms on the strong ease-out', () => {
    expect(subnav).toMatch(/import \{ EASE_OUT \} from ['"]@\/lib\/motion-curves['"];/);
    expect(subnav).toMatch(/<AnimatePresence custom=\{keyed\}>/);
    expect(subnav).toMatch(/className="absolute left-0 top-full z-50 [^"]*origin-top-left/);
    expect(variants).toMatch(/closed: \{ opacity: 0, scale: still \? 1 : 0\.96 \}/);
    expect(variants).toMatch(
      /open: \{ opacity: 1, scale: 1, transition: \{ duration: still \? 0\.12 : 0\.16, ease: EASE_OUT \} \}/,
    );
    expect(subnav).not.toMatch(/scale: 0[,\s}]/);
  });

  it('leaves faster: opacity to 0 and scale to 0.98 in 110ms', () => {
    expect(variants).toMatch(/scale: still \? 1 : 0\.98/);
    expect(variants).toMatch(/duration: keyed \? 0 : still \? 0\.1 : 0\.11, ease: EASE_OUT/);
    expect(subnav).toMatch(/exit="gone"/);
  });

  it('opened or shut from the keyboard it comes and goes at once', () => {
    // Enter and Space click the button with no detail; Escape shuts at once; a pointer outside shuts with the fade
    expect(subnav).toMatch(/setKeyed\(e\.detail === 0\);\s*setOpen\(\(v\) => !v\);/);
    expect(subnav).toMatch(/if \(e\.key === "Escape"\) shut\(true\);/);
    expect(subnav).toMatch(/contains\(e\.target as Node\)\) shut\(false\);/);
    expect(subnav).toMatch(/initial=\{keyed \? false : "closed"\}/);
  });

  it('under Reduce Motion only the opacity moves: 120ms in, 100ms out', () => {
    expect(subnav).toMatch(/const still = useReducedMotion\(\);/);
    expect(subnav).toMatch(/variants=\{menuMotion\(!!still\)\}/);
  });
});

describe('exp-belts-reduced: the live boards stop sliding under Reduce Motion', () => {
  const row = declaration(read(BELT), 'MotionRow');

  it('a newcomer fades in where it lands, opacity only in 200ms ease, and the rows below take their places at once', () => {
    expect(row).toContain('const still = useReducedMotion();');
    // a plain row with a CSS fade from @starting-style: no framer element, so no layout slide and no y, and no WAAPI
    // hand-off for the stylesheet's reduced-motion opacity transition to replay from 0 (a second fade, measured)
    const reduced =
      /if \(still\) \{\s*return <div className=\{cn\(cls, animateIn && "([^"]+)"\)\}>\{children\}<\/div>;\s*\}/.exec(
        row,
      );
    expect(reduced, 'the reduced branch').not.toBeNull();
    expect(reduced?.[1].split(' ').sort()).toEqual([
      'duration-200!',
      'ease-[ease]',
      'starting:opacity-0',
      'transition-opacity',
    ]);
    // the transition outranks the reducer's !important 150ms only through the layered !important utility
    expect(cssBlock('site-reduced-motion-policy')).toMatch(/transition-duration: 150ms !important;/);
  });

  it('with motion allowed the belt is unchanged: from a row above, 500ms on the tape curve', () => {
    const motionPath = row.slice(row.indexOf('<motion.div'));
    expect(motionPath).toMatch(/layout="position"/);
    expect(motionPath).toMatch(/initial=\{animateIn \? \{ y: -ROW_H, opacity: 0 \} : false\}/);
    expect(motionPath).toMatch(/animate=\{\{ y: 0, opacity: 1 \}\}/);
    expect(motionPath).toMatch(/transition=\{\{ duration: 0\.5, ease: EASE \}\}/);
    // the belt's own tape curve, declared in the file: its value is the belt's, not this test's
    expect(read(BELT)).toMatch(/^const EASE = /m);
  });

  it('the overview boards need no MotionConfig of their own: the app-wide one and MotionRow cover them', () => {
    // the app-wide MotionConfig is Task 1's, pinned in foundation.test.ts
    expect(read(OVERVIEW)).not.toContain('MotionConfig');
  });
});

describe('exp-belt-hold (a): the live boards hold still for the keyboard too', () => {
  const hold = declaration(read(BELT), 'useHold');

  it('a board holds while the pointer is over it or focus is inside it, and lets go once both have left', () => {
    expect(hold).toMatch(/onMouseEnter: \(\) => setHover\(true\)/);
    expect(hold).toMatch(/onMouseLeave: \(\) => setHover\(false\)/);
    // only keyboard focus holds: a row a pointer focused (a click, a cmd-click that opens a tab) holds nothing once
    // the pointer has left
    expect(hold).toMatch(
      /onFocus: \(e: React\.FocusEvent<HTMLDivElement>\) => setFocus\(e\.target\.matches\(":focus-visible"\)\)/,
    );
    // focus moving between the board's own rows keeps the hold (focus-within)
    expect(hold).toMatch(/if \(!e\.currentTarget\.contains\(e\.relatedTarget\)\) setFocus\(false\);/);
    expect(hold).toMatch(/return \[hover \|\| focus, handlers\] as const;/);
  });

  it('every live board uses it: the C-Chain boards and the overview boards', () => {
    for (const file of [BOARDS, OVERVIEW]) {
      const code = read(file);
      expect(code.match(/const \[held, hold\] = useHold\(\);/g), file).toHaveLength(2);
      expect(code.match(/<Board divide=\{false\}[^>]*\{\.\.\.hold\}>/g), file).toHaveLength(2);
      expect(code).not.toMatch(/onMouseEnter=\{\(\) => setHover/);
    }
    expect(read(BOARDS)).toMatch(/useFreeze\(\{ rows: incomingRows, tip, executedHeight \}, held\)/);
    expect(read(BOARDS).match(/paused: held,/g)).toHaveLength(1);
    expect(read(OVERVIEW).match(/paused: held,/g)).toHaveLength(2);
    // the board passes the focus handlers through
    expect(declaration(read(UI), 'Board')).toMatch(/"onMouseEnter" \| "onMouseLeave" \| "onFocus" \| "onBlur"/);
  });
});

describe('exp-live-breathe: live dots breathe in step instead of pinging', () => {
  const ui = read(UI);
  const motion = read(MOTION);

  it('LiveDot and LiveTag are one solid dot on root-breathe 2.4s ease-in-out, with no ping ring', () => {
    expect(motion).toMatch(/export const BREATHE = "animate-\[root-breathe_2\.4s_ease-in-out_infinite\]";/);
    for (const name of ['LiveDot', 'LiveTag']) {
      const code = declaration(ui, name);
      expect(code, name).not.toContain('animate-ping');
      expect(code, name).toContain('BREATHE');
      expect(code, name).toMatch(/const ref = useInStep<HTMLSpanElement>\(\);/);
    }
    // the state-root dots breathe on the same class, so the two stay in step by construction
    expect(read(BOARDS)).toContain('BREATHE');
    expect(read(BOARDS)).not.toContain('animate-[root-breathe');
    // the keyframes: opacity 1 to 0.3 and back
    const frames: Record<string, string> = {};
    postcss.parse(read(CSS)).walkAtRules('keyframes', (atRule) => {
      if (atRule.params !== 'root-breathe') return;
      atRule.walkDecls((decl) => {
        frames[(decl.parent as Rule).selector] = `${decl.prop}: ${decl.value}`;
      });
    });
    expect(frames).toEqual({ '0%, 100%': 'opacity: 1', '50%': 'opacity: 0.3' });
  });

  it('every breathing mark starts at the document timeline origin, so they all keep step, and rests off screen', () => {
    const hook = declaration(motion, 'useInStep');
    expect(hook).toContain('new IntersectionObserver(');
    // a queued pair of crossings (out and back in before the callback runs) resolves to the latest one
    expect(hook).toMatch(/const entry = entries\[entries\.length - 1\];/);
    expect(hook).not.toMatch(/\(\[entry\]\)/);
    expect(hook).toMatch(/if \(!entry\.isIntersecting\) a\.pause\(\);/);
    expect(hook).toMatch(/a\.play\(\);\s*a\.startTime = 0;/);
    // a still reader needs nothing: the stylesheet's reduced-motion rule ends the loop on its last frame
    expect(hook).toContain('matchMedia("(prefers-reduced-motion: reduce)").matches');
  });
});

describe('X4: the ages and state labels in the live board rows read at 4.5:1 in light and dark', () => {
  it('zinc-500 on white and zinc-400 on zinc-950 clear 4.5:1', () => {
    expect(contrast('#71717b', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#9f9fa9', '#09090b')).toBeGreaterThanOrEqual(4.5);
  });

  it('every age cell of a live board row and the state root label wear them', () => {
    const boards = read(BOARDS);
    const overview = read(OVERVIEW);
    const age = /cn\(MUTED, "text-right(?: max-md:hidden)? text-zinc-500 dark:text-zinc-400"\)\}>\{ageShort\(/g;
    expect(boards.match(age)).toHaveLength(1);
    expect(overview.match(age)).toHaveLength(2);
    expect(boards).not.toMatch(/cn\(MUTED, "text-right"\)\}>\{ageShort/);
    expect(overview).not.toMatch(/cn\(MUTED, "text-right(?: max-md:hidden)?"\)\}>\{ageShort/);
    const track = declaration(boards, 'PhaseTrack');
    expect(track).toMatch(/"font-mono text-\[10px\] uppercase tracking-\[0\.12em\] text-zinc-500 dark:text-zinc-400"/);
    expect(track).not.toContain('text-zinc-400 dark:text-zinc-500');
  });
});

describe('every touched file', () => {
  it.each(TOUCHED)('%s has no transition-all and no ease-in', (file) => {
    const src = read(file);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it('the global.css block has no transition-all, no ease-in and no ungated hover', () => {
    const block = cssBlock('exp-tab-answer');
    expect(block).not.toMatch(TRANSITION_ALL);
    expect(block).not.toMatch(EASE_IN);
    expect(ungatedHover(block)).toBe(0);
  });

  it('the explorer files stay under their size ceilings', async () => {
    const ceilings: Record<string, number> = JSON.parse(read('scripts/explorer-size-ceilings.json'));
    const sizes = await codeLines(TOUCHED);
    for (const [file, n] of Object.entries(sizes)) {
      expect(n, file).toBeLessThanOrEqual(ceilings[file] ?? 600);
    }
  }, 60_000);
});
