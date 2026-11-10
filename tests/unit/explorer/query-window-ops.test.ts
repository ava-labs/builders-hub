import { describe, expect, it } from "vitest";
import { fixedRecipe } from "@/lib/explorer-query/fixed";
import { guardSql } from "@/lib/explorer-query/guard";
import { answerMoves, movedSql, movedWords, priorOf } from "@/lib/explorer-query/window-ops";

/* The window buttons and the period before, as the route runs them: on the SQL the page holds (the guard's own
   output, with any shorthand written out), guarded again on the way out. */

// a Wednesday, mid-hour
const NOW = Date.UTC(2026, 10, 11, 14, 37);
const C = 43114;
const held = (q: string) => {
  const r = fixedRecipe(C, q)!;
  const g = guardSql(r.sql, C);
  if (!g.ok) throw new Error(g.error);
  return { ...r, sql: g.sql };
};

describe("answerMoves", () => {
  it("offers the buttons for a series that runs to now", () => {
    const a = held("Transactions per 5 minutes, with reverts");
    expect(answerMoves(a.sql, a.chart.x, C, NOW)).toEqual({ span: null, own: "6H", prior: true });
  });

  it("knows a span the buttons hold", () => {
    const a = held("Most called methods");
    expect(answerMoves(a.sql, a.chart.x, C, NOW)?.span).toBe("24h");
  });

  it("offers nothing on Fuji, for no SQL, or for a query with no window", () => {
    const a = held("Transactions per 5 minutes, with reverts");
    expect(answerMoves(a.sql.replaceAll("43114", "43113"), a.chart.x, 43113, NOW)).toBeNull();
    expect(answerMoves("", undefined, C, NOW)).toBeNull();
    expect(answerMoves("SELECT count() AS n FROM raw_txs WHERE chain_id = 43114", undefined, C, NOW)).toBeNull();
  });
});

describe("movedSql", () => {
  it("moves the query and its drill to the span, in the span's bucket", () => {
    const a = held("Transactions per 5 minutes, with reverts");
    const m = movedSql(a.sql, a.drill?.sql, a.chart.x, "7d", C, NOW);
    if (!m.ok) throw new Error(m.error);
    expect(m.sql).toContain("toStartOfHour(block_time) AS t");
    expect(m.sql).toContain("block_time >= toStartOfHour(now()) - INTERVAL 7 DAY");
    expect(m.sql).not.toContain("FiveMinutes");
    expect(m.drill).toContain("toStartOfHour(block_time) = {{t}}");
    expect(m.drill).toContain("block_time >= toStartOfHour(now()) - INTERVAL 7 DAY");
    // what comes out is what the page may send back: it moves again
    expect(answerMoves(m.sql, a.chart.x, C, NOW)).toEqual({ span: "7d", own: null, prior: true });
  });

  it("refuses a query whose window it cannot move", () => {
    expect(movedSql("SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND block_time >= '2026-01-01'", null, undefined, "7d", C, NOW)).toEqual({ ok: false, error: expect.stringContaining("cannot move") });
  });
});

describe("priorOf", () => {
  it("reads the period before, of the same length", () => {
    const a = held("Most called methods");
    const p = priorOf(a.sql, a.chart.x, C, NOW);
    if (!p.ok) throw new Error(p.error);
    expect(p.sql).toContain("block_time >= now() - INTERVAL 2 DAY AND block_time < now() - INTERVAL 1 DAY");
  });
});

describe("movedWords", () => {
  it("names the new window and the new bucket", () => {
    const a = held("Transactions per 5 minutes, with reverts");
    const m = movedSql(a.sql, null, a.chart.x, "7d", C, NOW);
    if (!m.ok) throw new Error(m.error);
    const said = movedWords({ title: a.title, note: a.note }, a.sql, m.sql, a.chart.x, "7d", [], C, NOW, NOW);
    expect(said.title).toBe("Transactions per hour in the last 7 days, with reverts");
    expect(said.note).toContain("in the last 7 days");
    expect(said.note).not.toContain("6 hours");
    expect(said.note).not.toContain("5-minute");
    expect(said.span).toBe("last 7 days");
  });

  it("replaces a window the title names", () => {
    const a = held("Most called methods");
    const m = movedSql(a.sql, null, a.chart.x, "30d", C, NOW);
    if (!m.ok) throw new Error(m.error);
    expect(movedWords({ title: a.title, note: "" }, a.sql, m.sql, a.chart.x, "30d", [], C, NOW, NOW).title).toBe("Most called methods, last 30 days");
  });
});
