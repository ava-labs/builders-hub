import { beforeEach, describe, expect, it, vi } from "vitest";
import { adoptBoards, deleteBoard, listBoards, mergeRemote, sharedTiles, type Board, type MetricTile } from "@/lib/explorer-query/board";
import { boardBodySchema, boardIdSchema, withoutRows } from "@/lib/explorer-query/board-wire";
import { boardFromPlayground, pickedDay, playgroundBoardId, type PlaygroundDashboard } from "@/lib/explorer-query/playground";
import { joinPoints, metricVisual, pointsOf, seriesLabels, windowRows } from "@/lib/explorer-query/stats-metrics";

/* Playground dashboards come over to Query boards as metric tiles
   (lib/explorer-query/playground.ts, stats-metrics.ts). */

const series = (over: Record<string, unknown> = {}) => ({
  id: "s",
  name: "Transactions",
  color: "#E84142",
  yAxis: "left",
  visible: true,
  chartStyle: "bar",
  chainId: "43114",
  chainName: "Avalanche C-Chain",
  metricKey: "txCount",
  zIndex: 1,
  ...over,
});

const dashboard = (charts: unknown, over: Partial<PlaygroundDashboard> = {}): PlaygroundDashboard => ({
  id: "3f2a9c1e-7b4d-4e0a-9c55-0d1e2f3a4b5c",
  name: "My chain watch",
  charts,
  created_at: "2025-11-20T10:00:00.000Z",
  updated_at: "2025-12-02T18:30:00.000Z",
  ...over,
});

const onlyTile = (b: Board | null) => {
  expect(b).not.toBeNull();
  expect(b!.tiles).toHaveLength(1);
  return b!.tiles[0] as MetricTile;
};

describe("a Playground dashboard as a board", () => {
  it("keeps the dashboard's name, times and a stable id the account accepts", () => {
    const b = boardFromPlayground(dashboard({ charts: [{ id: "1", title: "Daily txs", colSpan: 12, dataSeries: [series()] }] }))!;
    expect(b.id).toBe(playgroundBoardId("3f2a9c1e-7b4d-4e0a-9c55-0d1e2f3a4b5c"));
    expect(b.id).toBe("pg-3f2a9c1e7b4d4e0a9c550d1e2f3a4b5c");
    expect(boardIdSchema.safeParse(b.id).success).toBe(true);
    expect(b.name).toBe("My chain watch");
    expect(b.createdAt).toBe(Date.parse("2025-11-20T10:00:00.000Z"));
    // the dashboard's own edit time, so a later edit on the board wins over a second import
    expect(b.updatedAt).toBe(Date.parse("2025-12-02T18:30:00.000Z"));
    expect(boardFromPlayground(dashboard({ charts: [{ dataSeries: [series()] }] }))!.id).toBe(b.id);
  });

  it("reads the charts in both saved shapes", () => {
    const chart = { id: "1", title: "Daily txs", colSpan: 6, dataSeries: [series()] };
    const wrapped = onlyTile(boardFromPlayground(dashboard({ globalStartTime: null, globalEndTime: null, charts: [chart] })));
    const bare = onlyTile(boardFromPlayground(dashboard([chart])));
    expect(bare).toEqual(wrapped);
    expect(wrapped).toMatchObject({
      kind: "metric",
      title: "Daily txs",
      size: "m",
      stacked: false,
      days: 90,
      from: null,
      to: null,
      series: [{ chainId: "43114", chainName: "Avalanche C-Chain", metric: "txCount", mark: "bar", axis: "left" }],
    });
  });

  it("drops what drew nothing: hidden series, unknown metrics, bad chains, empty charts and dashboards", () => {
    const b = boardFromPlayground(
      dashboard({
        charts: [
          { title: "Empty", dataSeries: [] },
          {
            title: "Mixed",
            dataSeries: [
              series({ visible: false }),
              series({ metricKey: "notAMetric" }),
              series({ chainId: "43114; DROP" }),
              series({ chainId: "all", chainName: "All Chains", metricKey: "activeAddresses" }),
            ],
          },
        ],
      }),
    );
    const t = onlyTile(b);
    expect(t.id).toBe("t1");
    expect(t.order).toBe(0);
    expect(t.series).toEqual([{ chainId: "all", chainName: "All Chains", metric: "activeAddresses", mark: "bar", axis: "left" }]);
    expect(boardFromPlayground(dashboard({ charts: [{ title: "Empty", dataSeries: [] }] }))).toBeNull();
    expect(boardFromPlayground(dashboard(null))).toBeNull();
    expect(boardFromPlayground(dashboard("not json"))).toBeNull();
  });

  it("maps the Playground's four axes to two, its styles to marks, and caps a chart at six series", () => {
    const axes = ["left", "right", "y3", "y4", "left", "right", "left"];
    const t = onlyTile(
      boardFromPlayground(
        dashboard({
          charts: [{ dataSeries: axes.map((yAxis, i) => series({ yAxis, chartStyle: ["bar", "line", "area", "pie"][i % 4], chainId: String(1000 + i) })) }],
        }),
      ),
    );
    expect(t.series).toHaveLength(6);
    expect(t.series.map((s) => s.axis)).toEqual(["left", "right", "left", "right", "left", "right"]);
    expect(t.series.map((s) => s.mark)).toEqual(["bar", "line", "area", "line", "bar", "line"]);
  });

  it("keeps dates when both ends are set, a chart's own over the dashboard's; else the brush's span of days", () => {
    const at = (charts: unknown[], g: { globalStartTime?: string; globalEndTime?: string } = {}) =>
      boardFromPlayground(dashboard({ ...g, charts }))!.tiles.map((t) => {
        const m = t as MetricTile;
        return [m.days, m.from, m.to];
      });
    const s = [series()];
    // a reader in UTC-4 picked Jan 1 to Mar 31
    expect(at([{ dataSeries: s, startTime: "2025-01-01T04:00:00.000Z", endTime: "2025-03-31T04:00:00.000Z" }])).toEqual([[null, "2025-01-01", "2025-03-31"]]);
    // the dashboard's dates stand where a chart has none; a chart's own start wins, each end on its own
    expect(
      at([{ dataSeries: s }, { dataSeries: s, startTime: "2024-06-10T00:00:00.000Z" }], {
        globalStartTime: "2024-06-01T00:00:00.000Z",
        globalEndTime: "2024-06-30T00:00:00.000Z",
      }),
    ).toEqual([
      [null, "2024-06-01", "2024-06-30"],
      [null, "2024-06-10", "2024-06-30"],
    ]);
    // dates out of order drew nothing in the Playground: the tile shows its last days
    expect(at([{ dataSeries: s, startTime: "2025-02-01T00:00:00.000Z", endTime: "2025-01-01T00:00:00.000Z" }])).toEqual([[90, null, null]]);
    // one end alone was no filter in the Playground
    expect(at([{ dataSeries: s, startTime: "2025-01-01T00:00:00.000Z" }])).toEqual([[90, null, null]]);
    // a brush over indexes 10..39 showed 30 days
    expect(at([{ dataSeries: s, brushStartIndex: 10, brushEndIndex: 39 }])).toEqual([[30, null, null]]);
  });

  it("clears the Playground's own default titles and keeps a reader's", () => {
    const titles = ["Chart 1", "chart 12", "Blank Chart", "", "  Beam vs C-Chain  "].map(
      (title) => (boardFromPlayground(dashboard({ charts: [{ title, dataSeries: [series()] }] }))!.tiles[0] as MetricTile).title,
    );
    expect(titles).toEqual(["", "", "", "", "Beam vs C-Chain"]);
  });

  it("makes a board the account's schema accepts, and sends it without rows", () => {
    const b = boardFromPlayground(
      dashboard({
        globalStartTime: "2025-01-01T00:00:00.000Z",
        globalEndTime: "2025-06-30T00:00:00.000Z",
        charts: [
          { title: "A", colSpan: 12, stackSameMetrics: true, dataSeries: [series(), series({ chainId: "primary", chainName: "Primary Network", metricKey: "totalBurnDaily" })] },
          { title: "B", colSpan: 6, dataSeries: [series({ metricKey: "icmMessages" })], startTime: null, endTime: null },
        ],
      }),
    )!;
    const tiles = b.tiles.map((t) => withoutRows({ ...t, snapshot: { columns: [], rows: [{ day: "2025-01-01" }], names: {}, at: 1 } }));
    expect(tiles.every((t) => !("snapshot" in t))).toBe(true);
    const parsed = boardBodySchema.safeParse({ scope: "mainnet:c-chain", name: b.name, tiles, createdAt: b.createdAt, updatedAt: b.updatedAt });
    expect(parsed.success).toBe(true);
    // the account keeps every field the tile draws from
    expect(parsed.success && parsed.data.tiles).toEqual(tiles);
  });
});

describe("a picked date", () => {
  it("is the day the reader picked, east or west of UTC", () => {
    expect(pickedDay("2025-01-01T04:00:00.000Z")).toBe("2025-01-01"); // UTC-4 midnight
    expect(pickedDay("2024-12-31T21:00:00.000Z")).toBe("2025-01-01"); // UTC+3 midnight
    expect(pickedDay("2025-01-01")).toBe("2025-01-01");
    expect(pickedDay("")).toBeNull();
    expect(pickedDay("soon")).toBeNull();
    expect(pickedDay(20250101)).toBeNull();
  });
});

describe("a metric tile's rows and chart", () => {
  it("reads a metric's days oldest first, an ICM count as its messages, and drops what is not a day", () => {
    expect(
      pointsOf(
        {
          txCount: {
            data: [
              { date: "2025-01-03", value: "30", timestamp: 3 },
              { date: "2025-01-01", value: 10, timestamp: 1 },
              { date: "bad", value: 5 },
              { date: "2025-01-02", value: "n/a" },
            ],
          },
        },
        "txCount",
      ),
    ).toEqual([
      { date: "2025-01-01", value: 10 },
      { date: "2025-01-03", value: 30 },
    ]);
    expect(pointsOf({ icmMessages: { data: [{ date: "2025-01-01", messageCount: 7, incomingCount: 3, outgoingCount: 4 }] } }, "icmMessages")).toEqual([{ date: "2025-01-01", value: 7 }]);
    expect(pointsOf({}, "txCount")).toEqual([]);
    expect(pointsOf(null, "txCount")).toEqual([]);
  });

  it("puts every series on one row a day, null where a series has no day", () => {
    const rows = joinPoints(
      ["A", "B"],
      [
        [
          { date: "2025-01-02", value: 2 },
          { date: "2025-01-01", value: 1 },
        ],
        [{ date: "2025-01-02", value: 20 }],
      ],
    );
    expect(rows).toEqual([
      { day: "2025-01-01", A: 1, B: null },
      { day: "2025-01-02", A: 2, B: 20 },
    ]);
  });

  it("shows its dates, or its last days up to the newest", () => {
    const rows = ["2025-01-01", "2025-01-02", "2025-01-05", "2025-01-06"].map((day) => ({ day }));
    expect(windowRows(rows, { days: 2 }).map((r) => r.day)).toEqual(["2025-01-05", "2025-01-06"]);
    expect(windowRows(rows, { days: 6 }).map((r) => r.day)).toEqual(["2025-01-01", "2025-01-02", "2025-01-05", "2025-01-06"]);
    expect(windowRows(rows, { days: 5 }).map((r) => r.day)).toEqual(["2025-01-02", "2025-01-05", "2025-01-06"]);
    expect(windowRows(rows, { from: "2025-01-02", to: "2025-01-05", days: 2 }).map((r) => r.day)).toEqual(["2025-01-02", "2025-01-05"]);
    expect(windowRows(rows, { days: null })).toHaveLength(4);
  });

  it("labels series by metric on one chain, by chain for one metric, else both; short and never twice", () => {
    const s = (chainId: string, chainName: string, metric: MetricTile["series"][number]["metric"]) => ({ chainId, chainName, metric, mark: "line" as const, axis: "left" as const });
    expect(seriesLabels([s("43114", "C-Chain", "txCount"), s("43114", "C-Chain", "gasUsed")])).toEqual(["Transactions", "Gas used"]);
    expect(seriesLabels([s("43114", "C-Chain", "txCount"), s("4337", "Beam", "txCount")])).toEqual(["C-Chain", "Beam"]);
    expect(seriesLabels([s("43114", "C-Chain", "txCount"), s("4337", "Beam", "gasUsed")])).toEqual(["C-Chain transactions", "Beam gas used"]);
    expect(seriesLabels([s("43114", "C-Chain", "txCount"), s("43114", "C-Chain", "txCount")])).toEqual(["Transactions", "Transactions 2"]);
    const long = seriesLabels([s("primary", "Primary Network", "cumulativeValidatorFees"), s("43114", "Avalanche C-Chain", "txCount")]);
    expect(long.every((l) => l.length <= 32)).toBe(true);
    expect(new Set(long).size).toBe(2);
  });

  it("draws one panel over the days: one mark for the chart, or a line with each series' own", () => {
    const tile = (marks: ("bar" | "line" | "area")[], stacked = false): MetricTile => ({
      kind: "metric",
      id: "t0",
      title: "",
      series: marks.map((mark, i) => ({ chainId: String(10 + i), chainName: `L1 ${i}`, metric: i ? "totalBurnDaily" : "gasUsed", mark, axis: i ? "right" : "left" })),
      stacked,
      days: 90,
      size: "w",
      order: 0,
    });
    const same = metricVisual(tile(["bar", "bar"], true)).panels[0];
    expect(same).toMatchObject({ kind: "bar", x: "day", stacked: true });
    expect(same.series.map((x) => [x.mark, x.axis, x.format])).toEqual([
      ["auto", "left", "gas"],
      ["auto", "right", "avax"],
    ]);
    const mixed = metricVisual(tile(["bar", "area"])).panels[0];
    expect(mixed.kind).toBe("line");
    expect(mixed.series.map((x) => x.mark)).toEqual(["bar", "area"]);
    // the series' columns are the rows' keys
    expect(mixed.series.map((x) => x.column)).toEqual(seriesLabels(tile(["bar", "area"]).series));
  });
});

/* ------------------------------------------------------------------ */
/* the store: a device's localStorage, in memory                        */

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("boards that came over, in the device's store", () => {
  const scope = "mainnet:c-chain";
  const pg = () => boardFromPlayground(dashboard({ charts: [{ title: "Daily txs", dataSeries: [series()] }] }))!;

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("window", new EventTarget());
  });

  it("are taken in once, with their ids and times", () => {
    const b = pg();
    expect(adoptBoards(scope, [b]).map((x) => x.id)).toEqual([b.id]);
    expect(adoptBoards(scope, [b])).toEqual([]);
    expect(listBoards(scope)).toEqual([b]);
  });

  it("stay out once this device deleted them", () => {
    const b = pg();
    adoptBoards(scope, [b]);
    deleteBoard(scope, b.id);
    expect(adoptBoards(scope, [b])).toEqual([]);
    expect(listBoards(scope)).toEqual([]);
  });

  it("keep their kept rows when the account's copy draws the same series", () => {
    const b = pg();
    const snapshot = { columns: [{ name: "day", type: "Date" }], rows: [{ day: "2025-01-01", Transactions: 1 }], names: {}, at: 5 };
    adoptBoards(scope, [{ ...b, tiles: b.tiles.map((t) => ({ ...t, snapshot })) }]);
    // the account's copy has no rows, and a newer edit: a rename
    const remote = { ...b, name: "Renamed", updatedAt: b.updatedAt + 1000, deletedAt: null, tiles: b.tiles };
    mergeRemote(scope, [remote], true);
    const [kept] = listBoards(scope);
    expect(kept.name).toBe("Renamed");
    expect((kept.tiles[0] as MetricTile).snapshot).toEqual(snapshot);
    // a new window draws other rows: the kept ones go
    const wider = { ...remote, updatedAt: remote.updatedAt + 1000, tiles: b.tiles.map((t) => ({ ...t, days: 365 })) };
    mergeRemote(scope, [wider], true);
    expect((listBoards(scope)[0].tiles[0] as MetricTile).snapshot).toBeUndefined();
  });

  it("open for anyone with the link", () => {
    const b = pg();
    expect(sharedTiles([...b.tiles, { kind: "nope" }]).map((t) => t.kind)).toEqual(["metric"]);
  });
});
