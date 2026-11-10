import { describe, expect, it } from "vitest";
import { fixedRecipe } from "@/lib/explorer-query/fixed";
import { guardSql } from "@/lib/explorer-query/guard";
import { sqlWindow } from "@/lib/explorer-query/scope";
import { bucketWords, movableWindow, movesOf, priorSql, withSpan } from "@/lib/explorer-query/window-shift";
import { DAY, HOUR, WEEK } from "@/lib/explorer-query/values";

/* The window buttons and the period before: a query's one window, written again with no model. */

// a Wednesday, mid-hour
const NOW = Date.UTC(2026, 10, 11, 14, 37);
const fixed = (q: string, chain = 43114) => fixedRecipe(chain, q)!;

describe("movableWindow", () => {
  it("reads a rolling series: its start and the bucket on x", () => {
    const r = fixed("Transactions per 5 minutes, with reverts");
    expect(movableWindow(r.sql, r.chart.x, NOW)).toEqual({ start: "toStartOfFiveMinutes(now()) - INTERVAL 6 HOUR", bucket: "toStartOfFiveMinutes" });
  });

  it("reads a ranking's window, which has no bucket", () => {
    const r = fixed("Busiest senders in the last hour");
    expect(movableWindow(r.sql, r.chart.x, NOW)).toEqual({ start: "now() - INTERVAL 1 HOUR", bucket: null });
  });

  it("reads a calendar window that runs to now", () => {
    expect(movableWindow("SELECT `to` AS c, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toMonday(now()) GROUP BY c ORDER BY txs DESC LIMIT 15", "c", NOW)).toEqual({ start: "toMonday(now())", bucket: null });
  });

  it("reads a shorthand's start", () => {
    const sql = "$DEX(now() - INTERVAL 7 DAY, 'pharaoh') SELECT toDate(block_time) AS t, sum(usd) AS volume_usd FROM legs GROUP BY t ORDER BY t";
    expect(movableWindow(sql, "t", NOW)).toEqual({ start: "now() - INTERVAL 7 DAY", bucket: "toDate" });
  });

  it("leaves alone two windows, a window that ended, and a window ahead of now", () => {
    const two = "SELECT countIf(block_time >= now() - INTERVAL 1 DAY) AS today, count() AS week FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY";
    expect(movableWindow(two, undefined, NOW)).toBeNull();
    const ended = "SELECT count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 14 DAY AND block_time < now() - INTERVAL 7 DAY";
    expect(movableWindow(ended, undefined, NOW)).toBeNull();
    const ahead = "SELECT node_id, end_time FROM p_validators WHERE chain_id = 1 AND end_time > now() AND end_time <= now() + INTERVAL 7 DAY";
    expect(movableWindow(ahead, undefined, NOW)).toBeNull();
  });

  it("leaves alone a week bucket with a mode of its own", () => {
    const sql = "SELECT toStartOfWeek(block_time, 1) AS w, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 12 WEEK GROUP BY w ORDER BY w";
    expect(movableWindow(sql, "w", NOW)).toBeNull();
  });
});

describe("withSpan", () => {
  it("moves a series and its drill to the span's start and bucket", () => {
    const r = fixed("Transactions per 5 minutes, with reverts");
    const m = movableWindow(r.sql, r.chart.x, NOW)!;
    const sql = withSpan(r.sql, "7d", m);
    expect(sql).toContain("toStartOfHour(block_time) AS t");
    expect(sql).toContain("block_time >= toStartOfHour(now()) - INTERVAL 7 DAY");
    expect(sql).not.toContain("FiveMinutes");
    expect(guardSql(sql, 43114).ok).toBe(true);
    const drill = withSpan(r.drill!.sql, "7d", m);
    expect(drill).toContain("block_time >= toStartOfHour(now()) - INTERVAL 7 DAY AND toStartOfHour(block_time) = {{t}}");
    // the moved query reads the window it was moved to
    const w = sqlWindow(sql, NOW);
    expect(w).toMatchObject({ open: true, rolling: true });
    expect(NOW - (w as { start: number }).start).toBeGreaterThanOrEqual(7 * DAY);
    expect(NOW - (w as { start: number }).start).toBeLessThan(7 * DAY + HOUR);
  });

  it("moves a ranking with no bucket", () => {
    const r = fixed("Busiest senders in the last hour");
    const m = movableWindow(r.sql, r.chart.x, NOW)!;
    const sql = withSpan(r.sql, "30d", m);
    expect(sql).toContain("block_time >= now() - INTERVAL 30 DAY");
    expect(sql).not.toContain("INTERVAL 1 HOUR");
    expect(guardSql(sql, 43114).ok).toBe(true);
  });

  it("turns a calendar window into a rolling one", () => {
    const sql = "SELECT `to` AS c, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toMonday(now()) GROUP BY c ORDER BY txs DESC LIMIT 15";
    expect(withSpan(sql, "24h", movableWindow(sql, "c", NOW)!)).toContain("block_time >= now() - INTERVAL 24 HOUR GROUP BY");
  });

  it("moves a shorthand's start and keeps its slug", () => {
    const sql = "$DEX(now() - INTERVAL 7 DAY, 'pharaoh') SELECT toDate(block_time) AS t, sum(usd) AS volume_usd FROM legs GROUP BY t ORDER BY t";
    expect(withSpan(sql, "90d", movableWindow(sql, "t", NOW)!)).toBe("$DEX(toStartOfDay(now()) - INTERVAL 90 DAY, 'pharaoh') SELECT toStartOfDay(block_time) AS t, sum(usd) AS volume_usd FROM legs GROUP BY t ORDER BY t");
  });
});

describe("priorSql", () => {
  it("reads the span before a rolling window, of the same length", () => {
    const r = fixed("Busiest senders in the last hour");
    const sql = priorSql(r.sql, movableWindow(r.sql, r.chart.x, NOW)!)!;
    expect(sql).toContain("block_time >= now() - INTERVAL 2 HOUR AND block_time < now() - INTERVAL 1 HOUR");
    expect(guardSql(sql, 43114).ok).toBe(true);
  });

  it("keeps a bucketed start's own length: from the bucket's start, to now less the span", () => {
    const r = fixed("Transactions per 5 minutes, with reverts");
    const sql = priorSql(r.sql, movableWindow(r.sql, r.chart.x, NOW)!)!;
    expect(sql).toContain("block_time >= toStartOfFiveMinutes(now()) - INTERVAL 12 HOUR AND block_time < now() - INTERVAL 6 HOUR");
    expect(guardSql(sql, 43114).ok).toBe(true);
    // 14:37 less 6 hours, back to 14:35 less 12 hours: the 6 hours and 2 minutes the window itself runs
    expect(sqlWindow(sql, NOW)).toMatchObject({ open: false, start: NOW - 2 * 60_000 - 12 * HOUR, end: NOW - 6 * HOUR });
  });

  it("reads last week up to the same point for this week so far", () => {
    const sql = "SELECT count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toMonday(now())";
    const prior = priorSql(sql, movableWindow(sql, undefined, NOW)!)!;
    expect(prior).toContain("block_time >= toMonday(now()) - INTERVAL 1 WEEK AND block_time < now() - INTERVAL 1 WEEK");
    const w = sqlWindow(prior, NOW) as { start: number; end: number };
    expect(w.end - w.start).toBe(NOW - (Date.UTC(2026, 10, 9)));
    expect(w.end).toBe(NOW - WEEK);
  });

  it("reads the month before for this month so far", () => {
    const sql = "SELECT count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfMonth(now())";
    expect(priorSql(sql, movableWindow(sql, undefined, NOW)!)).toContain("block_time >= toStartOfMonth(now() - INTERVAL 1 MONTH) AND block_time < now() - INTERVAL 1 MONTH");
  });

  it("gives a shorthand its start and its end", () => {
    const sql = "$DEX(toMonday(now())) SELECT protocol, sum(usd) AS volume_usd FROM legs GROUP BY protocol ORDER BY volume_usd DESC";
    expect(priorSql(sql, movableWindow(sql, "protocol", NOW)!)).toBe("$DEX(toMonday(now()) - INTERVAL 1 WEEK, now() - INTERVAL 1 WEEK) SELECT protocol, sum(usd) AS volume_usd FROM legs GROUP BY protocol ORDER BY volume_usd DESC");
  });
});

describe("bucketWords", () => {
  it("names the span's bucket in a title, a note and a label", () => {
    expect(bucketWords("Transactions per 5 minutes, with reverts", "7d")).toBe("Transactions per hour, with reverts");
    expect(bucketWords("The current 5-minute period is incomplete.", "7d")).toBe("The current hour period is incomplete.");
    expect(bucketWords("Peak 5 minutes", "30d")).toBe("Peak day");
    expect(bucketWords("Busiest hour", "24h")).toBe("Busiest 15 minutes");
    expect(bucketWords("Transactions in the 5 minutes from {{t}}", "7d")).toBe("Transactions in the hour from {{t}}");
    expect(bucketWords("Top sender", "7d")).toBe("Top sender");
    expect(bucketWords("Daily transactions over the last 30 days", "7d")).toBe("Hourly transactions over the last 30 days");
    expect(bucketWords("Daily transactions", "24h")).toBe("transactions per 15 minutes");
    expect(bucketWords("Fees burned per day", "24h")).toBe("Fees burned per 15 minutes");
    expect(bucketWords("The current day period is not over.", "24h")).toBe("The current 15-minute period is not over.");
  });
});

describe("movesOf", () => {
  const of = (start: string) => movesOf({ start, bucket: null });
  it("names a span the buttons hold", () => {
    expect(of("now() - INTERVAL 24 HOUR")).toEqual({ span: "24h", own: null, prior: true });
    expect(of("now() - INTERVAL 1 DAY").span).toBe("24h");
    expect(of("toStartOfHour(now()) - INTERVAL 7 DAY").span).toBe("7d");
    expect(of("now() - INTERVAL 1 WEEK").span).toBe("7d");
    expect(of("toStartOfDay(now()) - INTERVAL 30 DAY").span).toBe("30d");
    expect(of("now() - INTERVAL 90 DAY").span).toBe("90d");
  });

  it("gives any other window a short name of its own", () => {
    expect(of("toStartOfFiveMinutes(now()) - INTERVAL 6 HOUR")).toEqual({ span: null, own: "6H", prior: true });
    expect(of("now() - INTERVAL 30 MINUTE").own).toBe("30MIN");
    expect(of("now() - INTERVAL 1 MONTH").own).toBe("1MO");
    expect(of("toStartOfDay(now())")).toEqual({ span: null, own: "TODAY", prior: true });
    expect(of("toMonday(now())").own).toBe("THIS WEEK");
    expect(of("toStartOfMonth(now())").own).toBe("THIS MONTH");
  });
});
