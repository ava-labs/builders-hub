import { describe, expect, it } from "vitest";
import { changeText, priorWords, statChange, statValue } from "@/components/explorer-v2/evm/query/stat-figures";
import { movedAnswer, type Moved } from "@/components/explorer-v2/evm/query/moved-answer";
import type { QueryAnswer, Totals } from "@/lib/explorer-query/types";

/* A headline figure against the period before, and an answer after a window button. */

const rows = (...txs: number[]) => txs.map((n, i) => ({ t: `2026-11-10 0${i}:00:00`, txs: n, pct: n / 10 }));
const sum = { column: "txs", agg: "sum", format: "number" } as const;

describe("statChange", () => {
  it("sets a figure against the same figure over the rows before", () => {
    const prior = { rows: rows(40, 60), totals: null };
    expect(statChange(sum, statValue(rows(50, 70), sum), prior)).toEqual({ text: "+20.0%", rose: true, before: 100 });
    expect(statChange({ ...sum, agg: "max" }, 45, prior)).toEqual({ text: "-25.0%", rose: false, before: 60 });
    expect(statChange({ ...sum, agg: "count" }, 3, prior)?.text).toBe("+50.0%");
  });

  it("moves a rate in points", () => {
    const prior = { rows: rows(40, 60), totals: null };
    expect(statChange({ column: "pct", agg: "max", format: "percent" }, 8.5, prior)).toEqual({ text: "+2.5 pp", rose: true, before: 6 });
    expect(statChange({ column: "pct", agg: "max", format: "percent" }, 5.75, prior)?.text).toBe("-0.25 pp");
  });

  it("counts the whole period before, past its LIMIT", () => {
    const totals: Totals = { rows: 900, newest: false, sum: { txs: 1000 }, count: { txs: 900 }, min: { txs: 0 }, max: { txs: 60 }, distinct: {} };
    expect(statChange(sum, 1500, { rows: rows(40, 60), totals })).toEqual({ text: "+50.0%", rose: true, before: 1000 });
  });

  it("says nothing with nothing to set the figure against", () => {
    const prior = { rows: rows(40, 60), totals: null };
    expect(statChange(sum, 100, null)).toBeNull();
    expect(statChange(sum, 100, { rows: [], totals: null })).toBeNull();
    // it did not move
    expect(statChange(sum, 100, prior)).toBeNull();
    // one row's value, and a name
    expect(statChange({ ...sum, agg: "last" }, 70, prior)).toBeNull();
    expect(statChange(sum, "0xabc", prior)).toBeNull();
  });

  it("calls a figure with nothing before it new", () => {
    expect(statChange(sum, 12, { rows: rows(0, 0), totals: null })?.text).toBe("new");
    expect(changeText(0, 0)).toBe("0%");
    expect(changeText(303, 100)).toBe("+203%");
  });
});

describe("priorWords", () => {
  it("names the period before a window", () => {
    expect(priorWords("last 6 hours")).toBe("prior 6 hours");
    expect(priorWords("last 7 days")).toBe("prior 7 days");
    expect(priorWords("today")).toBe("yesterday, to this time");
    expect(priorWords("this week")).toBe("last week, to this point");
    expect(priorWords(null)).toBe("the period before");
  });
});

describe("movedAnswer", () => {
  const from = {
    title: "Fees burned per 5 minutes in the last 6 hours",
    note: "n",
    span: "last 6 hours",
    sql: "A",
    chart: { kind: "line", x: "t", series: [] },
    drill: { sql: "D", title: "Transactions in the 5 minutes from {{t}}" },
    result: null,
    names: {},
    coverage: null,
    key: "k",
    visual: {
      stats: [{ label: "Peak 5 minutes", column: "fees", agg: "max", format: "avax" }],
      panels: [{ title: "Fees per 5 minutes", kind: "line", x: "t", series: [{ column: "fees", label: "Fees burned", format: "avax", axis: "left", mark: "line", transform: "none", dashed: false }], markers: [{ x: "2026-11-10 08:30:00", label: "Peak" }], bands: [], stacked: false, sortDir: "desc", referenceLines: [{ y: 1, label: "1 AVAX" }], width: "full" }],
      callouts: ["The peak was at 08:30."],
    },
  } as unknown as QueryAnswer;
  const out = { title: "Fees burned per hour in the last 7 days", note: "m", span: "last 7 days", sql: "B", drill: "E", result: { columns: [], rows: [], rowCount: 0 }, names: {}, totals: null, anchor: null, moves: { span: "7d", own: null, prior: true } } as unknown as Moved;

  it("keeps the layout, in the words of the new bucket, without what was about the first window", () => {
    const a = movedAnswer(from, out, "7d");
    expect(a.title).toBe("Fees burned per hour in the last 7 days");
    expect(a.sql).toBe("B");
    expect(a.drill).toEqual({ sql: "E", title: "Transactions in the hour from {{t}}" });
    expect(a.moves?.span).toBe("7d");
    expect(a.visual?.stats[0].label).toBe("Peak hour");
    expect(a.visual?.panels[0].title).toBe("Fees per hour");
    expect(a.visual?.panels[0].markers).toEqual([]);
    expect(a.visual?.panels[0].referenceLines).toHaveLength(1);
    expect(a.visual?.callouts).toEqual([]);
    // the kept recipe is the first window's
    expect(a.key).toBeUndefined();
  });

  it("drops a drill the route could not move", () => {
    expect(movedAnswer(from, { ...out, drill: null }, "7d").drill).toBeNull();
  });
});
