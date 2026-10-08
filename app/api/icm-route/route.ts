import { NextRequest, NextResponse } from "next/server";
import { CB58ToHex } from "@avalanche-sdk/client/utils";
import { catalogOf } from "@/lib/explorer-catalog";
import { runQuery } from "@/lib/explorer-query/clickhouse";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { fetchIndexedChainIds, toStatsChainId } from "@/lib/stats-coverage";
import type { L1Chain } from "@/types/stats";

/* One ICM route's history, both ways: its messages per hour (a day's
   window) or per day (a week's or a month's), and its newest messages,
   read from the Teleporter logs of whichever end the index holds: each
   way is counted once, as the larger of its sender's sends and its
   receiver's deliveries (the city's flows count it the same way, in
   lib/icm-clickhouse.ts getICMFlowDataBothSides), and the answer says
   which. With the sender's logs whole its sends are the larger; with them
   behind, its deliveries stand in. The series
   is kept a while per pair and window, the newest messages per pair
   whatever the window, so a panel that opens costs stats-api two small
   queries and a change of window one; the key allows only two in flight,
   and Query shares them. A way between two chains the index does not hold
   cannot be counted. Both ends are chains of one network: mainnet, or Fuji
   with network=fuji. */

export const dynamic = "force-dynamic";

// SendCrossChainMessage(bytes32 indexed messageID, bytes32 indexed destinationBlockchainID, ...)
const SEND = "2A211AD4A59AB9D003852404F9C57C690704EE755F3C79D2C2812AD32DA99DF8";
// ReceiveCrossChainMessage(bytes32 indexed messageID, bytes32 indexed sourceBlockchainID, address indexed deliverer, ...)
const RECEIVE = "292EE90BBAF70B5D4936025E09D56BA08F3E421156B6A568CF3C2840D9343E34";
const WINDOWS = new Set([1, 7, 30]);
/** how long an answer is kept: a day's window moves by the hour, the longer ones by the day */
const ttlOf = (days: number) => (days === 1 ? 10 : 60) * 60_000;
/** the newest messages the panel lists, found in the last month */
const LATEST = 6;

interface End {
  id: string;
  /** its EVM chain ID when the index holds its logs; a message that lands anywhere else cannot be counted */
  evm: number | null;
  /** its blockchain ID as 64 hex digits, capitals, as a log topic holds it */
  hex: string;
}
type Dir = "ab" | "ba";
/** where a way is counted: its sender's sends, or its receiver's deliveries */
export type Side = "sent" | "delivered";
export interface RouteHistory {
  a: string;
  b: string;
  days: number;
  bucket: "hour" | "day";
  /** how each way is counted, or null when the index holds neither end */
  ways: Record<Dir, Side | null>;
  /** every bucket of the window, oldest first, the first one partial: its start (ms) and its messages each way */
  series: { t: number; ab: number; ba: number }[];
  totals: Record<Dir, number>;
  /** the route's newest messages in the last month, newest first */
  latest: { dir: Dir; at: number; messageId: string; tx: string }[];
  /** when the answer was read, ms */
  asOf: number;
}

/* a route's end: its blockchain ID for the log topics, and its EVM chain ID when the index holds it. With the index's
   list out of reach, a chain with an EVM ID is counted: an outage here is not evidence about the chain. The catalog
   is the route's network's: a route never crosses from one network to the other */
function endOf(id: string, indexed: Set<string> | null, catalog: Map<string, L1Chain>): End | null {
  const c = catalog.get(id);
  if (!c?.blockchainId) return null;
  try {
    const hex = (c.blockchainId.startsWith("0x") ? c.blockchainId.slice(2) : CB58ToHex(c.blockchainId).slice(2)).toUpperCase();
    if (!/^[0-9A-F]{64}$/.test(hex)) return null;
    const stats = toStatsChainId(id);
    const held = /^\d+$/.test(stats) && (indexed ? indexed.has(stats) : true);
    return { id, evm: held ? Number(stats) : null, hex };
  } catch {
    return null;
  }
}

/* a small cache: an answer kept for its TTL, and one question in flight per key */
function keeper<T extends { asOf: number }>() {
  const kept = new Map<string, T>();
  const asked = new Map<string, Promise<T>>();
  return {
    fresh: (key: string, ttl: number) => {
      const hit = kept.get(key);
      return hit && Date.now() - hit.asOf < ttl ? hit : null;
    },
    stale: (key: string) => kept.get(key) ?? null,
    get: (key: string, run: () => Promise<T>) => {
      let p = asked.get(key);
      if (!p) {
        p = run()
          .then((v) => {
            kept.set(key, v);
            return v;
          })
          .finally(() => asked.delete(key));
        asked.set(key, p);
      }
      return p;
    },
  };
}
type Series = Omit<RouteHistory, "latest">;
type Latest = { asOf: number; rows: RouteHistory["latest"] };
const seriesKept = keeper<Series>();
const latestKept = keeper<Latest>();
/** the newest messages move by the minute; they are kept as long as a day's series */
const LATEST_TTL = 10 * 60_000;

/* a UTC bucket's start as ClickHouse writes it, 2026-09-25 19:00:00 */
const msOf = (t: unknown) => Date.parse(`${String(t).replace(" ", "T").slice(0, 19)}Z`);

interface Way {
  dir: Dir;
  side: Side;
  /** the chain whose logs count it */
  on: number;
  topic0: string;
  /** the other end's blockchain ID, as its topic2 holds it */
  other: string;
}
/* the sides a way can be counted on: its sender's sends when the index holds the sender, its receiver's deliveries when it holds the receiver */
function sidesOf(dir: Dir, from: End, to: End): Way[] {
  const out: Way[] = [];
  if (from.evm !== null) out.push({ dir, side: "sent", on: from.evm, topic0: SEND, other: to.hex });
  if (to.evm !== null) out.push({ dir, side: "delivered", on: to.evm, topic0: RECEIVE, other: from.hex });
  return out;
}
/* every side the index can count both ways, and the SQL that reads them */
function waysOf(a: End, b: End) {
  const ways = [...sidesOf("ab", a, b), ...sidesOf("ba", b, a)];
  const cond = (w: Way) => `(chain_id = ${w.on} AND topic0 = unhex('${w.topic0}') AND topic2 = unhex('${w.other}'))`;
  return {
    ways,
    // a row's way and side, told apart by its whole condition: one chain can hold one way's sends and the other's deliveries
    kind: ways.length ? `multiIf(${ways.map((w) => `${cond(w)}, '${w.dir}:${w.side}'`).join(", ")}, '')` : "''",
    on: [...new Set(ways.map((w) => w.on))].join(", "),
    where: ways.map(cond).join(" OR "),
  };
}

async function seriesOf(a: End, b: End, days: number): Promise<Series> {
  const { ways, kind, on, where } = waysOf(a, b);
  const hour = days === 1;
  const step = hour ? 3_600_000 : 86_400_000;
  const now = Date.now();
  const first = Math.floor((now - days * 86_400_000) / step) * step;
  const series: RouteHistory["series"] = [];
  for (let t = first; t <= now; t += step) series.push({ t, ab: 0, ba: 0 });
  const body: Series = {
    a: a.id,
    b: b.id,
    days,
    bucket: hour ? "hour" : "day",
    // a way with a side to count on starts on its sender's; the counts below may hand it to its receiver's
    ways: { ab: ways.find((w) => w.dir === "ab")?.side ?? null, ba: ways.find((w) => w.dir === "ba")?.side ?? null },
    series,
    totals: { ab: 0, ba: 0 },
    asOf: now,
  };
  if (!ways.length) return body;
  const counts = await runQuery(
    `SELECT ${kind} AS kind, ${hour ? "toStartOfHour" : "toStartOfDay"}(block_time) AS t, count() AS n
FROM raw_logs
PREWHERE chain_id IN (${on}) AND block_time >= now() - INTERVAL ${days} DAY
WHERE ${where}
GROUP BY kind, t
ORDER BY t`,
  );
  // each way counts on the side that saw more of it, a tie on its sender's: never both, so no message counts twice
  const total = (k: string) => counts.rows.reduce((t, r) => t + (r.kind === k ? Number(r.n) || 0 : 0), 0);
  for (const d of ["ab", "ba"] as const) {
    if (body.ways[d] === null) continue;
    const sides = ways.filter((w) => w.dir === d).map((w) => w.side);
    body.ways[d] = sides.includes("sent") && (!sides.includes("delivered") || total(`${d}:sent`) >= total(`${d}:delivered`)) ? "sent" : "delivered";
  }
  const at = new Map(series.map((s, i) => [s.t, i]));
  for (const r of counts.rows) {
    const [d, side] = String(r.kind).split(":") as [Dir, Side];
    if (body.ways[d] !== side) continue;
    const n = Number(r.n) || 0;
    const i = at.get(msOf(r.t));
    if (i !== undefined) series[i][d] += n;
    body.totals[d] += n;
  }
  return body;
}

async function latestOf(a: End, b: End): Promise<Latest> {
  const { ways, kind, on, where } = waysOf(a, b);
  if (!ways.length) return { asOf: Date.now(), rows: [] };
  // a message the index saw both sent and delivered is one message: it keeps its first sighting, the send
  const newest = await runQuery(
    `SELECT ${kind} AS kind, block_time AS t, lower(hex(topic1)) AS message_id, lower(hex(transaction_hash)) AS tx
FROM raw_logs
PREWHERE chain_id IN (${on}) AND block_time >= now() - INTERVAL 30 DAY
WHERE ${where}
ORDER BY block_time DESC
LIMIT ${LATEST * 4}`,
  );
  const seen = new Map<string, RouteHistory["latest"][number]>();
  for (const r of newest.rows) {
    const messageId = `0x${String(r.message_id)}`;
    const row = { dir: String(r.kind).startsWith("ba") ? ("ba" as const) : ("ab" as const), at: msOf(r.t), messageId, tx: `0x${String(r.tx)}` };
    const had = seen.get(messageId);
    if (!had || row.at < had.at) seen.set(messageId, row);
  }
  return { asOf: Date.now(), rows: [...seen.values()].sort((x, y) => y.at - x.at).slice(0, LATEST) };
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams;
  const network = q.get("network") ?? "mainnet";
  if (!isPchainNetwork(network)) return NextResponse.json({ error: `unknown network '${network}'` }, { status: 400 });
  const days = Number(q.get("days") ?? 1);
  const indexed = await fetchIndexedChainIds();
  const a = endOf(q.get("a") ?? "", indexed, catalogOf(network));
  const b = endOf(q.get("b") ?? "", indexed, catalogOf(network));
  if (!WINDOWS.has(days)) return NextResponse.json({ error: "days is 1, 7 or 30" }, { status: 400 });
  if (!a || !b || a.id === b.id) return NextResponse.json({ error: `a and b name two ${network === "fuji" ? "Fuji" : "mainnet"} chains of the catalog` }, { status: 404 });
  const pairKey = `${network}~${a.id}~${b.id}`;
  const key = `${pairKey}~${days}`;
  const ttl = ttlOf(days);
  // a shared cache keeps it no longer than its newest messages stay fresh
  const edge = Math.min(ttl, LATEST_TTL) / 1000;
  const headers = { "Cache-Control": `public, s-maxage=${edge}, stale-while-revalidate=${edge * 6}` };
  try {
    const series = seriesKept.fresh(key, ttl) ?? (await seriesKept.get(key, () => seriesOf(a, b, days)));
    const latest = latestKept.fresh(pairKey, LATEST_TTL) ?? (await latestKept.get(pairKey, () => latestOf(a, b)));
    // the answer is as old as its older part
    const body: RouteHistory = { ...series, latest: latest.rows, asOf: Math.min(series.asOf, latest.asOf) };
    return NextResponse.json(body, { headers });
  } catch (err) {
    console.error(`[icm-route] ${key}:`, err);
    // a kept answer, however old, beats none; it carries its own asOf
    const series = seriesKept.stale(key);
    if (series) {
      const latest = latestKept.stale(pairKey);
      return NextResponse.json({ ...series, latest: latest?.rows ?? [], asOf: Math.min(series.asOf, latest?.asOf ?? series.asOf) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "unavailable" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
