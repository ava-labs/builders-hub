/* The designer. Once the query has run, a second model looks at the
   question and the actual rows and decides how they should be shown:
   which panels, which chart in each, what the headline figures are,
   where a reference line belongs, and what a reader should notice.
   It speaks a small visual grammar the page knows how to draw. */

import { anthropic } from "./meter";
import { generateText, stepCountIs, tool } from "ai";
import { basicVisual } from "./draft";
import { labelError } from "./stat-label";
import { kindError } from "./kind-checks";
import { CALLOUT_SHOWN, HISTOGRAM_ROWS, TREEMAP_PARTS, visualSpecSchema, type VisualSpec } from "./visual-spec";
import { READER_RULES, codeWords, heldHex, readerSpec, rowWords, shownLength } from "./reader-words";
import { ALL_ROWS, EXTREME_NAME, MEAN_NAME, NUMERIC, RATE, distinctColumns, edgeOf, numOf, plain, rowsBrief, sampleOf, sharesOf, staleBrief, weightOf, weighted, withShares, type DesignInput } from "./figures";

export const DESIGN_MODEL = "claude-opus-5-5";
/** the designer runs at low effort: in 20 blind pairs its charts were rated as good as the default's (7 wins each, 6 ties), in about half the time */
export const DESIGN_OPTIONS = { anthropic: { effort: "low" as const } };

/** every label a visual shows the reader */
function labelsOf(v: VisualSpec): string[] {
  return [
    ...v.stats.flatMap((s) => [s.label, s.sub ?? ""]),
    ...v.panels.flatMap((p) => [p.title, ...p.series.map((s) => s.label), ...p.markers.map((m) => m.label), ...p.bands.map((b) => b.label), ...p.referenceLines.map((r) => r.label)]),
  ];
}

const HOUSE_STYLE = `You design the visual for an answer on the Avalanche explorer (build.avax.network). The page is a drafting sheet: mono labels, one red accent (#E6212F) then blue, teal, amber; thin lines; no decoration. Your job is to decide what a careful analyst would put on the sheet so the reader sees the answer in two seconds and can check it in ten.

Rules of the sheet
- Rankings (methods, contracts, senders) are horizontal bars (hbar) with the name on the axis, top 10 to 15, sorted by the figure that answers the question. A share or a reverted count that belongs to the same rows goes in a second half-width panel, not as a second series squeezed onto the same axis.
- Time series are lines; counts per period are bars; parts of a whole over time are stacked areas or stacked bars. Never put a count and a percent on the same axis; use axis "right" or a second panel.
- Gas reserved against a limit: a line with the limit as a reference line. Fees in AVAX use format avax. Gas figures use format gas (compact with the word gas). Percent columns use percent.
- Two to four headline stats across the top, the figures a developer would quote: the total, the leader's share, the failure rate when reverts matter, how many distinct callers. Labels are the plain noun a person says ("Transactions", "Reverted", "Callers", "Fees burned"), never "Top 15 txs". Use agg over a column of the rows (sum for counts and fees, max for peaks, avg for rates, distinct for how many groups). A column that counts distinct ones in each row (active addresses, senders, holders) has no total over the rows, since one address can be in several: its stat is avg or max, never sum. No avg stat over a series whose first or last period Edges calls partial or still filling, and none over a column of averages that Figures weighs: that weighted average goes in a callout. The sub line gives the context in five words or fewer, with a name or figure where it helps ("sweep leads", "of all calls").
- Callouts: at most three sentences a developer would act on, each with a name and a figure from the rows: concentration (one sender behind a method), failure (a method that always reverts), cost (who pays the most gas). No adjectives, no restating the chart title. Do not mention the data window or coverage; the page shows it. No em dashes. Never say "settled" or "waiting". Each callout is one full sentence that ends with a period, at most ${CALLOUT_SHOWN} characters as the page shows it (an address or hash counts as 11). Write figures as people read them: 3.16M, 64.7k, 41.6%, Aug 30; never 3159411 or 1.395e+6.
- Figures are computed over all rows, and past ${ALL_ROWS} rows the rows shown are a sample: take every peak, low, total, first and last value, and the row that holds it, from Figures, and put a peak's marker at the x Figures names. When Figures says the rows are cut, never call a sum over them the total.
- ${READER_RULES}
- Panel titles: two to four plain words, no "by" chains longer than one.
Comparisons and overlays (use them whenever the rows hold more than one thing to compare)
- Two groups or two periods in columns (usdc_*, usdt_*; current_*, previous_*): overlay them in ONE panel. The baseline or previous period is dashed.
- Things of very different size (a token with 1,000x the volume of another): transform "indexed" rebases each to 100 at its first point, so shape is compared, not size. Say so in the panel title ("indexed to 100").
- Parts of a whole over time: transform "share" on each part plus stacked area, so each period sums to 100%.
- Running totals: transform "cumulative". Noisy per-minute series: add a "rolling" copy of the same column as a thin line over the raw bars.
- A count and a rate together: bars (mark "bar") on the left axis, the rate as a line (mark "line") on the right axis.
- Ins and outs per period (deposits and withdrawals, bought and sold, bridged in and out): one bar series for each side, the outflow with below true, so each period's ins stand above zero and its outs below; set net true on the panel for a line of each period's net. Never draw ins and outs as two lines or as bars side by side.
- Two numeric measures per group or per record (gas against fee, calls against callers): kind "scatter", x the first measure, one series the second.
- Flows: when the question asks where value went, from whom or to whom, and each row is a pair (a column value comes from, a column it goes to, names or addresses, and the amount between them), use kind "flow" at full width: x is the column value comes from, target the column it goes to, and the one series the amount. The page draws the largest 30 flows and folds the rest into Other; a receiver that sends on becomes a second stage. A name stands in one row per partner, so never put an hbar or a pie over such rows: it would show one sender many times. Rows with one name each (who received the most) stay an hbar.
- A figure beside the same figure of the period before, one row for each name (this_week and last_week, current and previous): kind "dumbbell", x the name, two series, the figure now then the figure before. Never draw such a pair as two hbar series.
- A signed figure for each name, with values on both sides of zero (a change, a net flow): kind "diverging", one series.
- How values are spread, when each row is one record and there are ${HISTOGRAM_ROWS} rows or more (transfer sizes, gas per transaction, stake per validator): kind "histogram", x the number column, one series the same column. Never rank records by size with their times on the axis.
- One value for each pair of two categories (hour of day by weekday, protocol by day): kind "heatmap", x the column across, y the column down, one series the value.
- How a whole divides among ${TREEMAP_PARTS} parts or more whose figures add up (gas per contract, stake per validator, volume per pool): kind "treemap", x the name, one series the size. Use hbar when the order matters more than the share.
- One ranking for each set of rows: never draw three rankings of the same names. Rank the figure that answers the question, give it at most one supporting panel, and put the other measures in a table panel.
- Markers: put one on the peak and on anything a callout names. Bands: shade the window the question compares.
- A strong answer usually has one overlay panel that makes the comparison and one supporting panel that explains it.

- Only reference columns that exist. Panel titles are four words or fewer. Half-width panels come in pairs.`;

export async function designVisual(input: DesignInput): Promise<{ visual: VisualSpec; ms: number; fromDesigner: boolean; error?: string; steps: number; refused: string[] }> {
  const t0 = Date.now();
  const fallback = basicVisual(input.chart, input.columns);
  if (input.rows.length === 0) return { visual: fallback, ms: 0, fromDesigner: false, steps: 0, refused: [] };
  let error: string | undefined;

  const seen = { ...input, x: input.x ?? input.chart.x };
  const sample = sampleOf(seen).rows;
  const shares = sharesOf(seen);
  const cols = new Set(input.columns.map((c) => c.name));
  const shown = rowWords(input.rows, input.names);

  let visual: VisualSpec | null = null;
  let relabeled = false;
  // what a slow layout's timing shows: the model's steps, and each visual turned back by the design tool's checks or its schema
  let steps = 0;
  const refused: string[] = [];
  const tally = ({ steps: taken = [] }: { steps?: { content: { type: string; error?: unknown }[] }[] }) => {
    steps += taken.length;
    for (const c of taken.flatMap((s) => s.content)) if (c.type === "tool-error") refused.push(String(c.error instanceof Error ? c.error.message : c.error).slice(0, 200));
  };
  const perRow = distinctColumns(input.columns, input.sql);
  // each column of per-row averages that Figures weighs, with the mean of its rows and the weighted average
  const weighable = new Map<string, { mean: number; weighted: number; by: string }>();
  for (const c of input.rows.length > 1 ? input.columns : []) {
    const w = MEAN_NAME.test(c.name) ? weightOf(input.columns, c) : null;
    const v = w ? weighted(c, w, input.rows) : null;
    const nums = input.rows.map((r) => numOf(c, r[c.name])).filter((n): n is number => n !== null);
    const mean = nums.reduce((p, q) => p + q, 0) / nums.length;
    if (w && v !== null && nums.length && Math.abs(mean - v) > Math.abs(v) * 0.005) weighable.set(c.name, { mean, weighted: v, by: w.name });
  }
  const check = (spec: VisualSpec): { error: string } | { ok: true } => {
    const bad = [
      ...spec.stats.filter((s) => !cols.has(s.column)).map((s) => `stat ${s.label} -> ${s.column}`),
      ...spec.panels.flatMap((p) => [...(p.x && !cols.has(p.x) ? [`panel x ${p.x}`] : []), ...(p.target && !cols.has(p.target) ? [`panel target ${p.target}`] : []), ...p.series.filter((s) => !cols.has(s.column)).map((s) => `series ${s.column}`), ...(p.sortBy && !cols.has(p.sortBy) ? [`sortBy ${p.sortBy}`] : [])]),
    ];
    if (bad.length) return { error: `these columns are not in the rows: ${bad.join("; ")}. Columns: ${[...cols].join(", ")}` };
    // a sum over the rows counts a distinct thing once for each row it is in
    const summed = input.rows.length > 1 ? spec.stats.filter((s) => s.agg === "sum" && perRow.has(s.column)) : [];
    if (summed.length) return { error: `${summed.map((s) => s.column).join(", ")} counts distinct ones in each row, so a sum over the rows counts one that is in several rows once for each: use avg or max, or leave the stat out` };
    // an average of a count over a series whose first or last period is partial counts it as a whole one (the regression
    // audit's R16: "1,694 a day" with today's 8.8 hours in it, where the 14 whole days average 1,745.8)
    const edge = edgeOf(seen);
    const thin = edge && (edge.first || edge.last) ? spec.stats.filter((s) => s.agg === "avg" && !MEAN_NAME.test(s.column) && !RATE.test(s.column)) : [];
    if (thin.length) return { error: `the ${edge!.last ? "last" : "first"} period of these rows is partial, so an average over them counts it as a whole one: ${thin.map((s) => s.column).join(", ")} needs max, a total or no stat` };
    // the rows' own averages averaged weigh a thin row as much as a full one (the follow-up audit's T02: "average base
    // fee 2.16 gwei" over its hours, where the blocks' own average is 1.78): Figures gives the weighted one
    const unweighted = spec.stats.filter((s) => s.agg === "avg" && weighable.has(s.column));
    if (unweighted.length) {
      const why = unweighted.map((s) => {
        const w = weighable.get(s.column)!;
        return `avg over ${s.column} weighs each row's average alike (${plain(w.mean)}), where the average over what the rows count is ${plain(w.weighted)} (weighted by ${w.by})`;
      });
      return { error: `${why.join("; ")}: give that figure in a callout, and show max or min here, or leave the stat out` };
    }
    const averaged = input.rows.length > 1 ? spec.stats.filter((s) => s.agg === "sum" && (MEAN_NAME.test(s.column) || EXTREME_NAME.test(s.column))) : [];
    if (averaged.length) return { error: `${averaged.map((s) => s.column).join(", ")} holds an average or an extreme in each row, so a sum over the rows means nothing: use avg or max, or leave the stat out` };
    // a stat is named for its figure (the whole answer's, a share as a percent) and a stack adds up parts of a whole
    const label = labelError(spec, input.rows, input.totals, input.sql);
    if (label) return { error: label };
    // each kind draws rows of its own shape (kind-checks.ts)
    const unfit = kindError(spec.panels, input.columns, input.rows, input.sql, !!input.totals && input.totals.rows > input.rows.length);
    if (unfit) return { error: unfit };
    // a flow runs from one column to another and draws one amount
    const flows = spec.panels.filter((p) => p.kind === "flow");
    if (flows.some((p) => !p.target || p.target === p.x || p.series.length !== 1)) return { error: "a flow panel needs x (the column value comes from), target (the column it goes to, not x) and one series (the amount)" };
    const text = flows.map((p) => p.series[0].column).filter((c) => !NUMERIC.test(input.columns.find((k) => k.name === c)?.type ?? ""));
    if (text.length) return { error: `a flow's series is the amount that moved: ${text.join(", ")} is not a number column` };
    // a ranking draws one bar per row: a name that repeats in the rows (a sender with several partners) would stand there several times
    const repeats = [...new Set(spec.panels.filter((p) => p.kind === "hbar" && p.x && new Set(input.rows.map((r) => String(r[p.x!]))).size < input.rows.length).map((p) => p.x!))];
    if (repeats.length) return { error: `an hbar draws one bar per row, and ${repeats.join(", ")} repeats in these rows: rank a column that names each row once, or leave the ranking out` };
    // a net is what came in less what went out: it needs an outflow drawn below zero
    if (spec.panels.some((p) => p.net && !p.series.some((s) => s.below))) return { error: "net draws each period's ins less its outs: give the outflow series below: true, or leave net out" };
    // a callout's cap counts it as the page shows it, each full address and hash short
    const long = spec.callouts.map((c, i) => ({ i, n: shownLength(c) })).filter((c) => c.n > CALLOUT_SHOWN);
    if (long.length) return { error: `a callout holds ${CALLOUT_SHOWN} characters as the page shows it, with each address and hash counted as 11: ${long.map((c) => `callout ${c.i + 1} has ${c.n}`).join(", ")}. Shorten it and call design again.` };
    // the reader never sees the columns: labels and callouts that name one are written again once, then read as words
    const named = codeWords([...labelsOf(spec), ...spec.callouts].join("\n"), [...cols], shown);
    if (named.length && !relabeled) {
      relabeled = true;
      return { error: `the labels or callouts have ${named.join(", ")}, words the page never shows: the reader never sees the columns, and a transaction is final, never settled. Use plain words ("Seen in 7 days", not seen_7d; final, not settled) and call design again.` };
    }
    // a share a callout misses by less than its last digit reads the one Figures gives
    const read = readerSpec(spec, [...cols], heldHex(input), shown);
    visual = { ...read, callouts: read.callouts.map((c) => withShares(c, shares)) };
    return { ok: true };
  };
  const design = tool({
    description: "The visual for this answer: headline stats, one to four panels, callouts.",
    inputSchema: visualSpecSchema,
    execute: async (spec) => {
      const r = check(spec);
      if ("error" in r) refused.push(r.error.slice(0, 200));
      return r;
    },
  });

  try {
    const r = await generateText({
      model: anthropic(DESIGN_MODEL, input.spent),
      providerOptions: DESIGN_OPTIONS,
      // the house style is the same for every answer; read it from the cache
      system: { role: "system", content: HOUSE_STYLE, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question}`,
            `Title from the query stage: ${input.title}`,
            `Note from the query stage: ${input.note}`,
            ...staleBrief(input.anchor),
            `Native token: ${input.symbol}. Rows: ${input.rows.length}${input.totals && input.totals.rows > input.rows.length ? ` of ${input.totals.rows}` : ""}.`,
            ...rowsBrief(seen),
            `Call the design tool exactly once with the visual. If it returns an error, call it again with the fix. Do not answer in prose.`,
          ].join("\n"),
        },
      ],
      tools: { design },
      // the design call ends the run: the prose a model writes after it is read by nothing
      stopWhen: [stepCountIs(3), () => visual !== null],
      maxRetries: 1,
    });
    tally(r);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn("[explorer-query] designer failed:", error);
  }
  // the designer may have been told its columns were wrong once; give it one more turn
  if (!visual) {
    try {
      const r = await generateText({
        model: anthropic(DESIGN_MODEL, input.spent),
        providerOptions: DESIGN_OPTIONS,
        system: HOUSE_STYLE,
        messages: [{ role: "user", content: `Question: ${input.question}\nColumns: ${[...cols].join(", ")}\nRows: ${input.rows.length}\nFirst rows:\n${sample.slice(0, 8).map((r) => JSON.stringify(r)).join("\n")}\nCall design once, using only these columns.` }],
        tools: { design },
        stopWhen: [stepCountIs(2), () => visual !== null],
        maxRetries: 1,
      });
      tally(r);
    } catch (e) {
      error = `${error ?? ""} | retry: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { visual: visual ?? fallback, ms: Date.now() - t0, fromDesigner: !!visual, error, steps, refused };
}
