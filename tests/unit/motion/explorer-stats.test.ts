import { describe, expect, it } from 'vitest';
import { contrast, cssBlock, declaration, read } from './helpers';

/**
 * Task 16 of the hub motion pass, the explorer's network stats: exp-range-hold (a), exp-pick-focus, exp-copy-morph (a)
 * and stats-chart-pick (a). Specs: .scratch/hub-motion/proposals/70-explorer.js and 80-stats.js.
 */
const CHARTS = 'components/explorer-v2/evm/metric-charts.tsx';
const STATS = 'components/explorer-v2/network/NetworkStats.tsx';
const PARTS = 'components/explorer-v2/network/icm-parts.tsx';
const RANGE = 'components/explorer-v2/time-range.tsx';
const UI = 'components/explorer-v2/ui.tsx';
const MARK = 'components/explorer-v2/copy-mark.tsx';
const GAS = 'components/explorer-v2/gas/instruments.tsx';
const ACTIVITY = 'components/explorer-v2/evm/EvmActivity.tsx';
const TOUCHED = [CHARTS, STATS, PARTS, RANGE, UI, MARK, GAS, ACTIVITY];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;

describe('exp-range-hold (a): network stats keep the last window on screen while the next one loads', () => {
  const charts = read(CHARTS);
  const stats = read(STATS);

  it('a chain-metrics read answers only its own url, so a new window never draws on the last one', () => {
    const hook = declaration(charts, 'useChainMetrics');
    // each read keeps the url it answers
    expect(hook).toMatch(
      /useState\(\(\) => \(\{ url, metrics: recall<Metrics>\(url, false\)\?\.data \?\? null, failed: false \}\)\)/,
    );
    expect(hook).toContain('setRead({ url, metrics: data, failed: false });');
    // the render between a new window and its read: that window's own memory, or nothing, never the last payload
    // (the choice is metricsReadFor, tested in tests/unit/explorer/held-window.test.ts)
    expect(hook).toMatch(
      /return metricsReadFor\(url, read, \(asked\) => recall<Metrics>\(asked, false\)\?\.data \?\? null\);/,
    );
    expect(charts).toMatch(/^export function metricsReadFor\(/m);
    expect(hook).not.toContain('read.url !== url');
    expect(hook).not.toContain('setMetrics(');
  });

  it('the window choice has one home, beside the chain-metrics read, and the stats draw through it', () => {
    expect(charts).toMatch(
      /^export function heldWindow<T>\(prev: T \| null, next: T \| null, loading: boolean\): \{ data: T \| null; stale: boolean \}/m,
    );
    const choice = declaration(charts, 'statsWindow');
    expect(choice).toMatch(/^export function statsWindow<C>\(/);
    // a C-Chain fee read that failed completes the window as well as one that answered
    expect(choice).toContain('complete: !fees || !!fees.metrics || fees.failed');
    // windows compare by their reads, clock and completeness, never by object
    expect(choice).toContain(
      'asked.clock === kept.clock && asked.metrics === kept.metrics && asked.fees === kept.fees && asked.complete === kept.complete',
    );
    expect(choice).toMatch(/heldWindow\(kept, done \?\? \(kept \? null : asked\), !main\.failed\)/);
    expect(stats).not.toMatch(/function (?:heldWindow|statsWindow)\b/);
    // the last complete window stays until the next one is complete; a first visit draws each read as it lands
    expect(stats).toMatch(/const \{ view, stale, keep \} = statsWindow\(kept, clock, main, fees\);/);
    expect(stats).toMatch(/if \(keep\) setKept\(keep\);/);
    expect(stats).not.toMatch(/!== kept\b/);
  });

  it('every figure and the chart read the window on screen, its own clock included', () => {
    expect(stats).toMatch(/const viewMetrics = view\?\.metrics;/);
    expect(stats).toMatch(/if \(!viewMetrics\) return EMPTY;/);
    expect(stats).toMatch(/const shown = view\?\.clock \?\? clock;/);
    expect(stats).toMatch(/const range = RANGE_DAYS\[shown\];/);
    expect(stats).toMatch(/rangeWindowLabel\(shown\)/);
    expect(stats).toMatch(/const answered = \(spec: MetricSpec\) => !!view && \(!isFee\(spec\) \|\| view\.complete\);/);
    // the ICM series come from the window on screen, not the feed in flight
    expect(stats).toMatch(/m\.icmMessages\?\.data/);
    expect(stats).not.toMatch(/metrics\?\.icmMessages/);
  });

  it("nothing blanks and nothing jumps: the held window dims to LayerBlock's own 0.6", () => {
    expect(stats).toMatch(
      /<ReadoutRow cols=\{4\} className=\{cn\("transition-opacity duration-150 ease-out", stale && "opacity-60"\)\}>/,
    );
    expect(stats).toMatch(/<LayerBlock[^>]*\bstale=\{stale\}/);
    // LayerBlock dims on the same house curve as the readouts
    expect(read(PARTS)).toMatch(/cn\("pr-2 pt-2 transition-opacity ease-out", stale && "opacity-60"\)/);
    // the ellipsis and the pulsing block are a first visit's only: once a window has been drawn, one is always drawn
    expect(stats).toMatch(/value=\{value !== null \? fmtOf\(spec\)\(value\) : answered\(spec\) \? "—" : null\}/);
  });

  it('the gas blocks and the activity block dim on the same house curve as LayerBlock', () => {
    // StackBlock and every other gas block draw in Instrument's frame
    expect(declaration(read(GAS), 'StackBlock')).toContain('<Instrument {...head}');
    expect(declaration(read(GAS), 'Instrument')).toMatch(
      /cn\("min-w-0 pr-2 pt-2 transition-opacity ease-out", stale && "opacity-60"\)/,
    );
    expect(declaration(read(ACTIVITY), 'ActivityBlock')).toMatch(
      /cn\("pr-2 pt-2 transition-opacity ease-out", stale && "opacity-60"\)/,
    );
  });

  it('a held window is busy for screen readers too, not only dimmed', () => {
    expect(stats).toMatch(/<div className="flex flex-col gap-12" aria-busy=\{stale\}>/);
  });

  it('a new window cross-fades in: the old copy leaves in 140ms into a 2px blur, the new one arrives in 200ms', () => {
    expect(stats).toMatch(/const WINDOW_BEAT: Beat = \{ out: 0\.14, in: 0\.2 \};/);
    // each readout stays mounted, so focus on it survives a new window: only its face cross-fades
    expect(stats).toMatch(
      /<PickReadout key=\{spec\.key\} label=\{spec\.label\} on=\{pick === spec\.key\} onPick=\{\(\) => setPick\(spec\.key\)\}>\s*<Swap k=\{key\} beat=\{WINDOW_BEAT\}>\s*<Readout\b/,
    );
    expect(stats).not.toMatch(/<Swap[^>]*>\s*<(?:ReadoutRow|PickReadout)\b/);
    expect(stats).toMatch(/const key = still \? "still" : shown;/);
    const swap = declaration(stats, 'Swap');
    expect(swap).toMatch(/<AnimatePresence initial=\{false\} mode="popLayout">/);
    expect(swap).toMatch(/<div ref=\{box\} className="relative">/);
    const copy = declaration(stats, 'SwapCopy');
    expect(copy).toMatch(/initial=\{\{ opacity: 0, \.\.\.blur \}\}/);
    expect(copy).toMatch(/const blur = still \? \{\} : \{ filter: "blur\(2px\)" \};/);
    expect(copy).toMatch(/\{ duration: beat\.in, delay: 0\.04, ease: EASE_OUT \}/);
    expect(copy).toMatch(
      /exit=\{\{ opacity: 0, \.\.\.blur, transition: \{ duration: still \? 0\.15 : beat\.out, ease: EASE_OUT \} \}\}/,
    );
    // no filter stays on a copy at rest
    expect(copy).toMatch(/transitionEnd: \{ filter: "none" \}/);
    // the leaving copy takes no pointer, focus or reader
    expect(copy).toMatch(/const present = useIsPresent\(\);/);
    expect(copy).toMatch(/inert=\{!present\}/);
    expect(stats).toMatch(/import \{ EASE_OUT \} from ['"]@\/lib\/motion-curves['"];/);
  });

  it('focus inside a copy that leaves moves to the same control in the copy that arrives, before the browser drops it', () => {
    // the browser blurs an element under a new inert ancestor at its next rendering update; a layout effect runs first
    const swap = declaration(stats, 'Swap');
    expect(swap).toMatch(/useLayoutEffect\(\(\) => \{[\s\S]*\}, \[k\]\);/);
    expect(swap).toContain('leaving: c.hasAttribute("inert")');
    expect(swap).toMatch(/focusHandOff\(copies, active\)\?\.focus\(\{ preventScroll: true \}\);/);
    expect(stats).toMatch(/^export function focusHandOff<E>\(/m);
  });

  it('the active range is one ink cell that slides to the next, 200ms on the explorer curve', () => {
    const range = read(RANGE);
    const control = declaration(range, 'ExplorerRangeControl');
    expect(range).toMatch(/import \{ EASE_DRAWER \} from ['"]@\/lib\/motion-curves['"];/);
    expect(control.match(/layoutId=/g)).toHaveLength(1);
    expect(control).toMatch(
      /\{active && \(\s*<motion\.span\s+layoutId="explorer-range-cell"\s+transition=\{still \? \{ duration: 0 \} : \{ duration: 0\.2, ease: EASE_DRAWER \}\}\s+className="absolute inset-0 bg-zinc-900 dark:bg-zinc-50"/,
    );
    // the label rides above the cell; the cell, not the button, carries the ink
    expect(control).toMatch(/<span className="relative">\{label\}<\/span>/);
    expect(control).toMatch(/\? "text-zinc-50 dark:text-zinc-900"/);
    expect(control).not.toMatch(/"bg-zinc-900 text-zinc-50/);
    expect(control).toMatch(/const still = useReducedMotion\(\);/);
  });

  it('under Reduce Motion a window dims and swaps in place with a 150ms opacity fade: no blur, no sliding cell', () => {
    // the same copy stays, so its dim lifts in place over the stylesheet's 150ms opacity fade
    expect(stats).toMatch(/const still = useReducedMotion\(\);/);
    expect(stats).toMatch(/const key = still \? "still" : shown;/);
    const copy = declaration(stats, 'SwapCopy');
    expect(copy).toMatch(/\.\.\.\(still \? \{\} : \{ filter: "blur\(0px\)" \}\)/);
    expect(copy).toMatch(/transition: still \? \{ duration: 0\.15, ease: EASE_OUT \}/);
  });
});

describe('stats-chart-pick (a): the big chart shows that it changed when a readout picks it', () => {
  const stats = read(STATS);

  it('the chart cross-fades on a pick: the old leaves in 120ms into a 2px blur, the new arrives in 180ms', () => {
    expect(stats).toMatch(/const PICK_BEAT: Beat = \{ out: 0\.12, in: 0\.18 \};/);
    expect(stats).toMatch(
      /<Swap k=\{key\} beat=\{WINDOW_BEAT\}>\s*<Swap k=\{pick\} beat=\{PICK_BEAT\}>\s*\{chart\}\s*<\/Swap>\s*<\/Swap>/,
    );
  });

  it('nothing in the plot moves: a swap animates opacity and filter only', () => {
    const copy = declaration(stats, 'SwapCopy');
    expect(copy).not.toMatch(/\b(?:x|y|scale|scaleX|scaleY|rotate|translateX|translateY|transform|clipPath)\s*:/);
    expect(copy).not.toMatch(/\blayout\b/);
  });

  it('under Reduce Motion a pick is a 150ms opacity cross-fade with no blur', () => {
    // the pick still re-keys its copy under Reduce Motion; the window does not
    expect(stats).toMatch(/<Swap k=\{pick\} beat=\{PICK_BEAT\}>/);
    expect(declaration(stats, 'SwapCopy')).toMatch(/duration: still \? 0\.15 : beat\.out/);
  });
});

describe('exp-pick-focus: the readouts that pick the chart show keyboard focus', () => {
  const pick = declaration(read(PARTS), 'PickReadout');

  it('keyboard focus draws a 2px ring in the selection blue, 10px out, clear of the block faces', () => {
    expect(pick).toMatch(
      /className="relative cursor-pointer outline-offset-\[10px\] outline-\[#0061E2\] focus-visible:outline-2 dark:outline-\[#5f9dff\]"/,
    );
    expect(pick).not.toContain('focus-visible:outline-none');
    // reachable with Tab
    expect(pick).toContain('tabIndex={0}');
  });

  it('the ring clears 3:1 against the page in light and dark', () => {
    // the ring colours as PickReadout sets them; the grounds as measured on the page (white, and zinc-950 in dark)
    const dark = /\bdark:outline-\[(#[0-9a-fA-F]{6})\]/.exec(pick)?.[1];
    const light = /(?<!:)\boutline-\[(#[0-9a-fA-F]{6})\]/.exec(pick)?.[1];
    expect(light, 'the light ring colour').toBeDefined();
    expect(dark, 'the dark ring colour').toBeDefined();
    expect(contrast(String(light).toLowerCase(), '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(String(dark).toLowerCase(), '#09090b')).toBeGreaterThanOrEqual(3);
  });
});

describe('exp-copy-morph (a): copy buttons turn into a check', () => {
  const mark = read(MARK);
  const ui = read(UI);

  it('the copy and check icons sit stacked in one grid cell and cross-fade with a 2px blur and scale 0.9', () => {
    const copyMark = declaration(mark, 'CopyMark');
    expect(copyMark).toMatch(/<span aria-hidden className=\{cn\(['"]grid shrink-0 [^'"]*['"], className\)\}>/);
    expect(mark).toMatch(/const ICON = ['"]col-start-1 row-start-1 transition-\[opacity,scale,filter,color\]['"];/);
    expect(copyMark).toMatch(/<Copy className=\{cn\(ICON, size, idle, copied \? HIDDEN : SHOWN\)\} \/>/);
    expect(copyMark).toMatch(/<Check className=\{cn\(ICON, size, done, copied \? SHOWN : HIDDEN\)\} \/>/);
    // the leaving icon goes to opacity 0, scale 0.9 and a 2px blur in 120ms; the arriving one comes back in 180ms
    expect(mark).toMatch(
      /const HIDDEN = ['"]opacity-0 duration-120 ease-out motion-safe:scale-90 motion-safe:blur-\[2px\]['"];/,
    );
    expect(mark).toMatch(/const SHOWN = ['"]opacity-100 duration-180 ease-out['"];/);
    // the demo placed the check with getBoundingClientRect to patch a snapshot; the build stacks the two in a cell
    expect(mark).not.toContain('getBoundingClientRect');
  });

  it('the icon presses in to 0.95 in 120ms, with no press under Reduce Motion', () => {
    expect(declaration(mark, 'CopyMark')).toContain(
      'transition-[scale] duration-120 ease-out motion-safe:group-active/copy:scale-95',
    );
  });

  it('HashChip and SubjectHeadline wear the mark, keep their check colours and reset the timer on a second copy', () => {
    const chip = declaration(ui, 'HashChip');
    const headline = declaration(ui, 'SubjectHeadline');
    expect(ui).toMatch(/import \{ useCopiedFlash \} from ['"]@\/hooks\/use-copied-flash['"];/);
    expect(ui).toMatch(/import \{ CopyMark \} from ['"]\.\/copy-mark['"];/);
    expect(chip).toContain('const [copied, showCopied] = useCopiedFlash(1200);');
    expect(headline).toContain('const [copied, showCopied] = useCopiedFlash(1500);');
    expect(chip).toMatch(/<CopyMark copied=\{copied\} size="h-3 w-3" done="text-\[#E6212F\]" \/>/);
    expect(headline).toMatch(/<CopyMark\s+copied=\{copied\}\s+className="self-center"\s+size="h-4 w-4"/);
    expect(headline).toContain('done="text-emerald-600 dark:text-emerald-400"');
    for (const code of [chip, headline]) {
      expect(code).toMatch(/className="group\/copy /);
      expect(code).not.toMatch(/setTimeout\(\(\) => setCopied\(false\)/);
      expect(code).not.toMatch(/copied \? <Check|copied \? \(/);
    }
    expect(ui).not.toMatch(/import \{[^}]*\b(?:Check|Copy)\b[^}]*\} from ['"]lucide-react['"];/);
  });

  it('under Reduce Motion the icons cross-fade on opacity only: no scale, no blur', () => {
    // scale and blur ride motion-safe; the stylesheet's reduced-motion rule (site-reduced-motion-policy) keeps the
    // opacity fade at 150ms and runs no scale or filter transition
    expect(mark).not.toMatch(/(?<!motion-safe:)(?<![\w/-])(?:scale-90|blur-\[2px\])/);
    const reducer = cssBlock('site-reduced-motion-policy');
    expect(reducer).toMatch(/transition-duration: 150ms !important;/);
    const properties = /transition-property:([^;]+);/.exec(reducer)?.[1] ?? '';
    expect(properties).toMatch(/\bopacity\b/);
    expect(properties).not.toMatch(/\b(?:scale|filter|transform|all)\b/);
  });
});

describe('every file Task 16 touched', () => {
  it.each(TOUCHED)('%s has no transition-all and no ease-in', (file) => {
    const src = read(file);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });
});
