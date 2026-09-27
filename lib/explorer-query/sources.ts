import "server-only";
import { FUJI_VALIDATOR_DISCOVERY_URL, MAINNET_VALIDATOR_DISCOVERY_URL } from "@/constants/validator-discovery";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { minorVersionLine } from "@/lib/node-version";
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import type { SubnetStats } from "@/types/validator-stats";
import { PCHAIN_IDS, targetOf } from "./target";
import type { SourceNote } from "./types";

/* What the server puts in front of a question's SQL. Two kinds of table:

   Reference tables hold what our own server knows that the ClickHouse
   box does not. The model reads one like any table; anchored()
   (clickhouse.ts) defines it in front of the query as a named subquery
   over the source's rows, so the guard, recipes, drills and boards keep
   the SQL as the model wrote it, and every run reads the source as it is
   now. The query service takes 8 KiB of SQL and no external data, so a
   table stays small: aggregated rows, each id once. A table only ever
   gains columns: a board's SQL may read any column it has.

   Deduplicated tables (target.final) hold rows that a re-ingest wrote
   twice and the box never merged. A query reads them through a subquery
   with FINAL under the table's own name, so a count counts transactions,
   not rows. The data fix belongs to the box. */

/** the most SQL the query service takes, in bytes */
export const SQL_BUDGET = 8192;
/** what a table's rows may take of it; the rest is the query's own */
const ROWS_BUDGET = SQL_BUDGET - 2048;

type Network = "mainnet" | "fuji";
const networkOf = (chainId: number): Network => (chainId === PCHAIN_IDS.fuji ? "fuji" : "mainnet");

interface Source {
  /** the columns the table always has, in order, with their types */
  columns: readonly (readonly [string, string])[];
  /** the table's rows as one SELECT for this target and this query, and what they cover */
  build(chainId: number, sql: string): Promise<{ sql: string; note: SourceNote }>;
}

const FEED_TIMEOUT_MS = 20_000;
const fmt = (n: number) => n.toLocaleString("en-US");

async function getJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${what} answered ${res.status}`);
  return (await res.json()) as T;
}

/** one value per network: fresh for a while, then served stale while it is read again, and the last good one while a read fails */
function kept<T extends { at: number }>(read: (network: Network) => Promise<T>, freshMs: number, keepMs: number, what: string) {
  const values = new Map<Network, T>();
  const loading = new Map<Network, Promise<T>>();
  return {
    /** the value as it is now, or the reason it is not */
    async get(network: Network): Promise<T> {
      const hit = values.get(network);
      const age = hit ? Date.now() - hit.at : Infinity;
      if (hit && age < freshMs) return hit;
      let load = loading.get(network);
      if (!load) {
        load = read(network)
          .then((v) => {
            values.set(network, v);
            return v;
          })
          .finally(() => loading.delete(network));
        loading.set(network, load);
      }
      if (hit && age < keepMs) {
        load.catch(() => {});
        return hit;
      }
      try {
        return await load;
      } catch (e) {
        throw new Error(`${what} are not available right now (${e instanceof Error ? e.message : String(e)}). Try again in a few minutes.`);
      }
    },
    /** the last value read, with no read */
    peek: (network: Network): T | undefined => values.get(network),
  };
}

/** the value, or the fallback when it does not come in time */
const within = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/* ------------------------------------------------------------------ */
/* p_validator_versions                                                */

/* Every validator seat's AvalancheGo version line, per subnet and line.
   The seats and the versions are read as /api/validator-stats reads them,
   so an answer and the explorer's validator pages agree: the Primary
   Network's set with the versions our nodes saw in the last day
   (stats-api /api/{network}/validators), every active L1 seat (stats-api
   /v1/.../l1Validators), and for the nodes our nodes do not peer with,
   most L1 validators, the discovery crawler's last version. The crawler
   keeps what it last saw, so each line also counts how recent its
   versions are. */

interface VersionSet {
  /** subnet ids (CB58), the Primary Network first */
  subnets: string[];
  /** version lines, newest first, Unknown last */
  lines: string[];
  /** [subnet index, line index, seats, weight, seen in a day, seen in 7 days, from the crawler] */
  rows: [number, number, number, bigint, number, number, number][];
  /** the crawler answered */
  crawler: boolean;
  /** unix ms the feed was read */
  at: number;
}

const UNKNOWN = "Unknown";
const CB58 = /^[1-9A-HJ-NP-Za-km-z]{30,60}$/;
const NODE = /^NodeID-[1-9A-HJ-NP-Za-km-z]{20,60}$/;
const LINE = /^\d{1,3}\.\d{1,3}$/;
const DAY_MS = 86_400_000;

/** newest line first; Unknown after every line */
function byLine(a: string, b: string): number {
  if (a === UNKNOWN || b === UNKNOWN) return a === b ? 0 : a === UNKNOWN ? 1 : -1;
  const [x, y] = [a, b].map((l) => l.split(".").map(Number));
  return y[0] - x[0] || y[1] - x[1];
}

const whole = (v: unknown): bigint => (/^\d{1,30}$/.test(String(v)) ? BigInt(String(v)) : 0n);

/** a /v1 list, page after page, as /api/validator-stats reads it */
async function pages<T>(path: string, field: string): Promise<T[]> {
  const out: T[] = [];
  let token: string | undefined;
  for (let i = 0; i < 200; i++) {
    const page = await getJson<Record<string, unknown>>(`${EXPLORER_API_BASE}${path}&pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`, "the L1 validator list");
    const got = Array.isArray(page[field]) ? (page[field] as T[]) : [];
    out.push(...got);
    token = typeof page.nextPageToken === "string" ? page.nextPageToken : undefined;
    if (!token || got.length < 100) break;
  }
  return out;
}

interface Upstream {
  nodeId?: string;
  subnetId?: string;
  weight?: number | string;
  totalStake?: number | string;
  remainingBalance?: number | string;
  version?: string;
}

async function readVersions(network: Network): Promise<VersionSet> {
  const [primary, l1s, crawled] = await Promise.all([
    getJson<{ validators?: Upstream[] }>(`${EXPLORER_API_BASE}/api/${network}/validators`, "the validator set"),
    pages<Upstream>(`/v1/networks/${network}/l1Validators?includeInactive=false`, "validators"),
    // the crawler is best effort, as it is for the validator pages
    getJson<{ nodeId?: string; version?: string; lastSeenOnline?: number }[]>(network === "fuji" ? FUJI_VALIDATOR_DISCOVERY_URL : MAINNET_VALIDATOR_DISCOVERY_URL, "the discovery crawler").catch(() => null),
  ]);
  const seats = [
    ...(primary.validators ?? []).map((v) => ({ node: v.nodeId, subnet: v.subnetId, weight: whole(v.totalStake ?? v.weight) })),
    // an L1 seat counts while it has weight and balance, as on the validator pages
    ...l1s.filter((v) => whole(v.weight) > 0n && whole(v.remainingBalance) > 0n).map((v) => ({ node: v.nodeId, subnet: v.subnetId, weight: whole(v.weight) })),
  ];
  // what our nodes saw in the last day wins; the crawler fills the rest
  const ours = new Map((primary.validators ?? []).filter((v) => v.nodeId && v.version).map((v) => [v.nodeId!, v.version!]));
  const theirs = new Map((crawled ?? []).filter((c) => c?.nodeId && c.version).map((c) => [c.nodeId!, { version: c.version!, seen: Number(c.lastSeenOnline) || 0 }]));
  const now = Date.now();
  // every value below goes into SQL text: ids, lines and counts are checked
  // against their own shapes, and names never go in
  const by = new Map<string, Map<string, { n: number; w: bigint; day: number; week: number; crawler: number }>>();
  for (const s of seats) {
    if (typeof s.subnet !== "string" || !CB58.test(s.subnet) || typeof s.node !== "string" || !NODE.test(s.node)) continue;
    const mine = ours.get(s.node);
    const far = mine ? undefined : theirs.get(s.node);
    const raw = minorVersionLine(mine ?? far?.version);
    const line = LINE.test(raw) ? raw : UNKNOWN;
    const age = mine ? 0 : far ? now - far.seen : Infinity;
    const lines = by.get(s.subnet) ?? by.set(s.subnet, new Map()).get(s.subnet)!;
    const had = lines.get(line) ?? { n: 0, w: 0n, day: 0, week: 0, crawler: 0 };
    const known = line !== UNKNOWN;
    lines.set(line, {
      n: had.n + 1,
      w: had.w + s.weight,
      day: had.day + Number(known && age < DAY_MS),
      week: had.week + Number(known && age < 7 * DAY_MS),
      crawler: had.crawler + Number(known && !mine),
    });
  }
  if (by.size === 0) throw new Error("the validator set is empty");
  const count = (id: string) => [...by.get(id)!.values()].reduce((t, v) => t + v.n, 0);
  const subnets = [...by.keys()].sort((a, b) => (a === PRIMARY_SUBNET_ID ? -1 : b === PRIMARY_SUBNET_ID ? 1 : count(b) - count(a) || (a < b ? -1 : 1)));
  const lines = [...new Set([...by.values()].flatMap((l) => [...l.keys()]))].sort(byLine);
  const rows: VersionSet["rows"] = [];
  subnets.forEach((id, i) => {
    for (const [line, v] of [...by.get(id)!].sort((a, b) => byLine(a[0], b[0]))) rows.push([i, lines.indexOf(line), v.n, v.w, v.day, v.week, v.crawler]);
  });
  return { subnets, lines, rows, crawler: crawled !== null, at: now };
}

/** the validator lists refresh every 15 minutes; a failed read is answered from the last good set for 6 hours */
const versionFeed = kept(readVersions, 15 * 60_000, 6 * 3600_000, "validator versions");

const versions: Source = {
  columns: [
    ["chain_id", "UInt8"],
    ["subnet_id", "String"],
    ["is_l1", "UInt8"],
    ["version", "String"],
    ["seats", "UInt32"],
    ["weight", "UInt64"],
    ["seen_day", "UInt32"],
    ["seen_week", "UInt32"],
    ["from_crawler", "UInt32"],
  ],
  async build(chainId, query) {
    const set = await versionFeed.get(networkOf(chainId));
    const lines = set.lines.map((l) => `'${l}'`).join(",");
    const head =
      `SELECT toUInt8(${chainId}) AS chain_id, s[tupleElement(r, 1)] AS subnet_id, toUInt8(subnet_id != '${PRIMARY_SUBNET_ID}') AS is_l1, ` +
      `v[tupleElement(r, 2)] AS version, toUInt32(tupleElement(r, 3)) AS seats, toUInt64(tupleElement(r, 4)) AS weight, ` +
      `toUInt32(tupleElement(r, 5)) AS seen_day, toUInt32(tupleElement(r, 6)) AS seen_week, toUInt32(tupleElement(r, 7)) AS from_crawler ` +
      `FROM (SELECT [] AS s, [${lines}] AS v, arrayJoin([]) AS r)`;
    // the sets a query names by id go first, then the Primary Network and the largest, while their rows fit
    const named = new Set(query.match(/[1-9A-HJ-NP-Za-km-z]{30,60}/g) ?? []);
    const order = set.subnets.map((_, i) => i).sort((a, b) => Number(named.has(set.subnets[b])) - Number(named.has(set.subnets[a])) || a - b);
    const ids: string[] = [];
    const rows: string[] = [];
    const chosen = new Set<number>();
    let bytes = head.length;
    for (const i of order) {
      const own = set.rows.filter((r) => r[0] === i).map(([, l, ...v]) => `(${ids.length + 1},${l + 1},${v.join(",")})`);
      const cost = set.subnets[i].length + 3 + own.reduce((t, r) => t + r.length + 1, 0);
      if (bytes + cost > ROWS_BUDGET) continue;
      bytes += cost;
      ids.push(`'${set.subnets[i]}'`);
      rows.push(...own);
      chosen.add(i);
    }
    const sql = head.replace("[] AS s", () => `[${ids.join(",")}] AS s`).replace("arrayJoin([])", () => `arrayJoin([${rows.join(",")}])`);
    // seats in the table, known or not, on the Primary Network and on the L1s; and how recent the known versions are
    const inTable = set.rows.filter(([s]) => chosen.has(s));
    const sum = (rows: typeof inTable, k: 2 | 4 | 5 | 6) => rows.reduce((t, r) => t + Number(r[k]), 0);
    const primary = inTable.filter(([s]) => set.subnets[s] === PRIMARY_SUBNET_ID);
    const l1 = inTable.filter(([s]) => set.subnets[s] !== PRIMARY_SUBNET_ID);
    const known = (rows: typeof inTable) => rows.filter(([, l]) => set.lines[l] !== UNKNOWN);
    const total = sum(set.rows, 2);
    const held = sum(inTable, 2);
    const knownSeats = sum(known(inTable), 2);
    const crawler = sum(inTable, 6);
    const first = set.subnets.some((id, i) => named.has(id) && chosen.has(i)) ? "the ones the query names, then the largest" : "the largest first";
    const text = [
      held < total ? `This table holds ${fmt(chosen.size)} of ${fmt(set.subnets.length)} validator sets, ${first}: ${fmt(held)} of ${fmt(total)} seats.` : "",
      knownSeats < held
        ? `Versions are known for ${fmt(knownSeats)} of ${fmt(held)} validator seats: ${fmt(sum(known(primary), 2))} of ${fmt(sum(primary, 2))} on the Primary Network, ${fmt(sum(known(l1), 2))} of ${fmt(sum(l1, 2))} on L1s. The rest count as Unknown.`
        : `Versions are known for all ${fmt(held)} validator seats.`,
      set.crawler
        ? `${fmt(knownSeats - crawler)} versions are what our nodes saw in the last day. ${fmt(crawler)} come from a discovery crawler that keeps the last version it saw: ${fmt(sum(inTable, 5) - (knownSeats - crawler))} of them were seen in the last 7 days.`
        : "The discovery crawler did not answer, so only the versions our nodes saw in the last day are known.",
    ]
      .filter(Boolean)
      .join(" ");
    return { sql, note: { table: "p_validator_versions", label: "validator versions", at: set.at, total, known: knownSeats, text } };
  },
};

/* ------------------------------------------------------------------ */
/* p_avax_supply                                                       */

/* The AVAX supply as the Avalanche Data API counts it (/api/avax-supply):
   the total net of what every chain burned, the burns per chain, staked,
   locked and rewards, and the continuous fees L1 validators have paid.
   The P-Chain's own supply (p_exec_state_history) is gross of the C-Chain
   and X-Chain burns, so the two differ. Mainnet only. */

interface Supply {
  values: number[];
  updated: string;
  at: number;
}

/** column, and the Data API field it is read from, in AVAX */
const SUPPLY_FIELDS = [
  ["total_supply_avax", "totalSupply"],
  ["circulating_supply_avax", "circulatingSupply"],
  ["staked_avax", "totalStaked"],
  ["locked_avax", "totalLocked"],
  ["rewards_avax", "totalRewards"],
  ["burned_p_avax", "totalPBurned"],
  ["burned_c_avax", "totalCBurned"],
  ["burned_x_avax", "totalXBurned"],
  ["l1_validator_fees_avax", "l1ValidatorFees"],
  ["genesis_unlock_avax", "genesisUnlock"],
] as const;

async function readSupply(network: Network): Promise<Supply> {
  if (network !== "mainnet") throw new Error("the Data API publishes the AVAX supply for mainnet only");
  const body = await getJson<Record<string, unknown>>(`${siteBaseUrl()}/api/avax-supply`, "the AVAX supply");
  const values = SUPPLY_FIELDS.map(([, f]) => Number(body[f]));
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error("the AVAX supply is incomplete");
  const updated = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.exec(String(body.lastUpdated ?? ""))?.[0].replace("T", " ") ?? "";
  return { values, updated, at: Date.now() };
}

/** the Data API refreshes every few hours */
const supplyFeed = kept(readSupply, 30 * 60_000, 12 * 3600_000, "AVAX supply figures");

const supply: Source = {
  columns: [["chain_id", "UInt8"], ...SUPPLY_FIELDS.map(([c]) => [c, "Float64"] as const), ["updated_at", "DateTime"]],
  async build(chainId) {
    const s = await supplyFeed.get(networkOf(chainId));
    const cols = SUPPLY_FIELDS.map(([c], i) => `toFloat64(${s.values[i]}) AS ${c}`).join(", ");
    const sql = `SELECT toUInt8(${chainId}) AS chain_id, ${cols}, ${s.updated ? `toDateTime('${s.updated}', 'UTC')` : "toDateTime(0, 'UTC')"} AS updated_at`;
    const text = `Supply figures come from the Avalanche Data API${s.updated ? `, updated ${s.updated.slice(0, 16)} UTC` : ""}.`;
    return { sql, note: { table: "p_avax_supply", label: "AVAX supply", at: s.at, total: 1, known: 1, text } };
  },
};

/* ------------------------------------------------------------------ */

const SOURCES: Record<string, Source> = { p_validator_versions: versions, p_avax_supply: supply };

/** the schema card's lines for this target's reference tables */
export function refSchema(chainId: number): string[] {
  return targetOf(chainId)
    .refs.filter((r) => SOURCES[r])
    .map((r) => `${r}(${SOURCES[r].columns.map(([n, t]) => `${n} ${t}`).join(", ")})`);
}

const reads = (sql: string, table: string) => new RegExp(`\\b(?:FROM|JOIN)\\s+[\`"]?${table}\\b`, "i").test(sql);

/** the reference tables a query reads, as the guard finds tables */
export function refsIn(sql: string, chainId: number): string[] {
  return targetOf(chainId).refs.filter((r) => SOURCES[r] && reads(sql, r));
}

/** the SQL with each reference table it reads, and each table it reads
    that holds duplicate rows, defined in front of it; and what the
    reference tables cover. Throws when a source cannot be read or the
    whole no longer fits the query service. */
export async function withSources(sql: string, chainId: number): Promise<{ sql: string; sources: SourceNote[] }> {
  const used = refsIn(sql, chainId);
  const dedup = targetOf(chainId).final.filter((t) => reads(sql, t));
  if (used.length === 0 && dedup.length === 0) return { sql, sources: [] };
  const built = await Promise.all(used.map((r) => SOURCES[r].build(chainId, sql)));
  // the inner name is the table itself: a WITH does not see its own names
  const defs = [...dedup.map((t) => `${t} AS (SELECT * FROM ${t} FINAL)`), ...used.map((r, i) => `${r} AS (${built[i].sql})`)];
  // wrapped, not merged into the query's own WITH: every branch of a UNION sees the tables
  const out = `WITH ${defs.join(", ")} SELECT * FROM (\n${sql}\n)`;
  const bytes = Buffer.byteLength(out);
  if (bytes > SQL_BUDGET) {
    const own = Buffer.byteLength(sql);
    throw new Error(`the query is too long to send with ${used.join(" and ")}: the table takes ${bytes - own} of the ${SQL_BUDGET} bytes the query service accepts, so the query may use ${SQL_BUDGET - (bytes - own)} and it uses ${own}. Write a shorter query.`);
  }
  return { sql: out, sources: built.map((b) => b.note) };
}

/** what the reference tables a query reads cover, for an answer made without anchored() */
export async function sourceNotes(sql: string, chainId: number): Promise<SourceNote[]> {
  const used = refsIn(sql, chainId);
  if (used.length === 0) return [];
  return within(Promise.all(used.map(async (r) => (await SOURCES[r].build(chainId, sql)).note)), 4000, []);
}

/** the version lines in the set, newest first, as last read; null before the first read. Reads nothing */
export function knownLines(chainId: number): string[] | null {
  return versionFeed.peek(networkOf(chainId))?.lines.filter((l) => l !== UNKNOWN) ?? null;
}

/** the version lines in the set now, newest first; null when the feed does not answer in time */
export function versionLines(chainId: number, timeoutMs = 4000): Promise<string[] | null> {
  return within(
    versionFeed.get(networkOf(chainId)).then((s) => s.lines.filter((l) => l !== UNKNOWN)),
    timeoutMs,
    null,
  );
}

/* subnet id -> name, from the explorer's validator feed: it names the L1s
   the chain catalog does not list, by their chains */
const nameFeed = kept(
  async (network: Network) => {
    const body = await getJson<SubnetStats[]>(`${siteBaseUrl()}/api/validator-stats?network=${network}`, "the validator feed");
    const names = new Map((Array.isArray(body) ? body : []).filter((s) => typeof s?.id === "string" && typeof s.name === "string" && s.name).map((s) => [s.id, s.name]));
    return { names, at: Date.now() };
  },
  3600_000,
  24 * 3600_000,
  "subnet names",
);

/** subnet id -> name; empty when the feed does not answer in time */
export function subnetNames(chainId: number, timeoutMs = 3000): Promise<Map<string, string>> {
  return within(
    nameFeed.get(networkOf(chainId)).then((s) => s.names),
    timeoutMs,
    new Map<string, string>(),
  );
}
