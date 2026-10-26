import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCopiedFlash } from '@/hooks/use-copied-flash';
import { contrast, declaration, palette, read, token, type RGB } from './helpers';

/**
 * Task 14 of the hub motion pass, console feedback: con-copy-confirm, con-tx-landed, con-activity-dot, con-tour-glide,
 * con-launch-confetti and con-composer-beam, each its variant a. Specs: .scratch/hub-motion/proposals/60-console.js.
 */
const HOME = 'app/console/page.tsx';
const SUCCESS = 'components/toolbox/components/Success.tsx';
const PANEL = 'components/console/notification-panel/ConsoleNotificationPanel.tsx';
const DOT_STATE = 'components/console/notification-panel/activity-dot-state.ts';
const STORE = 'components/console/notification-panel/store.ts';
const MORPH = 'components/console/icon-morph.tsx';
const SPOTLIGHT = 'components/console/onboarding-tour/tour-spotlight.tsx';
const TOOLTIP = 'components/console/onboarding-tour/tour-tooltip.tsx';
const TOUR = 'components/console/onboarding-tour/index.tsx';
const PLACEMENT = 'components/console/onboarding-tour/placement.ts';
const LAUNCH = 'components/toolbox/console/create-l1/basic/BasicSetupComplete.tsx';
const BEAM = 'components/studio/Beam.tsx';

const TOUCHED = [HOME, SUCCESS, PANEL, DOT_STATE, STORE, MORPH, SPOTLIGHT, TOOLTIP, TOUR, PLACEMENT, LAUNCH];

/** The shared morph module, loaded at test time so a missing module fails its own tests only. */
const MORPH_MODULE = '@/components/console/icon-morph';
type MorphModule = {
  MorphSlot: ComponentType<{ show: boolean; children?: ReactNode }>;
  DrawnCheck: ComponentType<{ drawn: boolean; className?: string }>;
};
const loadMorph = () => import(/* @vite-ignore */ MORPH_MODULE) as Promise<MorphModule>;

/** The class list of an element, split into classes. */
const classesOf = (html: string, tag: string): string[] =>
  (html.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))?.[1] ?? '').split(/\s+/).filter(Boolean);

/* ---------- WCAG contrast (helpers.ts reads the palette Tailwind ships and the site tokens) ---------- */

/** `top` at `alpha` painted over an opaque `ground`. */
const over = (top: RGB, alpha: number, ground: RGB): RGB =>
  [0, 1, 2].map((i) => Math.round(top[i] * alpha + ground[i] * (1 - alpha))) as RGB;

const WHITE: RGB = [255, 255, 255];

afterEach(() => {
  vi.useRealTimers();
});

describe('every file Task 14 touched', () => {
  it.each(TOUCHED)('%s names what it transitions and never eases in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(/transition-all|transition:\s*all/);
    expect(src).not.toMatch(/\bease-in\b(?!-out)/);
  });
});

describe('con-copy-confirm: copy buttons confirm with a quick morph and a readable check', () => {
  it('blurs the copy icon out in 100ms ease and the check in over 180ms on the strong ease-out', async () => {
    const { MorphSlot } = await loadMorph();
    const shown = classesOf(renderToStaticMarkup(createElement(MorphSlot, { show: true }, 'icon')), 'span');
    const hidden = classesOf(renderToStaticMarkup(createElement(MorphSlot, { show: false }, 'icon')), 'span');
    for (const slot of [shown, hidden]) {
      // Tailwind 4's scale-* and blur-* set `scale` and `filter`, so the list names both.
      expect(slot).toContain('transition-[opacity,scale,filter]');
      // Reduce Motion: an opacity cross-fade only, no scale and no blur.
      expect(slot).toEqual(expect.arrayContaining(['motion-reduce:scale-100', 'motion-reduce:blur-none']));
    }
    expect(hidden).toEqual(
      expect.arrayContaining(['opacity-0', 'scale-80', 'blur-[2px]', 'duration-100', 'ease-[ease]']),
    );
    expect(shown).toEqual(
      expect.arrayContaining(['opacity-100', 'scale-100', 'blur-none', 'duration-180', 'ease-out']),
    );
  });

  it('hides the icon that is not shown from assistive technology', async () => {
    const { MorphSlot } = await loadMorph();
    expect(renderToStaticMarkup(createElement(MorphSlot, { show: false }, 'Copied'))).toMatch(/aria-hidden="true"/);
    expect(renderToStaticMarkup(createElement(MorphSlot, { show: true }, 'Copy Error'))).not.toMatch(/aria-hidden/);
  });

  // aria-hidden alone leaves the hidden label to find in page: "Copied" sits under "Copy Error" in the same cell.
  it('makes the slot that is not shown inert, so find in page never lands on it', async () => {
    const { MorphSlot } = await loadMorph();
    const hidden = renderToStaticMarkup(createElement(MorphSlot, { show: false }, 'Copied'));
    const shown = renderToStaticMarkup(createElement(MorphSlot, { show: true }, 'Copy Error'));
    expect(hidden.match(/^<span[^>]*>/)?.[0]).toMatch(/\sinert=""/);
    expect(shown).not.toMatch(/\binert\b/);
  });

  it('morphs the install-command check, in emerald-600 (dark emerald-400), and keeps the 2000ms hold', () => {
    const block = declaration(read(HOME), 'CliCopyBlock');
    expect(block).toMatch(/useCopiedFlash\(2000\)/);
    expect(block).toMatch(/<MorphSlot show=\{!copied\}>/);
    expect(block).toMatch(/<MorphSlot show=\{copied\}>/);
    expect(block).toMatch(/<Check className="[^"]*\btext-emerald-600 dark:text-emerald-400\b/);
    expect(block).not.toMatch(/emerald-500/);
  });

  it('reaches 3:1 for the check in both themes (on the zinc-50 and zinc-900 block)', () => {
    expect(contrast(palette('emerald-600'), palette('zinc-50'))).toBeGreaterThanOrEqual(3);
    expect(contrast(palette('emerald-400'), palette('zinc-900'))).toBeGreaterThanOrEqual(3);
    // production's emerald-500 failed here
    expect(contrast(palette('emerald-500'), palette('zinc-50'))).toBeLessThan(3);
  });

  it('morphs the tx card copy button and the Copy Error button the same way, at their own holds', () => {
    const success = read(SUCCESS);
    expect(success).toMatch(/useCopiedFlash\(1500\)/);
    expect(success).toMatch(/<MorphSlot show=\{!copied\}>\s*<CopyIcon/);
    expect(success).toMatch(
      /<MorphSlot show=\{copied\}>\s*<Check className="[^"]*text-emerald-600 dark:text-emerald-400/,
    );
    const panel = read(PANEL);
    expect(panel).toMatch(/useCopiedFlash\(1500\)/);
    // Both labels share one grid cell, so the button keeps the width of the longer one.
    expect(panel).toMatch(/<MorphSlot show=\{!copied\}[^>]*>\s*Copy Error/);
    expect(panel).toMatch(/<MorphSlot show=\{copied\}[^>]*>\s*Copied/);
  });

  // One home for the copied flag: hooks/use-copied-flash.ts (shared with the docs copy buttons).
  it('keeps no copy-flag helper of its own', () => {
    expect(read(MORPH)).not.toMatch(/function createFlash|function useFlash/);
    for (const path of [HOME, SUCCESS, PANEL]) expect(read(path)).toMatch(/from ['"]@\/hooks\/use-copied-flash['"]/);
  });

  it('rapid repeat: a double click shows one check and leaves one timer', () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const flash = createCopiedFlash((shown) => changes.push(shown), 2000);
    flash.show();
    vi.advanceTimersByTime(300);
    flash.show();
    // the mark never goes off between the clicks (React keeps one check for the repeated true)
    expect(changes.every(Boolean)).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    // the hold restarts from the second click
    vi.advanceTimersByTime(1999);
    expect(changes.every(Boolean)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(changes.at(-1)).toBe(false);
    expect(changes.filter((shown) => !shown)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('con-tx-landed: the check draws in and the row tint follows', () => {
  it('draws the check: stroke-dashoffset 1 to 0, 240ms after 60ms, on the strong ease-out', async () => {
    const { DrawnCheck } = await loadMorph();
    const drawnHtml = renderToStaticMarkup(createElement(DrawnCheck, { drawn: true }));
    const restHtml = renderToStaticMarkup(createElement(DrawnCheck, { drawn: false }));
    expect(drawnHtml).toMatch(/<path[^>]*pathLength="1"/);
    // lucide's check, so the drawn mark matches the icon set
    expect(drawnHtml).toMatch(/d="M20 6 9 17l-5-5"/);
    const drawn = classesOf(drawnHtml, 'path');
    const rest = classesOf(restHtml, 'path');
    expect(drawn).toEqual(
      expect.arrayContaining(['[stroke-dasharray:1]', '[stroke-dashoffset:0]', 'duration-240', 'delay-60', 'ease-out']),
    );
    expect(rest).toContain('[stroke-dashoffset:1]');
    // Reduce Motion: no drawing, the check is whole and only fades in.
    for (const path of [drawn, rest]) {
      expect(path).toContain('transition-[stroke-dashoffset]');
      expect(path).toContain('motion-reduce:[stroke-dashoffset:0]');
    }
  });

  it('cross-fades the row status icons through the morph, and the check is the drawn one', () => {
    const panel = read(PANEL);
    expect(panel).toMatch(/<MorphSlot show=\{status === 'loading'\}>/);
    expect(panel).toMatch(/<MorphSlot show=\{status === 'success'\}>\s*<DrawnCheck\s+drawn=\{status === 'success'\}/);
    expect(panel).toMatch(/<MorphSlot show=\{status === 'error'\}>/);
    const success = read(SUCCESS);
    expect(success).toMatch(/<MorphSlot show=\{isConfirmed\}>\s*<DrawnCheck\s+drawn=\{isConfirmed\}/);
  });

  it('eases the row tint: background-color 200ms ease', () => {
    const item = declaration(read(PANEL), 'NotificationItem');
    // the row itself; Copy Error keeps transition-colors for its hover colour
    expect(item).toMatch(
      /className=\{`px-3 py-2 \$\{bgClass\} rounded-lg transition-\[background-color\] duration-200 ease-\[ease\]`\}/,
    );
  });

  it('opens the explorer link or Copy Error with grid-template-rows 0fr to 1fr, 180ms on the strong ease-out', () => {
    const reveal = declaration(read(PANEL), 'Reveal');
    expect(reveal).toMatch(/transition-\[grid-template-rows\] duration-180 ease-out/);
    expect(reveal).toMatch(/grid-rows-\[1fr\]/);
    expect(reveal).toMatch(/grid-rows-\[0fr\]/);
    expect(reveal).toMatch(/min-h-0 overflow-hidden/);
  });

  it('paints the check emerald-600, the cross and Copy Error red-600 and the timestamp zinc-500 (dark: 400s)', () => {
    const panel = read(PANEL);
    expect(panel).not.toMatch(/text-green-500|text-red-500/);
    expect(panel).toMatch(/<DrawnCheck[^>]*className="[^"]*text-emerald-600 dark:text-emerald-400/);
    expect(panel).toMatch(/<X className="[^"]*text-red-600 dark:text-red-400/);
    expect(declaration(panel, 'NotificationItem')).toMatch(/text-\[10px\] text-zinc-500 dark:text-zinc-400 shrink-0/);
  });

  it('reaches WCAG on every row ground: text 4.5:1, glyphs 3:1, light and dark', () => {
    const popover = { light: token('popover', 'light'), dark: token('popover', 'dark') };
    const rows = {
      loading: { light: palette('zinc-50'), dark: over(palette('zinc-800'), 0.5, popover.dark) },
      success: {
        light: over(palette('green-50'), 0.5, popover.light),
        dark: over(palette('green-900'), 0.1, popover.dark),
      },
      error: { light: over(palette('red-50'), 0.5, popover.light), dark: over(palette('red-900'), 0.1, popover.dark) },
    };
    // "just now" on every row
    for (const row of Object.values(rows)) {
      expect(contrast(palette('zinc-500'), row.light)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette('zinc-400'), row.dark)).toBeGreaterThanOrEqual(4.5);
    }
    // production's zinc-400 timestamp failed in light
    expect(contrast(palette('zinc-400'), rows.loading.light)).toBeLessThan(4.5);
    expect(contrast(palette('emerald-600'), rows.success.light)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette('emerald-400'), rows.success.dark)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette('red-600'), rows.error.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette('red-400'), rows.error.dark)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('con-activity-dot: one ring when a transaction resolves, green only on success', () => {
  const panel = () => read(PANEL);

  it('takes its state from activityDotState, so a failure never shows green', () => {
    expect(panel()).toMatch(/activityDotState\(notifications\)/);
    expect(panel()).not.toMatch(/bg-blue-500|bg-green-500/);
    // the result that landed last decides: the store stamps when a status leaves 'loading'
    // (behaviour tested in tests/unit/console/activity-dot-state.test.ts)
    expect(read(STORE)).toMatch(/resolvedAt: Date\.now\(\)/);
    expect(read(DOT_STATE)).toMatch(/item\.resolvedAt \?\? item\.timestamp/);
  });

  it('pulses in ink while busy, settles emerald-600 or red-600 (dark: 400s)', () => {
    const src = panel();
    expect(src).toMatch(/busy: 'bg-zinc-900 dark:bg-zinc-100 animate-pulse motion-reduce:animate-none'/);
    expect(src).toMatch(/success: 'bg-emerald-600 dark:bg-emerald-400'/);
    expect(src).toMatch(/failure: 'bg-red-600 dark:bg-red-400'/);
  });

  it('sends one ring when the result lands: scale 1 to 2.6, opacity 0.55 to 0, 700ms on the strong ease-out', () => {
    const src = panel();
    expect(src).toMatch(/landedResult\(/);
    // a ring needs a landing newer than any the dot has seen, so removing the last running row does not ring
    // (behaviour tested in tests/unit/console/activity-dot-state.test.ts)
    expect(src).toMatch(/const seenLanding = useRef\(newestLanding\(notifications\)\);/);
    expect(src).toMatch(
      /const \{ landed, seen \} = landedResult\(seenLanding\.current, notifications\);\s*seenLanding\.current = seen;/,
    );
    expect(src).not.toMatch(/lastDot/);
    expect(src).toMatch(
      /\{ transform: 'scale\(1\)', opacity: 0\.55 \},\s*\{ transform: 'scale\(2\.6\)', opacity: 0 \}/,
    );
    expect(src).toMatch(/duration: 700, easing: cssEase\(EASE_OUT\)/);
  });

  it('plays no ring under Reduce Motion (the dot only changes colour, faded by the site policy)', () => {
    expect(panel()).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  });

  it('reaches 3:1 for the dot on white and on the dark page', () => {
    const dark = token('background', 'dark');
    expect(contrast(palette('emerald-600'), WHITE)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette('red-600'), WHITE)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette('emerald-400'), dark)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette('red-400'), dark)).toBeGreaterThanOrEqual(3);
    // production's green-500 failed on white
    expect(contrast(palette('green-500'), WHITE)).toBeLessThan(3);
  });
});

describe('con-tour-glide: the spotlight glides from stop to stop', () => {
  it('moves the cutout with transform, width and height over 350ms on the in-out curve', () => {
    const src = read(SPOTLIGHT);
    expect(src).toMatch(/transition-\[transform,width,height\] duration-350 ease-in-out/);
    expect(src).toMatch(/transform: `translate\(\$\{spotlightX\}px, \$\{spotlightY\}px\)`/);
    // the overlay is the cutout's own shadow now, so the cutout can travel
    expect(src).not.toMatch(/<mask|<svg/);
    expect(src).toMatch(/0 0 0 9999px rgba\(0, 0, 0, 0\.6\)/);
    // variant a keeps today's blue ring
    expect(src).toMatch(/rgb\(59, 130, 246\)/);
  });

  it('fades the overlay in over 200ms and out in 150ms', () => {
    const src = read(SPOTLIGHT);
    expect(src).toMatch(/opacity-100 duration-200 ease-out starting:opacity-0/);
    // the spec gives no curve for the exit, so it takes the strong ease-out (plain ease is for hover colour)
    expect(src).toMatch(/pointer-events-none opacity-0 duration-150 ease-out/);
  });

  it('moves the card with translate over 350ms on the in-out curve, and enters from 0.97 in 180ms', () => {
    const src = read(TOOLTIP);
    expect(src).toMatch(/translate: `\$\{x\}px \$\{y\}px`/);
    expect(src).toMatch(/translate_350ms_var\(--ease-in-out\)/);
    expect(src).toMatch(/opacity_180ms_var\(--ease-out\),scale_180ms_var\(--ease-out\)/);
    expect(src).toMatch(/starting:scale-\[0\.97\] starting:opacity-0/);
    expect(src).toMatch(/pointer-events-none opacity-0 \[transition:opacity_150ms_var\(--ease-out\)\]/);
  });

  it('grows the card from the side that faces the target', () => {
    const src = read(TOOLTIP);
    expect(src).toMatch(/right: ["']left center["']/);
    expect(src).toMatch(/left: ["']right center["']/);
    expect(src).toMatch(/bottom: ["']center top["']/);
    expect(src).toMatch(/top: ["']center bottom["']/);
    expect(src).toMatch(/transformOrigin: ORIGIN\[position\]/);
  });

  it('swaps the card text at the bottom of a 260ms opacity and 2px blur dip (no blur under Reduce Motion)', () => {
    const src = read(TOOLTIP);
    expect(src).toMatch(/opacity-0 blur-\[2px\] duration-104/);
    expect(src).toMatch(/opacity-100 blur-none duration-156/);
    expect(src).toMatch(/transition-\[opacity,filter\] ease-\[ease\] motion-reduce:blur-none/);
    // 104 + 156 = 260
    expect(src).toMatch(/const DIP_OUT_MS = 104;/);
  });

  // The spec swaps the card's text at the bottom of the dip: the count as well as the title and the description.
  it('dips the count with the title and description, and keeps the footer current', () => {
    const src = read(TOOLTIP);
    expect(src).toMatch(/<span className=\{cn\("text-xs text-muted-foreground", dip\)\}>\{shown\.count\}<\/span>/);
    expect(src).toMatch(/<div className=\{cn\("p-4", dip\)\}>/);
    expect(src).toMatch(/\{shown\.step\.title\}/);
    expect(src).toMatch(/: shown\.step\.description\}/);
    // the footer's labels and disabled states drive the next click, so they are never dipped
    expect(src).toMatch(/\{\/\* Footer: never dipped, so its labels and disabled states always match/);
  });

  it('measures the card by layout size, which the entrance scale does not change, once it shows', () => {
    const src = read(TOOLTIP);
    expect(src).toMatch(/offsetWidth/);
    expect(src).not.toMatch(/getBoundingClientRect/);
    // the first stop is measured too, not placed with the 320 x 180 estimate
    expect(src).toMatch(/\}, \[visible, shown\]\);/);
  });

  // The rules themselves are tested in tests/unit/console/tour-placement.test.ts.
  it('places every update through nextPlacement and stays 150ms to fade out', () => {
    const src = read(TOUR);
    expect(src).toMatch(/nextPlacement\(previous, \{ kind: "stop", step: currentStep, rect \}\)/);
    // the settle after a scroll into view, and every scroll or resize
    expect(
      src.match(/nextPlacement\(previous, \{ kind: "track", step: currentStep, rect(?:: \w+)? \}\)/g),
    ).toHaveLength(2);
    expect(src).not.toMatch(/glide: (?:true|false|previous)/);
    expect(read(PLACEMENT)).toMatch(/glide: event\.kind === "stop" && previous !== null/);
    expect(src).toMatch(/setTimeout\(\(\) => setLeaving\(false\), 150\)/);
  });

  it('tracks the target only while the tour shows, forgets its place on close, and clears the settle timer', () => {
    const src = read(TOUR);
    expect(src).toMatch(
      /if \(!currentStep \|\| !showing\) \{\s*setPlacement\(\(previous\) => nextPlacement\(previous, \{ kind: "close" \}\)\);/,
    );
    expect(src).toMatch(/\}, \[currentStep, showing\]\);/);
    expect(src).toMatch(/settle = setTimeout\(/);
    expect(src).toMatch(/clearTimeout\(settle\);/);
  });

  // The step changes 50ms before its target is measured: until then the spotlight and card keep the side and padding
  // of the step they point at, so they never jump to the old target's other side before they travel.
  it('keeps the side and padding of the measured step until the next stop is measured', () => {
    const src = read(TOUR);
    expect(src).toMatch(/const placedStep = placement\?\.step \?\? currentStep;/);
    expect(src).toMatch(/padding=\{placedStep\.spotlightPadding\}/);
    expect(src).toMatch(/position=\{placedStep\.position\}/);
    expect(read(TOOLTIP)).toMatch(/preferredSide \|\| ["']auto["']/);
  });
});

describe('con-launch-confetti: confetti in brand colours, and none under Reduce Motion', () => {
  const effect = () => {
    const src = read(LAUNCH);
    return src.slice(src.indexOf('const firedRef'), src.indexOf('const stats'));
  };

  it('sets disableForReducedMotion on the options all three bursts share', () => {
    const src = effect();
    expect(src).toMatch(/const base = \{[^}]*disableForReducedMotion: true/);
    expect(src.match(/confetti\(\{ \.\.\.base,/g)).toHaveLength(3);
  });

  it('fires the console red, ink and greys in place of the default rainbow', () => {
    const src = read(LAUNCH);
    expect(src).toMatch(/light: \['#E6212F', '#18181B', '#71717A', '#D4D4D8'\]/);
    expect(src).toMatch(/dark: \['#E6212F', '#FAFAFA', '#A1A1AA', '#52525B'\]/);
    // the palette follows the theme the page shows
    expect(effect()).toMatch(
      /document\.documentElement\.classList\.contains\('dark'\) \? LAUNCH_CONFETTI\.dark : LAUNCH_CONFETTI\.light/,
    );
    expect(effect()).toMatch(/const base = \{[^}]*\bcolors,/);
  });

  it('keeps the bursts, counts, angles and timing', () => {
    const src = effect();
    expect(src).toMatch(/particleCount: 80, angle: 60, origin: \{ x: 0, y: 0\.65 \}/);
    expect(src).toMatch(/particleCount: 80, angle: 120, origin: \{ x: 1, y: 0\.65 \}/);
    expect(src).toMatch(/particleCount: 60, angle: 90, spread: 130, origin: \{ x: 0\.5, y: 0\.55 \}/);
    expect(src).toMatch(/\}, 220\);/);
  });
});

describe('con-composer-beam: the Studio composer beam in Avalanche red', () => {
  it('passes the avalanche preset in place of the rainbow', () => {
    const src = read(HOME);
    expect(src).toMatch(/beam="avalanche"/);
    expect(src).not.toMatch(/beam="colorful"/);
  });

  it('uses the preset that already exists: the red colour matrix on static colours', () => {
    const src = read(BEAM);
    expect(src).toMatch(/const avalanche = colorVariant === 'avalanche';/);
    expect(src).toMatch(/staticColors=\{avalanche\}/);
  });
});

describe('the My L1 chain rail tooltip reads at 4.5:1 on its own ink plate', () => {
  const RAIL = 'app/console/my-l1/_components/SwitchChainRail.tsx';

  it('the 10px chain id line: zinc-400 on the zinc-900 plate, and dark zinc-600 on the zinc-100 plate', () => {
    // the plate: shadcn TooltipContent restyled in chrome.ts, ink in light and paper in dark
    const plate =
      read('app/console/my-l1/_components/chrome.ts').match(/export const TOOLTIP =\s*'([^']*)'/)?.[1] ?? '';
    expect(plate.split(' ')).toEqual(expect.arrayContaining(['bg-zinc-900', 'dark:bg-zinc-100']));
    const rail = read(RAIL);
    expect(rail).toMatch(/<TooltipContent [^>]*className=\{TOOLTIP\}>/);
    const line = rail.match(
      /<div className="font-mono text-\[10px\] text-(zinc-\d+) dark:text-(zinc-\d+)">\s*chain \{/,
    );
    expect(line, 'the chain id line').not.toBeNull();
    const [, light, dark] = line ?? [];
    expect(contrast(palette(light), palette('zinc-900'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette(dark), palette('zinc-100'))).toBeGreaterThanOrEqual(4.5);
    // the dark zinc-500 it had read 4.39:1
    expect(contrast(palette('zinc-500'), palette('zinc-100'))).toBeLessThan(4.5);
  });

  it('names what it transitions and never eases in', () => {
    expect(read(RAIL)).not.toMatch(/transition-all|transition:\s*all/);
    expect(read(RAIL)).not.toMatch(/\bease-in\b(?!-out)/);
  });
});
