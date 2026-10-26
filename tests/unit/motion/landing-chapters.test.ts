import postcss, { type AtRule, type Rule } from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { classesOf, openingTags, read } from './helpers';

import { C_CHAIN, LanesFrame } from '@/components/landing-v2/NetworkLanes';
import { canRing, landingsIn } from '@/components/landing-v2/NetworkLanesLive';
import BuildChapter from '@/components/landing-v2/story/BuildChapter';
import FinalChapter, { replayPose } from '@/components/landing-v2/story/FinalChapter';
import InstitutionsChapter from '@/components/landing-v2/story/InstitutionsChapter';
import { Reveal } from '@/components/landing-v2/story/kit';

/**
 * Task 6 of the hub motion pass, the home chapters: each chapter's title settles 8px while its other blocks only fade
 * in, and the server sends every block in place (home-reveals, variant a); the case and resource arrows rest at
 * zinc-500 and nudge 2px on one property (home-cell-arrows, variant a); a "Run it again" button replays the finality
 * race (home-ruler-replay, variant a); the live dot rings once as each C-Chain block lands (home-live-dot, variant a).
 */
const CSS = 'app/global.css';
const KIT = 'components/landing-v2/story/kit.tsx';
const OWN = 'components/landing-v2/story/OwnChapter.tsx';
const FINAL = 'components/landing-v2/story/FinalChapter.tsx';
const INTEROP = 'components/landing-v2/story/InteropChapter.tsx';
const INSTITUTIONS = 'components/landing-v2/story/InstitutionsChapter.tsx';
const BUILD = 'components/landing-v2/story/BuildChapter.tsx';
const LANES = 'components/landing-v2/NetworkLanes.tsx';
const LIVE = 'components/landing-v2/NetworkLanesLive.tsx';
const CHAPTERS = [OWN, FINAL, INTEROP, INSTITUTIONS, BUILD];
const TOUCHED = [KIT, ...CHAPTERS, LANES, LIVE];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;

/** The class list of a `const NAME = { title: "...", block: "..." }` pose table in kit.tsx. */
function poses(src: string, name: string): { title: string; block: string } {
  const m = src.match(new RegExp(`const ${name} = \\{\\s*title: "([^"]+)",\\s*block: "([^"]+)",\\s*\\};`));
  expect(m, name).not.toBeNull();
  return { title: m![1], block: m![2] };
}

/** The pixels a Tailwind translate-y-N class moves (one spacing step is 4px); 0 for a class with none. */
const risePx = (classes: string) =>
  Math.max(0, ...[...classes.matchAll(/(?:^|\s)(?:[\w-]+:)*-?translate-y-(\d+(?:\.\d+)?)\b/g)].map((m) => +m[1] * 4));

describe('home-reveals: the title settles 8px, every other block fades in place', () => {
  const kit = read(KIT);

  it('the server sends each block in place, with no hidden pose, and keeps data-reveal for the no-script rule', () => {
    for (const title of [true, false]) {
      const html = renderToStaticMarkup(createElement(Reveal, { title, className: 'mt-16' }, 'Proof'));
      expect(html).toMatch(/^<div data-reveal="true" class="[^"]*\bmt-16\b[^"]*">Proof<\/div>$/);
      expect(html).not.toMatch(/opacity|translate|transform|style=/);
    }
    // framer no longer owns the reveal, so no initial pose reaches the server HTML
    expect(kit).not.toMatch(/initial=\{|y: 24|motion\.div/);
  });

  it('only a block wholly below the screen once the page has its scroll waits, then arrives in view', () => {
    expect(kit).toMatch(/const \[waiting, setWaiting\] = useState\(false\);/);
    // a passive effect: it runs after the router sets the scroll, so a client navigation measures the new page
    expect(kit).toMatch(
      /useEffect\(\(\) => \{\s*const el = ref\.current;\s*if \(el && el\.getBoundingClientRect\(\)\.top >= window\.innerHeight\) setWaiting\(true\);\s*\}, \[\]\);/,
    );
    expect(kit).not.toMatch(/useLayoutEffect/);
    expect(kit).toMatch(/const inView = useInView\(ref, REVEAL_VIEW\);/);
    // the trigger is unchanged: the block's top passes 90% of the screen, once
    expect(kit).toMatch(/export const REVEAL_VIEW = \{ once: true, margin: "0px 0px -10% 0px" \} as const;/);
    expect(kit).toMatch(/const pose = waiting \? \(inView \? ARRIVE\[kind\] : WAIT\[kind\]\) : "";/);
  });

  it('the title waits 8px low and settles over 400ms on the strong ease-out; other blocks fade over 300ms, no rise', () => {
    const wait = poses(kit, 'WAIT');
    const arrive = poses(kit, 'ARRIVE');
    expect(wait.title).toBe('opacity-0 translate-y-2 motion-reduce:translate-y-0');
    expect(arrive.title).toBe('transition-[opacity,translate] duration-400 ease-out motion-reduce:duration-200!');
    expect(wait.block).toBe('opacity-0 motion-reduce:opacity-100');
    expect(arrive.block).toBe('transition-opacity duration-300 ease-out');
    // at most 8px, on titles only
    expect(risePx(wait.title)).toBe(8);
    expect(risePx(`${wait.block} ${arrive.block}`)).toBe(0);
    expect(kit).toMatch(/style=\{waiting && inView && delay \? \{ transitionDelay: `\$\{delay\}s` \} : undefined\}/);
  });

  it('reduced motion: the title only fades (no rise), every other block is simply there', () => {
    const wait = poses(kit, 'WAIT');
    expect(wait.title.split(' ')).toContain('motion-reduce:translate-y-0');
    expect(wait.block.split(' ')).toContain('motion-reduce:opacity-100');
  });

  it("reduced motion: the title's fade takes the spec's 200ms, not the site policy's 150ms", () => {
    // the policy's 150ms is !important and unlayered; Tailwind's ! utility is !important inside @layer utilities, and
    // for !important declarations a layered one beats an unlayered one
    expect(poses(kit, 'ARRIVE').title.split(' ')).toContain('motion-reduce:duration-200!');
    const policy: Rule[] = [];
    postcss.parse(read(CSS)).walkDecls('transition-duration', (decl) => {
      const rule = decl.parent as Rule;
      if (decl.important && decl.value === '150ms' && rule.selectors?.includes('*')) policy.push(rule);
    });
    expect(policy).toHaveLength(1);
    for (let node = policy[0].parent; node && node.type !== 'root'; node = node.parent) {
      expect(node.type === 'atrule' && (node as AtRule).name === 'layer').toBe(false);
    }
  });

  it('each chapter opens with its title block; the blocks after it wait 80 or 120ms (was 100 and 150)', () => {
    let blocks = 0;
    for (const file of CHAPTERS) {
      const reveals = read(file).match(/<Reveal\b[^>]*>/g) ?? [];
      expect(reveals[0], file).toMatch(/^<Reveal title\b/);
      expect(
        reveals.filter((r) => /\btitle\b/.test(r)),
        file,
      ).toHaveLength(1);
      for (const r of reveals.slice(1)) expect(r, file).toMatch(/\bdelay=\{0\.(08|12)\}/);
      blocks += reveals.length - 1;
    }
    expect(blocks).toBe(8);
  });

  it('with scripts off, global.css still shows every data-reveal block', () => {
    const rules: Rule[] = [];
    postcss.parse(read(CSS)).walkAtRules('media', (at: AtRule) => {
      if (at.params.replace(/\s/g, '') !== '(scripting:none)') return;
      at.walkRules((rule) => {
        if (rule.selector === '[data-reveal]') rules.push(rule);
      });
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].toString()).toMatch(/opacity: 1 !important;/);
  });
});

describe('home-cell-arrows: visible at rest, one property nudges 2px on hover and keyboard focus', () => {
  /** The classes the cell arrow renders with: the chapter's first absolutely placed arrow icon. */
  const arrowOf = (file: string) => {
    const html = renderToStaticMarkup(
      file === BUILD ? createElement(BuildChapter, { academyLine: null }) : createElement(InstitutionsChapter),
    );
    const arrow = openingTags(html, 'svg')
      .map(classesOf)
      .find((list) => list.includes('lucide-arrow-right') && list.includes('absolute'));
    expect(arrow, `${file}: a cell arrow`).toBeDefined();
    return arrow ?? [];
  };

  it('the motion is written once, in kit.tsx, and both chapters take it from there', () => {
    const motion = '[transition:color_150ms_ease,transform_200ms_var(--ease-out)]';
    expect(read(KIT).split(motion)).toHaveLength(2);
    for (const file of [INSTITUTIONS, BUILD]) {
      expect(read(file), file).not.toContain(motion);
      expect(read(file), file).toMatch(/<ArrowRight className=\{`[^`]*\$\{CELL_ARROW\}[^`]*`\} \/>/);
    }
  });

  it.each([INSTITUTIONS, BUILD])('%s: the arrow rests at zinc-500 in both themes (was zinc-300 / zinc-600)', (file) => {
    const list = arrowOf(file);
    expect(list.filter((c) => /^(dark:)?text-zinc-/.test(c))).toEqual(['text-zinc-500']);
  });

  it.each([INSTITUTIONS, BUILD])('%s: color 150ms ease, transform 200ms ease-out, translate none at rest', (file) => {
    const list = arrowOf(file);
    expect(list).toContain('[transition:color_150ms_ease,transform_200ms_var(--ease-out)]');
    expect(list).toContain('translate-none');
    expect(list.some((c) => /^transition(-|$)/.test(c))).toBe(false);
  });

  it.each([INSTITUTIONS, BUILD])(
    '%s: hover and keyboard focus turn it red and move it 2px with transform only',
    (file) => {
      const list = arrowOf(file);
      expect(list).toContain('group-hover:text-[#E6212F]');
      expect(list).toContain('group-focus-visible:text-[#E6212F]');
      // reduced motion keeps the colour change only, so the nudge sits behind motion-safe
      const moves = list.filter((c) => /transform:|translate/.test(c)).sort();
      expect(moves).toEqual(
        [
          'motion-safe:group-focus-visible:[transform:translateX(2px)]',
          'motion-safe:group-hover:[transform:translateX(2px)]',
          'translate-none',
        ].sort(),
      );
    },
  );
});

describe('home-ruler-replay: "Run it again" replays the finality race', () => {
  const src = read(FINAL);

  it('sits beside "How finality works" on its row, in the TextLink grammar', () => {
    const html = renderToStaticMarkup(createElement(FinalChapter));
    const row = html.match(/<div class="mt-10">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(row).toMatch(
      /^<a [^>]*href="\/docs\/primary-network\/exchange-integration#determining-finality"[^>]*>How finality works<svg[\s\S]*<\/a><button type="button" class="[^"]+">Run it again<\/button>$/,
    );
    const cls = row.match(/<button type="button" class="([^"]+)">/)![1].split(' ');
    // mono, the quiet link's ink, the red focus ring, and a 44px tap height that does not grow the row
    for (const c of [
      'font-mono',
      'text-xs',
      'uppercase',
      'tracking-[0.16em]',
      'text-zinc-600',
      'hover:text-zinc-900',
      'focus-visible:text-zinc-900',
      'dark:text-zinc-300',
      'dark:hover:text-zinc-50',
      'focus-visible:outline-[#E6212F]',
      '-my-3.5',
      'py-3.5',
      'whitespace-nowrap',
      'cursor-pointer',
      // the phone gap (24px) keeps it on the link's line from 360px; 32px from sm, as the other door rows
      'ml-6',
      'sm:ml-8',
    ]) {
      expect(cls, c).toContain(c);
    }
  });

  it('is not shown under reduced motion, where the ruler rests, nor without scripts, which it needs', () => {
    const cls = src.match(/<button\s+type="button"[\s\S]*?className=\{`([^`]+)`\}/)?.[1] ?? '';
    expect(cls.split(/\s+/)).toContain('motion-reduce:hidden');
    expect(cls.split(/\s+/)).toContain('[@media(scripting:none)]:hidden');
  });

  it('is not shown below 360px, where it would wrap onto a row of its own: no width gains a row', () => {
    const cls = src.match(/<button\s+type="button"[\s\S]*?className=\{`([^`]+)`\}/)?.[1] ?? '';
    // Tailwind 4 compiles max-[360px] to @media (width < 360px): hidden at 359px and under, shown from 360px
    expect(cls.split(/\s+/)).toContain('max-[360px]:hidden');
  });

  it('a press runs the race again from its start pose', () => {
    expect(src).toMatch(/const \[replays, setReplays\] = useState\(0\);/);
    expect(src).toMatch(/onClick=\{\(\) => setReplays\(\(n\) => n \+ 1\)\}/);
    expect(src).toMatch(/<FinalityRuler replays=\{replays\} \/>/);
    expect(src).toMatch(
      /useEffect\(\(\) => \{\s*if \(replays\) setPhase\(replayPose\(onScreen\)\);\s*\}, \[replays\]\);/,
    );
    // the moving parts remount on each press, so their CSS animations start over: the fill, each trip, each mark
    expect(src.match(/key=\{replays\}/g)).toHaveLength(2);
    expect(src).toMatch(/key=\{`\$\{m\.chain\}-\$\{replays\}`\}/);
  });

  it('a press on a ruler on screen runs it; off screen it only resets to the start pose, so the race plays on return', () => {
    expect(replayPose(true)).toBe('run');
    // a run played above the screen goes unseen, and the watch that runs it on return would find it already running
    expect(replayPose(false)).toBe('start');
    // on return the watch moves the start pose to the run, so the race plays then
    expect(src).toMatch(/if \(watched\) setPhase\(["']run["']\);\s*else if \(!onScreen\) setPhase\(["']start["']\);/);
  });

  it('runs at the same true speed: a 300ms beat, the trips at the marks, each mark lit over 300ms', () => {
    for (const line of [
      'const SPAN_MS = 1500;',
      'const FINAL_MS = 1000;',
      'const L1_MS = 500;',
      'const LEAD_MS = 300;',
      'const LIT_MS = 300;',
      'animation: pose === "run" ? `v2-story-final-fill ${FINAL_MS}ms linear ${LEAD_MS}ms both` : undefined,',
      'animation: pose === "run" ? `v2-story-final-tx ${m.ms}ms linear ${LEAD_MS}ms both` : undefined,',
      'animation: pose === "run" ? `v2-story-final-lit ${LIT_MS}ms ease-out ${LEAD_MS + m.ms}ms both` : undefined,',
    ]) {
      expect(src).toContain(line);
    }
  });
});

describe('home-live-dot: a ring as C-Chain blocks land, at most one every 2s, no ping loop', () => {
  const lanes = read(LANES);
  const live = read(LIVE);
  const chain = { chainId: C_CHAIN, slug: 'c-chain', name: 'Avalanche C-Chain', logo: '', symbol: 'AVAX' };

  it('the live dot holds a ring that rests at opacity 0, instead of animate-ping', () => {
    const html = renderToStaticMarkup(
      createElement(LanesFrame, { chains: [chain], renderMark: () => null, state: 'live', lane: () => null }),
    );
    expect(html).toContain(
      '<span class="relative flex h-1.5 w-1.5"><span class="absolute inline-flex h-full w-full rounded-full bg-[#E6212F] opacity-0"></span><span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]"></span></span>',
    );
    expect(lanes).not.toContain('animate-ping');
    expect(lanes).toMatch(
      /\{live && <span ref=\{ring\} className="absolute inline-flex h-full w-full rounded-full bg-\[#E6212F\] opacity-0" \/>\}/,
    );
    expect(C_CHAIN).toBe('43114');
  });

  it('the ring: scale 1 to 2.4 and opacity 0.6 to 0, over 700ms on the strong ease-out', () => {
    expect(live).toMatch(/import \{ EASE_OUT, cssEase \} from ['"]@\/lib\/motion-curves['"];/);
    expect(live).toMatch(
      /\{ transform: "scale\(1\)", opacity: 0\.6 \},\s*\{ transform: "scale\(2\.4\)", opacity: 0 \},/,
    );
    expect(live).toMatch(/\{ duration: 700, easing: cssEase\(EASE_OUT\) \}/);
    expect(live).toMatch(/ring\.current\?\.animate\(RING, RING_TIMING\);/);
  });

  it('rings on a landing at most once every 2s; the blocks that land in between join the next ring', () => {
    expect(live).toMatch(/const RING_GAP_MS = 2_000;/);
    expect(live).toMatch(
      /const now = performance\.now\(\);\s*if \(!canRing\(lastRing\.current, now\)\) return;\s*lastRing\.current = now;\s*ring\.current\?\.animate\(RING, RING_TIMING\);/,
    );
    expect(canRing(-Infinity, 0)).toBe(true);
    expect(canRing(10_000, 11_999)).toBe(false);
    expect(canRing(10_000, 12_000)).toBe(true);
    // the C-Chain's cadence today, one block every 700ms, then a 4.6s gap: every ring falls on a landing, 2s apart or more
    const rings: number[] = [];
    let last = -Infinity;
    for (const landing of [0, 700, 1_400, 2_100, 2_800, 3_500, 4_200, 4_900, 9_500]) {
      if (!canRing(last, landing)) continue;
      rings.push(landing);
      last = landing;
    }
    expect(rings).toEqual([0, 2_100, 4_200, 9_500]);
  });

  it('only the C-Chain lane rings it, at each landing, and only while the lanes move (on screen, motion allowed)', () => {
    expect(live).toMatch(/onLand=\{chain\.chainId === C_CHAIN \? onLand : undefined\}/);
    expect(live).toMatch(/ring=\{ring\}/);
    expect(live).toMatch(
      /useEffect\(\(\) => \{\s*if \(!onLand \|\| !moving\) return;\s*const timers = landingsIn\(heads, clock\.delay, Date\.now\(\)\)\.map\(\(wait\) => window\.setTimeout\(onLand, wait\)\);\s*return \(\) => timers\.forEach\(\(t\) => window\.clearTimeout\(t\)\);\s*\}, \[onLand, moving, heads, clock\.delay\]\);/,
    );
  });

  it('landingsIn: the wait until each block that has not landed crosses NOW (drawn time plus the clock delay)', () => {
    expect(landingsIn([{ drawnMs: 1_000 }, { drawnMs: 2_000 }, { drawnMs: 5_000 }], 8_000, 9_500)).toEqual([
      500, 3_500,
    ]);
    expect(landingsIn([{ drawnMs: 1_500 }], 8_000, 9_500)).toEqual([0]);
    expect(landingsIn([{ drawnMs: 1_499 }], 8_000, 9_500)).toEqual([]);
    expect(landingsIn([], 8_000, 9_500)).toEqual([]);
  });
});

describe('conventions', () => {
  it.each(TOUCHED)('%s: no transition-all and no ease-in', (file) => {
    const src = read(file);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });
});
