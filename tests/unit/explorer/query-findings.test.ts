import { describe, expect, it } from "vitest";
import { findingsOf, type FindInput } from "@/components/explorer-v2/evm/query/findings";
import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";

/* What stands out in an answer's rows, by rule. Each rule reads only figures that add up, leaves a period the
   window cuts out of a series, and says nothing of a whole it does not hold. */

type Row = Record<string, unknown>;
const NOW = Date.UTC(2026, 10, 10, 12, 2);
const col = (name: string, type = "UInt64"): ColumnMeta => ({ name, type });
const stamp = (i: number) => new Date(Date.UTC(2026, 10, 10, 6) + i * 3600e3).toISOString().slice(0, 19).replace("T", " ");

const find = (rows: Row[], columns: ColumnMeta[], series: { column: string; label: string; format?: string }[], over: Partial<FindInput> = {}) =>
  findingsOf({
    columns,
    rows,
    names: {},
    visual: null,
    chart: { kind: "bar", x: columns[0].name, series: series.map((s) => ({ column: s.column, label: s.label })) },
    sql: "",
    sym: "AVAX",
    now: NOW,
    span: "last 6 hours",
    ...over,
  });
const tags = (out: { tag: string }[]) => out.map((f) => f.tag);

describe("a series", () => {
  const hours = (txs: number[], reverted?: number[]) => txs.map((n, i) => ({ t: stamp(i), txs: n, ...(reverted ? { reverted: reverted[i] } : {}) }));
  const cols = [col("t", "DateTime"), col("txs")];
  const txs = [{ column: "txs", label: "Transactions" }];

  it("names a period far above the usual one", () => {
    const out = find(hours([10, 11, 9, 60, 10, 12, 11, 10]), cols, txs);
    expect(out[0]).toMatchObject({ kind: "peak", key: stamp(3), tone: "plain" });
    expect(out[0].text).toMatch(/held 60 transactions, 5\.7 times the median hour\.$/);
    expect(out[0].row).toEqual({ t: stamp(3), txs: 60 });
  });

  it("names an hour of a series that runs over days with its time, and a peak far above the median by both values", () => {
    const week = Array.from({ length: 96 }, (_, i) => ({ t: stamp(i), txs: i === 50 ? 5_000 : 10 + (i % 3) }));
    const out = find(week, cols, txs);
    // the day and the time of day, and the median value in place of a ratio in the hundreds
    expect(out[0].text).toMatch(/^[A-Z][a-z]{2} \d{1,2} \d{2}:\d{2} \S+ held 5,000 transactions; the median hour held 11 transactions\.$/);
  });

  it("says nothing of a flat series", () => {
    expect(find(hours([10, 11, 9, 10, 10, 12, 11, 10]), cols, txs)).toEqual([]);
  });

  it("reads a later half that runs above the earlier one", () => {
    const out = find(hours([10, 10, 10, 10, 20, 20, 20, 20]), cols, txs);
    expect(out.find((f) => f.kind === "trend")).toMatchObject({ tone: "up", text: "The later half averaged 20 transactions per hour, 100% above the earlier half." });
  });

  it("leaves the period the window cuts out of the series", () => {
    // the window ends mid-hour: the last hour is still filling, and its 1 is no fall
    const rows = hours([10, 10, 10, 10, 10, 10, 10, 10, 10, 1]);
    const sql = "SELECT toStartOfHour(block_time) AS t, count() AS txs FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfHour(now()) - INTERVAL 9 HOUR GROUP BY t ORDER BY t";
    expect(find(rows, cols, txs, { sql, now: Date.UTC(2026, 10, 10, 15, 20) })).toEqual([]);
  });

  it("sets the total against the period before", () => {
    const prior = { rows: hours([5, 5, 5, 5, 5, 5, 5, 5]), totals: null };
    const out = find(hours([10, 10, 10, 10, 10, 10, 10, 10]), cols, txs, { prior });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "change", tone: "up", text: "Transactions rose 100% against the prior 6 hours: 80, from 40." });
  });

  it("says what share failed, and how that moved", () => {
    const fcols = [...cols, col("reverted")];
    const series = [...txs, { column: "reverted", label: "Reverted" }];
    const now = hours([100, 100, 100, 100, 100, 100], [20, 20, 20, 20, 20, 20]);
    const prior = { rows: hours([100, 100, 100, 100, 100, 100], [10, 10, 10, 10, 10, 10]), totals: null };
    expect(find(now, fcols, series)[0]).toMatchObject({ kind: "failure", tone: "bad", text: "20% of transactions reverted: 120 of 600." });
    expect(find(now, fcols, series, { prior })[0].text).toBe("20% of transactions reverted: 120 of 600, up from 10% in the prior 6 hours.");
  });

  it("never adds up a count of distinct ones, an average or a rate", () => {
    const rows = hours([10, 11, 9, 60, 10, 12, 11, 10]).map((r) => ({ t: r.t, senders: r.txs, avg_gwei: r.txs, revert_pct: r.txs }));
    const c = [col("t", "DateTime"), col("senders"), col("avg_gwei", "Float64"), col("revert_pct", "Float64")];
    expect(find(rows, c, [{ column: "senders", label: "Senders" }, { column: "avg_gwei", label: "Average" }, { column: "revert_pct", label: "Revert rate" }])).toEqual([]);
  });

  it("reads no series in a list of records", () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ t: stamp(i), amount: i === 3 ? 900 : 10, tx_hash: `0x${i}` }));
    expect(find(rows, [col("t", "DateTime"), col("amount", "Float64"), col("tx_hash", "String")], [{ column: "amount", label: "USDT" }])).toEqual([]);
    // rows at their own times are records, whatever their columns are called
    const uneven = [0, 0.1, 0.7, 2.2, 2.3, 4.9, 5.0, 7.5].map((h, i) => ({ t: stamp(h).slice(0, 14) + String(10 + i * 5) + ":07", amount: i === 3 ? 900 : 10 }));
    expect(find(uneven, [col("t", "DateTime"), col("amount", "Float64")], [{ column: "amount", label: "USDT" }])).toEqual([]);
  });
});

describe("a ranking", () => {
  const cols = [col("dex", "String"), col("volume_usd", "Float64")];
  const vol = [{ column: "volume_usd", label: "Volume" }];
  const rank = (...vs: number[]) => vs.map((v, i) => ({ dex: `dex${i + 1}`, volume_usd: v }));
  const usd: Partial<FindInput> = { visual: { stats: [], callouts: [], panels: [{ title: "", kind: "hbar", x: "dex", series: [{ column: "volume_usd", label: "Volume", format: "usd", axis: "left", mark: "auto", transform: "none", dashed: false }], markers: [], bands: [], stacked: false, sortDir: "desc", referenceLines: [], width: "full" }] } };

  it("gives the leader's share of the whole", () => {
    const out = find(rank(700, 100, 80, 60, 40, 20), cols, vol, usd);
    expect(out[0]).toMatchObject({ kind: "leader", key: "dex1", text: "dex1 holds 70% of volume: $700.00 of $1,000." });
    // one row holds most of it: the top 3 add nothing
    expect(tags(out)).not.toContain("Concentration");
  });

  it("says how the top three stand when no one leads", () => {
    const out = find(rank(30, 28, 22, 8, 6, 4, 2), cols, vol, usd);
    // the three together stand out more than the first alone
    expect(out.map((f) => f.kind)).toEqual(["concentration", "leader"]);
    expect(out[0].text).toBe("The top 3 hold 80% of volume.");
    expect(out[1].text).toBe("dex1 holds 30% of volume: $30.00 of $100.00.");
  });

  it("gives no share of a whole the rows do not hold", () => {
    // 6 rows of 40: a LIMIT cut the rest, and no totals read their sum
    const rows = rank(700, 100, 80, 60, 40, 20).map((r) => ({ ...r, of_total: 40 }));
    const out = find(rows, [...cols, col("of_total")], vol, usd);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("dex1 leads with $700.00, 7.0 times the next (dex2).");
    // with the totals, the share is of every row
    const totals = { rows: 40, newest: false, sum: { volume_usd: 2000 }, count: {}, min: {}, max: {}, distinct: {} };
    expect(find(rows, [...cols, col("of_total")], vol, { ...usd, totals })[0].text).toBe("dex1 holds 35% of volume: $700.00 of $2,000.");
  });

  it("names the row that moved most against the period before, and a row that is new", () => {
    const prior = { rows: [{ dex: "dex1", volume_usd: 500 }, { dex: "dex2", volume_usd: 300 }, { dex: "dex3", volume_usd: 100 }, { dex: "old", volume_usd: 90 }], totals: null };
    const out = find(rank(520, 310, 300, 200), cols, vol, { ...usd, prior, span: "last 7 days" });
    expect(out.find((f) => f.kind === "mover")).toMatchObject({ key: "dex3", tone: "up", text: "dex3 rose 200% against the prior 7 days: $300.00, from $100.00." });
    expect(out.find((f) => f.kind === "newcomer")).toMatchObject({ key: "dex4", text: "dex4 was not among the top 4 in the prior 7 days. It is number 4 now, with $200.00." });
  });

  it("reads a series beside its own twin of the period before", () => {
    const rows = [{ dex: "a", this_week: 126, last_week: 120 }, { dex: "b", this_week: 35, last_week: 11 }, { dex: "c", this_week: 20, last_week: 21 }];
    const out = find(rows, [col("dex", "String"), col("this_week", "Float64"), col("last_week", "Float64")], [{ column: "this_week", label: "This week" }, { column: "last_week", label: "Last week" }]);
    expect(out.find((f) => f.kind === "leader")?.text).toBe("a holds 70% of the total: 126 of 181.");
    expect(out.find((f) => f.kind === "mover")?.text).toBe("b rose 218% against last week: 35, from 11.");
  });

  it("names the row that fails most, among the rows that count", () => {
    const rows = [{ m: "a", calls: 1000, reverted: 10 }, { m: "b", calls: 900, reverted: 855 }, { m: "c", calls: 800, reverted: 8 }, { m: "d", calls: 3, reverted: 3 }];
    const out = find(rows, [col("m", "String"), col("calls"), col("reverted")], [{ column: "calls", label: "Calls" }, { column: "reverted", label: "Reverted" }]);
    expect(out[0]).toMatchObject({ kind: "failure", key: "b", tone: "bad", text: "b reverted on 95% of its 900 calls." });
  });

  it("never adds amounts in two tokens", () => {
    const rows = [{ pool: "p1", token: "USDC", amount: 900 }, { pool: "p2", token: "WAVAX", amount: 50 }, { pool: "p3", token: "USDT", amount: 40 }];
    expect(find(rows, [col("pool", "String"), col("token", "String"), col("amount", "Float64")], [{ column: "amount", label: "Amount" }])).toEqual([]);
  });

  it("shows at most three, the most notable first", () => {
    const rows = [{ m: "a", calls: 1000, reverted: 900 }, { m: "b", calls: 300, reverted: 3 }, { m: "c", calls: 200, reverted: 2 }, { m: "d", calls: 100, reverted: 1 }, { m: "e", calls: 90, reverted: 1 }, { m: "f", calls: 80, reverted: 1 }];
    const prior = { rows: rows.map((r) => ({ ...r, calls: r.m === "b" ? 100 : r.calls })), totals: null };
    const out = find(rows, [col("m", "String"), col("calls"), col("reverted")], [{ column: "calls", label: "Calls" }, { column: "reverted", label: "Reverted" }], { prior });
    expect(out).toHaveLength(3);
    expect(out.map((f) => f.score)).toEqual([...out.map((f) => f.score)].sort((p, q) => q - p));
  });
});
