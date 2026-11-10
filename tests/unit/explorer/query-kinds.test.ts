import { describe, expect, it } from "vitest";
import { kindError } from "@/lib/explorer-query/kind-checks";
import { panelSchema, type Panel } from "@/lib/explorer-query/visual-spec";

/* What each chart kind needs of its rows, as the designer is told it. */

const panel = (p: Partial<Panel> & Pick<Panel, "kind">): Panel => panelSchema.parse({ title: "T", ...p });
const series = (...columns: string[]) => columns.map((column) => ({ column, label: column }));
const col = (name: string, type: string) => ({ name, type });

const DEX = {
  columns: [col("protocol", "String"), col("this_week_usd", "Float64"), col("last_week_usd", "Float64"), col("change_pct", "Float64"), col("avg_swap_usd", "Float64")],
  rows: [
    { protocol: "Pharaoh", this_week_usd: 126, last_week_usd: 86, change_pct: 47, avg_swap_usd: 2100 },
    { protocol: "Uniswap", this_week_usd: 35, last_week_usd: 12, change_pct: 203, avg_swap_usd: 570 },
    { protocol: "Arena", this_week_usd: 4, last_week_usd: 6, change_pct: -29, avg_swap_usd: 20 },
    { protocol: "WOOFi", this_week_usd: 3, last_week_usd: 2, change_pct: 99, avg_swap_usd: 1000 },
    { protocol: "Pangolin", this_week_usd: 1, last_week_usd: 1, change_pct: 59, avg_swap_usd: 48 },
    { protocol: "SushiSwap", this_week_usd: 1, last_week_usd: 0.4, change_pct: 231, avg_swap_usd: 2 },
  ],
};
const check = (p: Panel, d: { columns: { name: string; type: string }[]; rows: Record<string, unknown>[] } = DEX, cut = false) => kindError([p], d.columns, d.rows, undefined, cut);

describe("kindError", () => {
  it("passes the kinds the page had, and a table with nothing to draw", () => {
    expect(check(panel({ kind: "hbar", x: "protocol", series: series("this_week_usd") }))).toBeNull();
    expect(check(panel({ kind: "table" }))).toBeNull();
    expect(check(panel({ kind: "bar", series: series("this_week_usd") }))).toMatch(/needs x/);
  });

  it("wants a dumbbell's figure now and before, one row for each name", () => {
    expect(check(panel({ kind: "dumbbell", x: "protocol", series: series("this_week_usd", "last_week_usd") }))).toBeNull();
    expect(check(panel({ kind: "dumbbell", x: "protocol", series: series("this_week_usd") }))).toMatch(/two number series/);
    expect(check(panel({ kind: "dumbbell", x: "protocol", series: series("this_week_usd", "protocol") }))).toMatch(/two number series/);
    const twice = { ...DEX, rows: [...DEX.rows, DEX.rows[0]] };
    expect(check(panel({ kind: "dumbbell", x: "protocol", series: series("this_week_usd", "last_week_usd") }), twice)).toMatch(/repeats/);
  });

  it("wants values on both sides of zero for diverging bars", () => {
    expect(check(panel({ kind: "diverging", x: "protocol", series: series("change_pct") }))).toBeNull();
    expect(check(panel({ kind: "diverging", x: "protocol", series: series("this_week_usd") }))).toMatch(/all on one side.*use hbar/);
  });

  it("wants a histogram of one number column with enough values", () => {
    const many = { columns: [col("tx_hash", "String"), col("amount", "Float64")], rows: Array.from({ length: 40 }, (_, i) => ({ tx_hash: `0x${i}`, amount: i * 3.5 })) };
    expect(check(panel({ kind: "histogram", x: "amount", series: series("amount") }), many)).toBeNull();
    expect(check(panel({ kind: "histogram", x: "tx_hash", series: series("amount") }), many)).toMatch(/not a number column/);
    expect(check(panel({ kind: "histogram", x: "amount", series: series("tx_hash") }), many)).toMatch(/same column as its x/);
    expect(check(panel({ kind: "histogram", x: "this_week_usd", series: series("this_week_usd") }))).toMatch(/20 values or more/);
  });

  it("wants a heatmap of one value for each pair", () => {
    const grid = { columns: [col("weekday", "String"), col("hour", "UInt8"), col("txs", "UInt64")], rows: ["Mon", "Tue"].flatMap((weekday) => [0, 1, 2].map((hour) => ({ weekday, hour, txs: hour + 1 }))) };
    expect(check(panel({ kind: "heatmap", x: "hour", y: "weekday", series: series("txs") }), grid)).toBeNull();
    expect(check(panel({ kind: "heatmap", x: "hour", series: series("txs") }), grid)).toMatch(/needs x.*y/);
    expect(check(panel({ kind: "heatmap", x: "hour", y: "day", series: series("txs") }), grid)).toMatch(/needs x.*y/);
    expect(check(panel({ kind: "heatmap", x: "hour", y: "weekday", series: series("txs") }), { ...grid, rows: [...grid.rows, grid.rows[0]] })).toMatch(/a pair repeats/);
    expect(check(panel({ kind: "heatmap", x: "hour", y: "weekday", series: series("txs") }), { ...grid, rows: grid.rows.filter((r) => r.weekday === "Mon") })).toMatch(/two or more values on each side/);
  });

  it("wants a treemap of parts that add up to the whole", () => {
    expect(check(panel({ kind: "treemap", x: "protocol", series: series("this_week_usd") }))).toBeNull();
    // an average does not add up, and neither does a change
    expect(check(panel({ kind: "treemap", x: "protocol", series: series("avg_swap_usd") }))).toMatch(/does not add up/);
    expect(check(panel({ kind: "treemap", x: "protocol", series: series("change_pct") }))).toMatch(/does not add up|below zero/);
    expect(check(panel({ kind: "treemap", x: "protocol", series: series("this_week_usd") }), { ...DEX, rows: DEX.rows.slice(0, 4) })).toMatch(/6 parts or more/);
    // the first rows of a longer result are not the whole
    expect(check(panel({ kind: "treemap", x: "protocol", series: series("this_week_usd") }), DEX, true)).toMatch(/only its first rows/);
  });
});
