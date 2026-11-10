import { describe, expect, it } from "vitest";
import { comparedTo } from "@/components/explorer-v2/evm/query/compare";
import { nextAsks } from "@/components/explorer-v2/evm/query/followups";
import type { Finding } from "@/components/explorer-v2/evm/query/findings";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";

/* The next step after an answer: the answer beside the period before it, and the questions it raises. */

const series = (column: string, label: string) => ({ column, label, format: "number" as const, axis: "left" as const, mark: "auto" as const, transform: "none" as const, dashed: false });
const panel = (kind: "hbar" | "bar" | "line", x: string, cols: [string, string][]) => ({ title: "p", kind, x, series: cols.map(([c, l]) => series(c, l)), markers: [], bands: [], stacked: false, sortDir: "desc" as const, referenceLines: [], width: "full" as const });
const visual = (...panels: ReturnType<typeof panel>[]): VisualSpec => ({ stats: [], panels, callouts: [] });

describe("comparedTo", () => {
  it("draws a ranking as each row's figure now beside the same figure before", () => {
    const rows = [{ dex: "a", vol: 30 }, { dex: "b", vol: 20 }, { dex: "c", vol: 10 }];
    const prior = { rows: [{ dex: "b", vol: 5 }, { dex: "a", vol: 40 }], totals: null };
    const out = comparedTo(visual(panel("hbar", "dex", [["vol", "Volume"]])), rows, prior, "Prior 7 days")!;
    expect(out.visual.panels[0]).toMatchObject({ kind: "dumbbell", series: [{ column: "vol", label: "Volume" }, { column: "vol__before", label: "Prior 7 days" }] });
    expect(out.rows).toEqual([{ dex: "a", vol: 30, vol__before: 40 }, { dex: "b", vol: 20, vol__before: 5 }, { dex: "c", vol: 10, vol__before: null }]);
    // a mark opens the answer's own row
    expect(out.origin.get(out.rows[1])).toBe(rows[1]);
  });

  it("draws the period before a series as a dashed line, bucket for bucket", () => {
    const rows = [{ t: "2026-11-10 02:00:00", txs: 3 }, { t: "2026-11-10 00:00:00", txs: 1 }, { t: "2026-11-10 01:00:00", txs: 2 }];
    const prior = { rows: [{ t: "2026-11-09 21:00:00", txs: 7 }, { t: "2026-11-09 22:00:00", txs: 8 }, { t: "2026-11-09 23:00:00", txs: 9 }], totals: null };
    const out = comparedTo(visual(panel("bar", "t", [["txs", "Transactions"], ["reverted", "Reverted"]])), rows, prior, "Prior 3 hours")!;
    expect(out.visual.panels[0].kind).toBe("bar");
    expect(out.visual.panels[0].series.at(-1)).toMatchObject({ column: "txs__before", label: "Prior 3 hours", mark: "line", dashed: true });
    expect(out.rows.map((r) => [r.t, r.txs__before])).toEqual([["2026-11-10 00:00:00", 7], ["2026-11-10 01:00:00", 8], ["2026-11-10 02:00:00", 9]]);
    expect(out.origin.get(out.rows[0])).toBe(rows[1]);
  });

  it("offers nothing when no chart can show both", () => {
    const rows = [{ dex: "a", vol: 30 }, { dex: "b", vol: 20 }];
    const v = visual(panel("hbar", "dex", [["vol", "Volume"]]));
    expect(comparedTo(v, rows, null, "x")).toBeNull();
    expect(comparedTo(v, rows, { rows: [], totals: null }, "x")).toBeNull();
    // no row of the ranking was in the period before
    expect(comparedTo(v, rows, { rows: [{ dex: "z", vol: 1 }], totals: null }, "x")).toBeNull();
    expect(comparedTo(null, rows, { rows, totals: null }, "x")).toBeNull();
    // a series whose periods before do not line up with its own
    const hours = [0, 1, 2, 3].map((h) => ({ t: `2026-11-10 0${h}:00:00`, txs: h }));
    expect(comparedTo(visual(panel("line", "t", [["txs", "Transactions"]])), hours, { rows: hours.slice(0, 2), totals: null }, "x")).toBeNull();
  });
});

describe("nextAsks", () => {
  const finding = (ask?: string): Finding => ({ kind: "peak", tag: "Peak", text: "t", tone: "plain", score: 1, ask });

  it("asks what the findings raise first, then what the answer offers, each once", () => {
    const out = nextAsks([finding("What drove the peak at 08:30 UTC?"), finding(), finding("Which contracts reverted most?"), finding("A third")], ["Which contracts reverted most", "Split by sender", "Show fees"]);
    expect(out).toEqual(["What drove the peak at 08:30 UTC?", "Which contracts reverted most?", "Split by sender", "Show fees"]);
  });

  it("offers five at most, and none for an answer with none", () => {
    expect(nextAsks([], ["a b", "c d", "e f", "g h", "i j", "k l"])).toHaveLength(5);
    expect(nextAsks([], undefined)).toEqual([]);
  });
});
