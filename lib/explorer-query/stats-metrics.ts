/* A board's second kind of chart: daily series from the stats API, the
   figures the stats pages show. Playground dashboards were built from
   them (playground.ts brings those over as boards). Query's tables
   cannot make most of them (the X-Chain, burn and rewards, every chain
   at once), so a metric tile reads the route the Playground read, and
   its figures are the ones its reader saw there. */

import type { ColumnMeta } from "./clickhouse";
import type { Format, VisualSpec } from "./visual";
// types only: the account's routes check tiles against this catalog (board-wire.ts), and the store is the page's
import type { MetricSeries, MetricTile } from "./board";

type Row = Record<string, unknown>;

/** the stats API's metrics, as /api/chain-stats names them; AVAX amounts are the Primary Network's */
export const METRICS = {
  activeAddresses: { name: "Active addresses", format: "number" },
  activeSenders: { name: "Active senders", format: "number" },
  cumulativeAddresses: { name: "Cumulative addresses", format: "number" },
  cumulativeDeployers: { name: "Cumulative deployers", format: "number" },
  txCount: { name: "Transactions", format: "number" },
  cumulativeTxCount: { name: "Cumulative transactions", format: "number" },
  cumulativeContracts: { name: "Cumulative contracts", format: "number" },
  contracts: { name: "Contracts", format: "number" },
  deployers: { name: "Deployers", format: "number" },
  gasUsed: { name: "Gas used", format: "gas" },
  avgGps: { name: "Avg GPS", format: "number" },
  maxGps: { name: "Max GPS", format: "number" },
  avgTps: { name: "Avg TPS", format: "number" },
  maxTps: { name: "Max TPS", format: "number" },
  avgGasPrice: { name: "Avg gas price", format: "number" },
  maxGasPrice: { name: "Max gas price", format: "number" },
  feesPaid: { name: "Fees paid", format: "number" },
  icmMessages: { name: "ICM messages", format: "number" },
  dailyRewards: { name: "Daily rewards", format: "avax" },
  cumulativeRewards: { name: "Cumulative rewards", format: "avax" },
  cChainFeesDaily: { name: "C-Chain fees", format: "avax" },
  pChainFeesDaily: { name: "P-Chain fees", format: "avax" },
  xChainFeesDaily: { name: "X-Chain fees", format: "avax" },
  validatorFeesDaily: { name: "Validator fees", format: "avax" },
  cumulativeCChainFees: { name: "Cumulative C-Chain fees", format: "avax" },
  cumulativePChainFees: { name: "Cumulative P-Chain fees", format: "avax" },
  cumulativeXChainFees: { name: "Cumulative X-Chain fees", format: "avax" },
  cumulativeValidatorFees: { name: "Cumulative validator fees", format: "avax" },
  totalBurnDaily: { name: "Burn", format: "avax" },
  cumulativeBurn: { name: "Cumulative burn", format: "avax" },
  netEmissionsDaily: { name: "Net emissions", format: "avax" },
  netCumulativeEmissions: { name: "Net cumulative emissions", format: "avax" },
} as const satisfies Record<string, { name: string; format: Format }>;

export type MetricKey = keyof typeof METRICS;
export const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];
export const isMetricKey = (k: unknown): k is MetricKey => typeof k === "string" && Object.hasOwn(METRICS, k);

/** a series' chain: an EVM chain id, "all" (every chain at once) or "primary" (the Primary Network) */
export const METRIC_CHAIN = /^(all|primary|\d{1,12})$/;
/** a chart draws at most this many series, as a panel does */
export const MAX_METRIC_SERIES = 6;
/** the days a metric tile shows when it names none: the Playground's own first view */
export const DEFAULT_DAYS = 90;
/** the windows a reader can pick; null is every day the stats API has */
export const METRIC_WINDOWS: (number | null)[] = [30, 90, 365, null];

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/* The label of each series, which is also its column: the metric when
   one chain draws them all, the chain when one metric does, else both.
   Held to a panel's 32 characters, and never the same twice. */
export function seriesLabels(series: MetricSeries[]): string[] {
  const oneChain = new Set(series.map((s) => s.chainId)).size === 1;
  const oneMetric = new Set(series.map((s) => s.metric)).size === 1;
  const seen = new Set<string>(["day"]);
  return series.map((s) => {
    const metric = METRICS[s.metric].name;
    const base = clip(oneChain ? metric : oneMetric ? s.chainName : `${s.chainName} ${metric.toLowerCase()}`, 32);
    let label = base;
    for (let n = 2; seen.has(label); n++) label = `${clip(base, 29)} ${n}`;
    seen.add(label);
    return label;
  });
}

/** the chains a tile draws, when its labels do not name them */
export function metricChains(tile: MetricTile): string | null {
  const names = [...new Set(tile.series.map((s) => s.chainName))];
  return names.length === 1 ? names[0] : null;
}

/** what a tile is called when its dashboard gave it only a default name: its metrics (the legend and the footer name the chains) */
export function metricTitle(tile: MetricTile): string {
  return tile.title || clip([...new Set(tile.series.map((s) => METRICS[s.metric].name))].join(", "), 80);
}

/** the days a tile shows, in words */
export function windowText(tile: Pick<MetricTile, "days" | "from" | "to">): string {
  if (tile.from && tile.to) return `${tile.from} to ${tile.to}`;
  if (tile.days) return tile.days === 365 ? "Last year" : `Last ${tile.days} days`;
  return "All days";
}

/** the tile as the board's charts draw it: one panel over the days, a series per metric */
export function metricVisual(tile: MetricTile): VisualSpec {
  const labels = seriesLabels(tile.series);
  const marks = new Set(tile.series.map((s) => s.mark));
  const one = marks.size === 1 ? tile.series[0].mark : null;
  return {
    stats: [],
    callouts: [],
    panels: [
      {
        title: "",
        kind: one ?? "line",
        x: "day",
        series: tile.series.map((s, i) => ({
          column: labels[i],
          label: labels[i],
          format: METRICS[s.metric].format,
          axis: s.axis,
          mark: one ? "auto" : s.mark,
          transform: "none",
          dashed: false,
        })),
        markers: [],
        bands: [],
        stacked: tile.stacked,
        sortDir: "desc",
        referenceLines: [],
        width: "full",
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* the rows                                                            */

export interface Point {
  date: string;
  value: number;
}

/** a day as the route writes it, 2026-09-21: a pattern, not the DAY span in values.ts */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** one metric's days from the route's answer, oldest first; an ICM count is its messages */
export function pointsOf(body: unknown, metric: MetricKey): Point[] {
  const m = (body as Record<string, { data?: unknown } | undefined> | null)?.[metric];
  if (!m || !Array.isArray(m.data)) return [];
  const out: Point[] = [];
  for (const p of m.data as { date?: unknown; value?: unknown; messageCount?: unknown }[]) {
    const raw = metric === "icmMessages" ? p?.messageCount : p?.value;
    const value = typeof raw === "string" ? Number.parseFloat(raw) : raw;
    if (typeof p?.date === "string" && DAY.test(p.date) && typeof value === "number" && Number.isFinite(value)) out.push({ date: p.date, value });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** every series on one row a day, oldest first; a day a series lacks is null there */
export function joinPoints(labels: string[], series: Point[][]): Row[] {
  const byDay = new Map<string, Row>();
  series.forEach((points, i) => {
    for (const p of points) {
      let row = byDay.get(p.date);
      if (!row) {
        row = { day: p.date };
        for (const l of labels) row[l] = null;
        byDay.set(p.date, row);
      }
      row[labels[i]] = p.value;
    }
  });
  return [...byDay.values()].sort((a, b) => ((a.day as string) < (b.day as string) ? -1 : 1));
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** the rows a tile's window holds: its dates, or its last days up to the newest one there is */
export function windowRows(rows: Row[], w: Pick<MetricTile, "days" | "from" | "to">): Row[] {
  if (w.from && w.to) return rows.filter((r) => (r.day as string) >= w.from! && (r.day as string) <= w.to!);
  if (!w.days || !rows.length) return rows;
  const first = addDays(rows[rows.length - 1].day as string, 1 - w.days);
  return rows.filter((r) => (r.day as string) >= first);
}

export function metricColumns(labels: string[]): ColumnMeta[] {
  return [{ name: "day", type: "Date" }, ...labels.map((name) => ({ name, type: "Float64" }))];
}

/* ------------------------------------------------------------------ */
/* the reads: one per chain and metric however many tiles draw it, and  */
/* a few at a time. The route and the browser keep each answer 4 hours */

const MAX_IN_FLIGHT = 4;
let inFlight = 0;
const waiting: (() => void)[] = [];
const reading = new Map<string, Promise<Point[]>>();

function queued<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      inFlight++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          inFlight--;
          waiting.shift()?.();
        });
    };
    if (inFlight < MAX_IN_FLIGHT) run();
    else waiting.push(run);
  });
}

/** every day the stats API has of one metric on one chain */
export function readMetric(chainId: string, metric: MetricKey): Promise<Point[]> {
  const key = `${chainId}:${metric}`;
  const open = reading.get(key);
  if (open) return open;
  const p = queued(async () => {
    const res = await fetch(`/api/chain-stats/${encodeURIComponent(chainId)}?timeRange=all&metrics=${metric}`);
    if (!res.ok) throw new Error(`The stats API answered ${res.status}`);
    return pointsOf(await res.json(), metric);
  }).finally(() => reading.delete(key));
  reading.set(key, p);
  return p;
}

/** a tile's days, every one the stats API has; its window is drawn from these */
export async function loadMetricTile(tile: MetricTile): Promise<Row[]> {
  const labels = seriesLabels(tile.series);
  const series = await Promise.all(tile.series.map((s) => readMetric(s.chainId, s.metric)));
  if (series.every((points) => points.length === 0)) throw new Error("The stats API has no days of these metrics");
  return joinPoints(labels, series);
}
