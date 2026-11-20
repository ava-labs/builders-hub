import { describe, expect, it } from "vitest";
import { cellKey, heatGridOf, histogramOf, treemapOf } from "@/components/explorer-v2/evm/query/shapes";

/* The arithmetic of the histogram, the heatmap and the treemap. */

describe("histogramOf", () => {
  it("counts every value once, in bins of equal width", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    const h = histogramOf(rows, "v")!;
    expect(h.log).toBe(false);
    expect(h.bins.reduce((n, b) => n + b.n, 0)).toBe(100);
    expect(h.bins).toHaveLength(10);
    expect(histogramOf(rows.slice(0, 20), "v")!.bins).toHaveLength(8);
    expect(h.bins[0].lo).toBe(0);
    expect(h.bins.at(-1)!.hi).toBe(99);
    expect(h.median).toBe(49.5);
    // the highest value falls in the last bin, not past it
    expect(h.bins.at(-1)!.n).toBeGreaterThan(0);
  });

  it("bins on a log scale when the values span orders of magnitude", () => {
    const rows = [1, 2, 5, 10, 20, 50, 100, 1000, 10_000, 600_500].map((v) => ({ v }));
    const h = histogramOf(rows, "v")!;
    expect(h.log).toBe(true);
    expect(h.bins.reduce((n, b) => n + b.n, 0)).toBe(10);
    // each bin spans the same ratio
    const ratios = h.bins.map((b) => b.hi / b.lo);
    expect(Math.max(...ratios) / Math.min(...ratios)).toBeCloseTo(1, 6);
  });

  it("stays linear when a value is zero or below", () => {
    expect(histogramOf([0, 1, 10_000].map((v) => ({ v })), "v")!.log).toBe(false);
  });

  it("reads numbers written as strings and skips what is not a number", () => {
    const h = histogramOf([{ v: "3" }, { v: "5" }, { v: null }, { v: "x" }, { v: 9 }], "v")!;
    expect(h.count).toBe(3);
    expect(h.median).toBe(5);
  });

  it("has nothing to spread over one distinct value", () => {
    expect(histogramOf([{ v: 4 }, { v: 4 }], "v")).toBeNull();
    expect(histogramOf([{ v: 4 }], "v")).toBeNull();
  });
});

describe("heatGridOf", () => {
  it("orders hours by number and weekdays by the calendar", () => {
    const rows = [
      { day: "Wednesday", hour: 10, txs: 5 },
      { day: "Monday", hour: 9, txs: 2 },
      { day: "Monday", hour: 10, txs: 7 },
      { day: "Sunday", hour: 2, txs: 1 },
    ];
    const g = heatGridOf(rows, "hour", "day", "txs")!;
    expect(g.xs).toEqual(["2", "9", "10"]);
    expect(g.ys).toEqual(["Monday", "Wednesday", "Sunday"]);
    expect(g.cells.get(cellKey("Monday", "10"))!.value).toBe(7);
    expect(g.cells.has(cellKey("Sunday", "9"))).toBe(false);
    expect([g.min, g.max]).toEqual([1, 7]);
  });

  it("keeps names in the rows' own order", () => {
    const rows = [
      { c: "Pharaoh", d: "2026-11-09", v: 3 },
      { c: "Uniswap", d: "2026-11-09", v: 1 },
      { c: "Pharaoh", d: "2026-11-10", v: 4 },
    ];
    expect(heatGridOf(rows, "d", "c", "v")!.ys).toEqual(["Pharaoh", "Uniswap"]);
  });

  it("is no grid with one value on an axis", () => {
    expect(heatGridOf([{ a: "x", b: 1, v: 1 }, { a: "x", b: 2, v: 2 }], "a", "b", "v")).toBeNull();
  });
});

describe("treemapOf", () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((v, i) => ({ id: i, v }));

  it("gives each item its share of the area, inside the box, with no overlap", () => {
    const rects = treemapOf(items, (d) => d.v, 600, 400);
    expect(rects).toHaveLength(7);
    const total = items.reduce((n, d) => n + d.v, 0);
    for (const r of rects) {
      expect(r.w * r.h).toBeCloseTo((r.value / total) * 600 * 400, 6);
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-9);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const [p, q] = [rects[i], rects[j]];
        const overlap = Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
        expect(overlap).toBeLessThan(1e-6);
      }
  });

  it("keeps rectangles near square", () => {
    const rects = treemapOf(items, (d) => d.v, 600, 400);
    for (const r of rects) expect(Math.max(r.w / r.h, r.h / r.w)).toBeLessThan(4);
  });

  it("leaves out what has no area", () => {
    expect(treemapOf([{ v: 0 }, { v: -2 }, { v: 5 }], (d) => d.v, 100, 100)).toHaveLength(1);
    expect(treemapOf([], () => 1, 100, 100)).toEqual([]);
  });
});
