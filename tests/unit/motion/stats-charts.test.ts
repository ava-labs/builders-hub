import { readdirSync } from 'node:fs';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tooltip, type TooltipProps } from 'recharts';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { UNFOLD_MS, foldOn, type Fold } from '@/components/explorer-v2/defi/ProtocolTable';
import { dayBand, dayLine } from '@/components/explorer-v2/evm/metric-charts';
import { TOOLTIP_DEFAULTS } from '@/components/explorer-v2/staking/bits';
import { cssBlock, declaration, read } from './helpers';

/**
 * Task 17 of the hub motion pass, the stats charts: stats-tip-follows (a), stats-synced-days (a), stats-bar-band (a)
 * and stats-protocol-rows (a). Specs: .scratch/hub-motion/proposals/80-stats.js.
 */
const BITS = 'components/explorer-v2/staking/bits.tsx';
const CHARTS = 'components/explorer-v2/evm/metric-charts.tsx';
const METRIC_PAGE = 'components/explorer-v2/staking/StakingMetricPage.tsx';
const PRIMARY = 'components/explorer-v2/staking/PrimaryStaking.tsx';
const TXS = 'components/explorer-v2/evm/EvmTxsList.tsx';
const TABLE = 'components/explorer-v2/defi/ProtocolTable.tsx';
const DEFI = 'components/explorer-v2/defi/DefiProtocols.tsx';
/** the explorer chart files whose tooltips took the shared default after Task 17 */
const TIP_FILES = [
  'components/explorer-v2/staking/rate-curves.tsx',
  'components/explorer-v2/staking/PrimaryValidators.tsx',
  'components/explorer-v2/staking/BucketBars.tsx',
  'components/explorer-v2/staking/L1Economy.tsx',
  'components/explorer-v2/network/NetworkStablecoins.tsx',
  'components/explorer-v2/evm/EvmAccounts.tsx',
  'components/explorer-v2/evm/QueryRows.tsx',
  'components/explorer-v2/defi/rwa-chart.tsx',
  'components/explorer/IcmMessagesPage.tsx',
];
const TOUCHED = [BITS, CHARTS, METRIC_PAGE, PRIMARY, TXS, TABLE, DEFI, ...TIP_FILES];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;

interface Element {
  line: number;
  /** attribute names in source order; a spread reads `...expression` */
  attrs: string[];
  /** each named attribute's value as written */
  values: Record<string, string>;
}

/** The JSX elements in `file` whose tag is `tag`; 'recharts Tooltip' finds recharts' Tooltip under the name the file imports it as. */
function elements(file: string, tag: string): Element[] {
  const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>(tag === 'recharts Tooltip' ? [] : [tag]);
  if (tag === 'recharts Tooltip') {
    for (const s of sf.statements) {
      if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.moduleSpecifier.text !== 'recharts')
        continue;
      const bindings = s.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const e of bindings.elements) if ((e.propertyName ?? e.name).text === 'Tooltip') names.add(e.name.text);
    }
  }
  const found: Element[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && names.has(node.tagName.getText(sf))) {
      const attrs: string[] = [];
      const values: Record<string, string> = {};
      for (const p of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(p)) {
          attrs.push(`...${p.expression.getText(sf)}`);
        } else {
          const name = p.name.getText(sf);
          attrs.push(name);
          values[name] = p.initializer ? p.initializer.getText(sf) : 'true';
        }
      }
      found.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, attrs, values });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** An import from recharts, in either quotes. */
const RECHARTS_IMPORT = /from ['"]recharts['"]/;

/** Every .tsx file of the explorer (components/explorer-v2 and components/explorer) that imports recharts. */
const rechartsFiles = (): string[] =>
  ['components/explorer-v2', 'components/explorer'].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => `${dir}/${file}`)
      .filter((file) => RECHARTS_IMPORT.test(read(file))),
  );

describe('stats-tip-follows (a): a chart readout moves with the crosshair', () => {
  it('the readout default has one home, beside the tooltip plate: no glide', () => {
    expect(TOOLTIP_DEFAULTS).toEqual({ isAnimationActive: false });
    expect(read(BITS)).toMatch(/^export const TOOLTIP_DEFAULTS = \{ isAnimationActive: false \} as const;$/m);
    for (const file of [CHARTS, METRIC_PAGE, PRIMARY]) expect(read(file)).not.toMatch(/\bconst TOOLTIP_DEFAULTS\b/);
  });

  it('recharts glides the readout only while isAnimationActive is on, so the default drops the 400ms lag', () => {
    // recharts 2.15 sets the glide on the readout's wrapper (TooltipBoundingBox): transform 400ms ease
    // (its class types defaultProps.animationEasing as a plain string, which createElement's overloads refuse)
    const ReadoutTooltip = Tooltip as ComponentType<TooltipProps<number, string>>;
    const props = {
      active: true,
      coordinate: { x: 40, y: 20 },
      payload: [{ name: 'a', value: 1, dataKey: 'a', payload: { a: 1 } }],
      viewBox: { x: 0, y: 0, width: 300, height: 150 },
    };
    expect(renderToStaticMarkup(createElement(ReadoutTooltip, { ...props, isAnimationActive: true }))).toContain(
      'transition:transform 400ms ease',
    );
    expect(renderToStaticMarkup(createElement(ReadoutTooltip, { ...TOOLTIP_DEFAULTS, ...props }))).not.toContain(
      'transition',
    );
  });

  it.each([
    [CHARTS, 1],
    [METRIC_PAGE, 7],
    [PRIMARY, 7],
  ])('every recharts Tooltip in %s starts from the shared default and sets no glide of its own (%i)', (file, n) => {
    const tips = elements(file, 'recharts Tooltip');
    expect(tips).toHaveLength(n);
    for (const tip of tips) {
      expect(tip.attrs[0], `${file}:${tip.line}`).toBe('...TOOLTIP_DEFAULTS');
      expect(tip.attrs, `${file}:${tip.line}`).not.toContain('isAnimationActive');
    }
  });

  it('no recharts Tooltip in the explorer glides: each spreads the shared default or turns the glide off', () => {
    const files = rechartsFiles();
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain('components/explorer/IcmMessagesPage.tsx');
    // the spread comes before every prop (a list's key aside), so a chart can still set its own on top of it
    const first = (attrs: string[]) => attrs.filter((attr) => attr !== 'key')[0];
    const gliding = files.flatMap((file) =>
      elements(file, 'recharts Tooltip')
        .filter((tip) => first(tip.attrs) !== '...TOOLTIP_DEFAULTS' && tip.values.isAnimationActive !== '{false}')
        .map((tip) => `${file}:${tip.line}`),
    );
    expect(gliding).toEqual([]);
    // the default has one home
    for (const file of files) if (file !== BITS) expect(read(file), file).not.toMatch(/\bconst TOOLTIP_DEFAULTS\b/);
  });

  it('the sweep picks a file by its recharts import in either quotes', () => {
    expect(RECHARTS_IMPORT.test(`import { Tooltip } from "recharts";`)).toBe(true);
    expect(RECHARTS_IMPORT.test(`import { Tooltip } from 'recharts';`)).toBe(true);
    expect(RECHARTS_IMPORT.test(`import { scale } from 'recharts-scale';`)).toBe(false);
  });
});

describe('stats-synced-days (a): the two transaction charts read the same day together', () => {
  it('DualChart takes a syncId and matches the other chart by date, not by position', () => {
    const chart = declaration(read(CHARTS), 'DualChart');
    expect(chart).toMatch(/\bsyncId\?: string;/);
    const [composed] = elements(CHARTS, 'ComposedChart');
    expect(composed.values.syncId).toBe('{syncId}');
    // by date: a chart missing a day shows no readout rather than a different day's
    expect(composed.values.syncMethod).toBe('"value"');
  });

  it('the transactions list hands both its charts one syncId constant', () => {
    const charts = elements(TXS, 'DualChart');
    expect(charts).toHaveLength(2);
    const ids = charts.map((c) => c.values.syncId);
    expect(ids[0]).toMatch(/^\{[A-Z_]+\}$/);
    expect(ids[1]).toBe(ids[0]);
    const name = ids[0].slice(1, -1);
    expect(read(TXS)).toMatch(new RegExp(`^const ${name} = "[\\w-]+";$`, 'm'));
  });

  it('each chart keeps one series object between renders, so the synced chart holds the hovered date', () => {
    // recharts re-reads the hovered day from the stored pointer x whenever a chart's data changes; for the synced
    // chart that x is the other chart's, a day off near a day's edge (bars and area place days differently). The
    // live list above re-renders the page many times a second, so the series change only with the metrics.
    const txs = read(TXS);
    expect(txs).toContain(
      'const txSeries = useMemo(() => metricSeries(metrics ?? {}, range, "txCount", "avgTps"), [metrics, range]);',
    );
    expect(txs).toContain(
      'const totalSeries = useMemo(() => metricSeries(metrics ?? {}, range, "cumulativeTxCount"), [metrics, range]);',
    );
    expect(elements(TXS, 'DualChart').map((c) => c.values.data)).toEqual(['{txSeries}', '{totalSeries}']);
    // no series is built afresh in the render
    expect(txs.match(/metricSeries\(/g)).toHaveLength(2);
  });
});

describe('stats-bar-band (a): a bar chart marks the whole day it reads', () => {
  // the C-Chain transactions chart as recorded on the page: a 619px plot, 5px down, 166px tall, 30 days
  const at = (x: number) => ({
    points: [
      { x, y: 5 },
      { x, y: 171 },
    ],
    width: 619,
    payloadIndex: 14,
  });

  it('the band is one day wide, centred on the crosshair, and spans the plot height', () => {
    const band = dayBand(at(304.183), 30);
    expect(band?.width).toBeCloseTo(619 / 30, 6);
    expect(band?.x).toBeCloseTo(304.183 - 619 / 60, 6);
    expect(band?.y).toBe(5);
    expect(band?.height).toBe(166);
  });

  it('the first and the last day fill their own slot, flush with the plot edges', () => {
    const day = 619 / 30;
    expect(dayBand(at(5 + day / 2), 30)?.x).toBeCloseTo(5, 6);
    const last = dayBand(at(5 + 619 - day / 2), 30);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBeCloseTo(5 + 619, 6);
  });

  it('draws nothing where there is no day to mark', () => {
    expect(dayBand({ ...at(304), payloadIndex: -1 }, 30)).toBeNull();
    expect(dayBand({ width: 619 }, 30)).toBeNull();
    expect(dayBand(at(304), 0)).toBeNull();
  });

  it('the area chart draws its hairline only on a day it holds, with the same guard as the band', () => {
    expect(dayLine(at(304))).toEqual([
      { x: 304, y: 5 },
      { x: 304, y: 171 },
    ]);
    // a synced chart that lacks the hovered date: recharts would draw the line at the plot's left edge
    expect(dayLine({ ...at(304), payloadIndex: -1 })).toBeNull();
    expect(dayLine({ width: 619 })).toBeNull();
    // the hairline keeps the look recharts gave it: a 1px Curve in zinc-400 at 35%
    const line = declaration(read(CHARTS), 'DayLine');
    expect(line).toMatch(/const line = dayLine\(cursor\);/);
    expect(line).toMatch(
      /<Curve points=\{line\} className=\{className\} stroke="rgba\(161,161,170,0\.35\)" pointerEvents="none" \/>/,
    );
    expect(declaration(read(CHARTS), 'dayBand')).toMatch(/const line = dayLine\(cursor\);/);
  });

  it('DualChart hovers bars with a Rectangle band in the fill it asked for, and areas with the guarded hairline', () => {
    const charts = read(CHARTS);
    const [tip] = elements(CHARTS, 'recharts Tooltip');
    expect(tip.values.cursor).toMatch(
      /^\{\s*kind === "bars"\s*\? <DayBand days=\{data\.length\} \/>\s*: <DayLine \/>\s*\}$/,
    );
    const band = declaration(charts, 'DayBand');
    // the one fill serves both themes: zinc-400 at 8% over the board, light or dark
    expect(band).toMatch(
      /<Rectangle \{\.\.\.band\} className=\{className\} fill="rgba\(161,161,170,0\.08\)" stroke="none" pointerEvents="none" \/>/,
    );
    expect(band).toMatch(/const band = dayBand\(cursor, days\);/);
  });

  it('the band sits behind the bars: recharts draws the cursor where the Tooltip sits, before the Bar', () => {
    const chart = declaration(read(CHARTS), 'DualChart');
    expect(chart.indexOf('<RechartsTooltip')).toBeGreaterThan(-1);
    expect(chart.indexOf('<RechartsTooltip')).toBeLessThan(chart.indexOf('<Bar'));
  });
});

describe('stats-protocol-rows (a): a DeFi protocol row unfolds instead of jumping open', () => {
  const table = read(TABLE);

  it('a panel folds when its row closes, and unfolds again from where it is when the row reopens mid-fold', () => {
    expect(foldOn('closed', true)).toBe('unfolding');
    expect(foldOn('unfolding', true)).toBe('unfolding');
    expect(foldOn('open', true)).toBe('open');
    expect(foldOn('open', false)).toBe('folding');
    expect(foldOn('unfolding', false)).toBe('folding');
    expect(foldOn('folding', false)).toBe('folding');
    // still in the page, it moves from where it is: no starting style
    expect(foldOn('folding', true)).toBe('open');
    expect(foldOn('closed', false)).toBe('closed');
  });

  it('switching rows folds the open one as the next one unfolds', () => {
    // the table opens one row at a time: the parent's one open id turns one row off and the other on together
    const rows = ['a', 'b', 'c'];
    const after = (state: Record<string, Fold>, open: string | null) =>
      Object.fromEntries(rows.map((id) => [id, foldOn(state[id], open === id)]));
    const first = after({ a: 'closed', b: 'closed', c: 'closed' }, 'a');
    expect(first).toEqual({ a: 'unfolding', b: 'closed', c: 'closed' });
    expect(after(first, 'c')).toEqual({ a: 'folding', b: 'closed', c: 'unfolding' });
    expect(after({ a: 'open', b: 'closed', c: 'closed' }, 'c')).toEqual({ a: 'folding', b: 'closed', c: 'unfolding' });
  });

  // A re-sort moves an open row's node, and a moved node takes its starting style again: a ~220px panel collapsed for
  // a frame and the rows below jumped. The starting style is the new panel's only.
  it('a re-sort never replays an unfold: the panel drops its starting style once it has unfolded', () => {
    const unfold = declaration(table, 'Unfold');
    expect(unfold).toMatch(/const starting = next === "unfolding";/);
    expect(unfold).toMatch(/starting && "starting:grid-rows-\[0fr\]"/);
    expect(unfold).toMatch(/starting && "starting:opacity-0"/);
    // every starting: class waits on that flag
    expect(unfold.match(/starting:/g)).toHaveLength(2);
    // an unfolding panel settles to open after the unfold, and a folding one to closed after the fold
    expect(table).toMatch(
      /^const SETTLE: Partial<Record<Fold, \[Fold, number\]>> = \{ unfolding: \["open", UNFOLD_MS\], folding: \["closed", FOLD_MS\] \};$/m,
    );
    // a panel open from its first render (a link with ?open=) unfolds too
    expect(unfold).toMatch(/useState<Fold>\(open \? "unfolding" : "closed"\)/);
  });

  it('each row hands its panel to the fold, so a closing panel stays for its fold', () => {
    expect(table).toMatch(/<Unfold open=\{isOpen\}>\s*<Detail p=\{p\} now=\{now\} \/>\s*<\/Unfold>/);
    expect(table).not.toMatch(/isOpen && <Detail/);
  });

  it('the panel unfolds from 0fr to 1fr in 220ms on the house ease-out while its content fades in over 180ms', () => {
    const unfold = declaration(table, 'Unfold');
    expect(unfold).toMatch(
      /"grid transition-\[grid-template-rows\] ease-out", starting && "starting:grid-rows-\[0fr\]", folding \? "grid-rows-\[0fr\] duration-160" : "grid-rows-\[1fr\] duration-220"/,
    );
    expect(unfold).toMatch(
      /"min-h-0 overflow-hidden transition-opacity ease-out", starting && "starting:opacity-0", folding \? "opacity-0 duration-160" : "opacity-100 duration-180"/,
    );
  });

  it('closing folds faster, in 160ms, then the panel leaves the DOM; it takes no focus or click while it folds', () => {
    expect(table).toMatch(/^const FOLD_MS = 160;$/m);
    const unfold = declaration(table, 'Unfold');
    expect(unfold).toMatch(/const next = foldOn\(fold, open\);\s*if \(next !== fold\) setFold\(next\);/);
    expect(unfold).toMatch(
      /const settle = SETTLE\[fold\];\s*if \(!settle\) return;\s*const t = setTimeout\(\(\) => setFold\(settle\[0\]\), settle\[1\]\);\s*return \(\) => clearTimeout\(t\);/,
    );
    expect(unfold).toMatch(/if \(next === "closed"\) return null;/);
    expect(unfold).toMatch(/<div inert=\{folding\} /);
  });

  it('the unfold length has one home, which the panel class and the page read', () => {
    expect(UNFOLD_MS).toBe(220);
    expect(table).toMatch(/^export const UNFOLD_MS = 220;$/m);
    expect(declaration(table, 'Unfold')).toContain(`"grid-rows-[1fr] duration-${UNFOLD_MS}"`);
    expect(read(DEFI)).toMatch(/^import \{[^}]*\bUNFOLD_MS\b[^}]*\} from ['"]\.\/ProtocolTable['"];$/m);
  });

  it('with motion on, the page centres an opened row once it has unfolded; under Reduce Motion at once, as before', () => {
    // centred two frames in, the scroll aimed at a row still unfolding under one still folding: at 390px the
    // header the reader clicked landed above the screen. The wait lets the scroll aim at the row's final place.
    const defi = read(DEFI);
    const effect = /const scrolled = useRef\(false\);[\s\S]*?\}, \[open, sorted, shown\]\);/.exec(defi)?.[0] ?? '';
    expect(effect).toContain(
      'const centre = () => document.getElementById(`defi-row-${open}`)?.scrollIntoView({ behavior: "smooth", block: "center" });',
    );
    expect(effect).toContain('const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;');
    // one pending centring at a time: a second open within the wait aims at its own row only
    expect(effect).toMatch(
      /clearTimeout\(centring\.current\);\s*if \(still\) requestAnimationFrame\(\(\) => requestAnimationFrame\(centre\)\);\s*else centring\.current = setTimeout\(centre, UNFOLD_MS\);/,
    );
    // the effect re-runs on setShown; a cleanup there would cancel the centring, so the timer lives in a ref
    expect(effect).not.toMatch(/return \(\) =>/);
    expect(defi).toMatch(/const centring = useRef<ReturnType<typeof setTimeout> \| undefined>\(undefined\);/);
    // and it never fires after the page has gone
    expect(defi).toMatch(/useEffect\(\(\) => \(\) => clearTimeout\(centring\.current\), \[\]\);/);
  });

  it('under Reduce Motion the panel opens in place and fades in over 150ms: the reducer runs no grid-rows transition', () => {
    const reducer = cssBlock('site-reduced-motion-policy');
    expect(reducer).toMatch(/transition-duration: 150ms !important;/);
    const properties = /transition-property:([^;]+);/.exec(reducer)?.[1] ?? '';
    expect(properties).toMatch(/\bopacity\b/);
    expect(properties).not.toMatch(/\b(?:grid-template-rows|height|all)\b/);
  });
});

describe('every file Task 17 touched', () => {
  it.each(TOUCHED)('%s has no transition-all and no ease-in', (file) => {
    const src = read(file);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });
});
