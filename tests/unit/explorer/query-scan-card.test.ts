import { describe, expect, it } from "vitest";
import { fixedRecipe } from "@/lib/explorer-query/fixed";
import { SPARK, cardOf } from "@/lib/explorer-query/scan-card";

/* What a suggestion's card shows before a click, from one run of its fixed SQL. */

const col = (name: string, type = "UInt64") => ({ name, type });

describe("cardOf", () => {
  it("gives a series its headline figure, its shape through time and what stands out", () => {
    const recipe = fixedRecipe(43114, "Transactions per 5 minutes, with reverts")!;
    const rows = Array.from({ length: 72 }, (_, i) => ({ t: new Date(Date.UTC(2026, 10, 10, 6, i * 5)).toISOString().slice(0, 19).replace("T", " "), txs: i === 30 ? 900 : 100, reverted: 10, revert_pct: 10 }));
    const card = cardOf(recipe, { columns: [col("t", "DateTime"), col("txs"), col("reverted"), col("revert_pct", "Float64")], rows }, {}, "AVAX", null, Date.UTC(2026, 10, 10, 12))!;
    expect(card.label).toBe("Transactions");
    expect(card.figure).toBe("8,000");
    expect(card.shape).toBe("series");
    expect(card.spark.length).toBeLessThanOrEqual(SPARK);
    expect(Math.max(...card.spark)).toBe(1);
    expect(card.finding?.tag).toBe("Peak");
  });

  it("gives a ranking its first rows, highest first", () => {
    const recipe = fixedRecipe(43114, "Busiest senders in the last hour")!;
    const rows = [5, 40, 10, 20].map((n, i) => ({ sender: `0x${String(i).repeat(40)}`, txs: n, reverted: 0, recipients: 1, of_total: 4 }));
    const card = cardOf(recipe, { columns: [col("sender", "String"), col("txs"), col("reverted"), col("recipients"), col("of_total")], rows }, {}, "AVAX")!;
    expect(card.shape).toBe("ranking");
    expect(card.spark).toEqual([1, 0.5, 0.25, 0.125]);
    expect(card.figure).toBe("75");
  });

  it("has no card for a run with no rows", () => {
    const recipe = fixedRecipe(43114, "Busiest senders in the last hour")!;
    expect(cardOf(recipe, { columns: [col("sender", "String"), col("txs")], rows: [] }, {}, "AVAX")).toBeNull();
    expect(cardOf({ ...recipe, visual: null }, { columns: [col("sender", "String"), col("txs")], rows: [{ sender: "a", txs: 1 }] }, {}, "AVAX")).toBeNull();
  });
});
