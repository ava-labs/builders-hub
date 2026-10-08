/* Playground dashboards, as boards. The Playground (stats/playground)
   gave way to Query. A signed-in reader's dashboards come over to their
   C-Chain boards the first time a Query page reads the account
   (board-sync.ts): a board per dashboard, a metric tile per chart
   (stats-metrics.ts), with the same series and days. A board's id is
   made from its dashboard's, so every device makes the same board, and
   one the account has, or has deleted, is never made again (the account
   keeps the delete of such a board for good: api/explorer/boards). */

import { adoptBoards, type Board, type MetricSeries, type MetricTile } from "./board";
import { playgroundBoardId } from "./board-links";
import { MAX_TILES } from "./board-limits";
import { DEFAULT_DAYS, MAX_METRIC_SERIES, METRIC_CHAIN, isMetricKey } from "./stats-metrics";

/** the boards a Playground dashboard comes over to */
export const PLAYGROUND_SCOPE = "mainnet:c-chain";
export { playgroundBoardId };

/** a dashboard as GET /api/playground lists the reader's own */
export interface PlaygroundDashboard {
  id: string;
  name?: string | null;
  charts?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);

/* the saved JSON, in either shape: { globalStartTime, globalEndTime,
   charts }, or the charts alone, as the first dashboards kept them */
function chartsOf(raw: unknown): { charts: Loose[]; start: unknown; end: unknown } {
  if (Array.isArray(raw)) return { charts: raw.filter(isObj), start: null, end: null };
  if (isObj(raw)) return { charts: Array.isArray(raw.charts) ? raw.charts.filter(isObj) : [], start: raw.globalStartTime, end: raw.globalEndTime };
  return { charts: [], start: null, end: null };
}

/* A picked date as its day. The picker kept the reader's local midnight
   in UTC, so a reader east of UTC saved 21:00 the day before; the
   nearest midnight is the day they picked, for any zone within 12 hours. */
export function pickedDay(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(Math.round(ms / 86_400_000) * 86_400_000).toISOString().slice(0, 10);
}

/** the names the Playground gave a chart itself */
const DEFAULT_TITLE = /^(chart \d+|blank chart)$/i;
const MARKS: readonly MetricSeries["mark"][] = ["bar", "line", "area"];

/** a chart as a tile; null when it draws nothing */
function tileOf(c: Loose, i: number, start: unknown, end: unknown): MetricTile | null {
  const series: MetricSeries[] = [];
  for (const s of Array.isArray(c.dataSeries) ? c.dataSeries.filter(isObj) : []) {
    // a series its reader hid drew nothing
    if (s.visible === false || typeof s.chainId !== "string" || !METRIC_CHAIN.test(s.chainId) || !isMetricKey(s.metricKey)) continue;
    series.push({
      chainId: s.chainId,
      chainName: (typeof s.chainName === "string" && s.chainName.trim() ? s.chainName.trim() : s.chainId).slice(0, 80),
      metric: s.metricKey,
      mark: MARKS.find((m) => m === s.chartStyle) ?? "line",
      // its third and fourth axes stood on the left and the right
      axis: s.yAxis === "right" || s.yAxis === "y4" ? "right" : "left",
    });
    if (series.length === MAX_METRIC_SERIES) break;
  }
  if (!series.length) return null;
  // a chart's own dates win over the dashboard's, each on its own, as the Playground read them
  const from = pickedDay(c.startTime || start);
  const to = pickedDay(c.endTime || end);
  const dated = !!from && !!to && from <= to;
  // with no dates the brush chose the days: the tile keeps how many, up to the newest
  const [b0, b1] = [c.brushStartIndex, c.brushEndIndex];
  const brushed = typeof b0 === "number" && typeof b1 === "number" && b1 >= b0 ? Math.round(b1 - b0) + 1 : null;
  const title = typeof c.title === "string" ? c.title.trim() : "";
  return {
    kind: "metric",
    id: `t${i}`,
    title: DEFAULT_TITLE.test(title) ? "" : title.slice(0, 200),
    series,
    stacked: c.stackSameMetrics === true,
    days: dated ? null : Math.min(brushed ?? DEFAULT_DAYS, 20_000),
    from: dated ? from : null,
    to: dated ? to : null,
    size: c.colSpan === 6 ? "m" : "w",
    order: i,
  };
}

/** a dashboard as a board; null when none of its charts draws anything */
export function boardFromPlayground(d: PlaygroundDashboard): Board | null {
  if (typeof d?.id !== "string" || !d.id) return null;
  const { charts, start, end } = chartsOf(d.charts);
  const tiles = charts
    .flatMap((c, i) => tileOf(c, i, start, end) ?? [])
    .slice(0, MAX_TILES)
    .map((t, order) => ({ ...t, order }));
  if (!tiles.length) return null;
  const createdAt = Date.parse(d.created_at ?? "") || Date.now();
  // the dashboard's own time, so an edit made on the board since is newer and wins
  const updatedAt = Date.parse(d.updated_at ?? "") || createdAt;
  const name = typeof d.name === "string" ? d.name.trim().slice(0, 80) : "";
  return { id: playgroundBoardId(d.id), name: name || "Untitled board", createdAt, updatedAt, tiles };
}

// one read of the reader's dashboards per page, once it answers
const brought = new Set<string>();

/* The reader's dashboards the account has never had, taken into the
   store; `known` is every board id the account holds or has deleted.
   Returns the boards taken in, for the sync to send up. */
export async function bringPlaygrounds(scope: string, known: Set<string>): Promise<Board[]> {
  if (scope !== PLAYGROUND_SCOPE || brought.has(scope)) return [];
  const res = await fetch("/api/playground", { cache: "no-store" });
  if (!res.ok) return [];
  const list = (await res.json().catch(() => null)) as PlaygroundDashboard[] | null;
  if (!Array.isArray(list)) return [];
  brought.add(scope);
  return adoptBoards(
    scope,
    list.map(boardFromPlayground).filter((b): b is Board => !!b && !known.has(b.id)),
  );
}
