import "server-only";
import { FUJI_VALIDATOR_DISCOVERY_URL, MAINNET_VALIDATOR_DISCOVERY_URL } from "@/constants/validator-discovery";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { minorVersionLine } from "@/lib/node-version";
import { EXPLORER_API_BASE } from "@/lib/pchain-explorer";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { fetchAllSubnets } from "@/lib/pchain-subnets";
import type { SubnetStats } from "@/types/validator-stats";
import { DEX_CHAIN_ID, DEX_FACTORIES, DEX_LISTED_AT, DEX_TOKENS, factoriesFor, factoriesSql, readsPositions, tokensFor, tokensSql } from "./protocols";
import { FAMILY_NAMES } from "./families";
import { MEV_NAMES } from "./mev";
import { AAVE_ASSETS, LENDING_CHAIN_ID, LENDING_LISTED_AT, LENDING_MARKETS, LENDING_NAMES, LENDING_PROTOCOLS, lendingTokensFor, marketsFor, namesIn } from "./lending";
import l1ChainsData from "@/constants/l1-chains.json";
import { DEDICATED_METRICS_CHAINS, DEDICATED_STATS_BASE_URL } from "@/lib/dedicated-stats";
import { toHexBlockchainId } from "@/lib/icm-message";
import { NETWORK_ID, PCHAIN_IDS, targetOf } from "./target";
import type { SourceNote } from "./types";
import { DAY, WEEK } from "./values";

/* What the server puts in front of a question's SQL. Two kinds of table:

   Chain tables (target.tables) hold every chain's rows. anchored()
   (clickhouse.ts) defines each one a query names in front of it as the
   page's chain's rows alone, under the table's own name, so every
   SELECT, JOIN side, UNION branch and subquery reads only that chain,
   whatever filter the query writes. The guard refuses the ways past the
   name: a database prefix, a WITH of the same name, a table after a
   comma. chain_id is each table's first sort key, and ClickHouse prunes
   by the query's own window through the definition: the same parts and
   granules as the query alone (EXPLAIN on raw_txs, 2026-10-07). The
   tables that hold rows a re-ingest wrote twice, never merged
   (target.final), are read through FINAL there, so a count counts
   transactions, not rows. The data fix belongs to the box.

   Reference tables hold what our own server knows that the ClickHouse
   box does not. The model reads one like any table, defined in front of
   the query as a named subquery over the source's rows, so the guard,
   recipes, drills and boards keep the SQL as the model wrote it, and
   every run reads the source as it is now. The query service takes 16
   KiB of SQL and no external data, so a table stays small: aggregated
   rows, each id once. A table only ever gains columns: a board's SQL may
   read any column it has. */

/** the most SQL the query service takes, in bytes */
export const SQL_BUDGET = 16384;
/** what a table's rows may take of it; the rest is the query's own */
const ROWS_BUDGET = SQL_BUDGET - 2048;

type Network = "mainnet" | "fuji";
const networkOf = (chainId: number): Network => (chainId === PCHAIN_IDS.fuji ? "fuji" : "mainnet");

/** each chain table the SQL names, defined as the rows of the chains given (the page's one chain, or the network's).
    Any mention counts, not only one after FROM or JOIN, so no way of naming a table reads past its definition */
function scopeDefs(sql: string, chainId: number, ids: readonly number[] = [chainId]): string[] {
  const { tables, final } = targetOf(chainId);
  const on = ids.length === 1 ? `= ${ids[0]}` : `IN (${ids.join(", ")})`;
  return tables
    .filter((t) => new RegExp(`\\b${t}\\b`, "i").test(sql))
    .map((t) => `${t} AS (SELECT * FROM ${t}${final.includes(t) ? " FINAL" : ""} WHERE chain_id ${on})`);
}

/** what the chain tables' definitions take of the budget */
const scopeBytes = (sql: string, chainId: number) => Buffer.byteLength(scopeDefs(sql, chainId).join(", "));

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
      day: had.day + Number(known && age < DAY),
      week: had.week + Number(known && age < WEEK),
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
/* dex_factories, dex_tokens                                           */

/* The C-Chain's DEXs (protocols.ts): each protocol's pool factories, and
   the decimals of the tokens a query scales, with the quote a volume is
   counted in. A query finds a protocol's pools in its factories'
   creation logs. Mainnet only. The two share what the query leaves of
   the budget, each keeping the entries the query names: the factories
   come first, since without one a protocol loses its pools and without a
   token only its decimals; the tokens take up to TOKENS_ROOM of the rest,
   and never less than the room of the quote tokens a volume needs. */

/** the WITH around the two tables, in bytes */
const DEX_WRAP = 64;
const TOKENS_ROOM = 1600;

const QUOTES_ROOM = Buffer.byteLength(tokensSql(DEX_CHAIN_ID, DEX_TOKENS.filter((t) => t.quote !== "")));

function dexRoom(query: string) {
  const free = SQL_BUDGET - Buffer.byteLength(query) - DEX_WRAP - scopeBytes(query, DEX_CHAIN_ID);
  if (!reads(query, "dex_tokens")) return { tokens: null, factories: free };
  const left = free - Buffer.byteLength(factoriesSql(DEX_CHAIN_ID, DEX_FACTORIES, readsPositions(query)));
  const tokens = tokensFor(query, Math.min(TOKENS_ROOM, Math.max(left, QUOTES_ROOM)));
  return { tokens, factories: free - Buffer.byteLength(tokens.sql) };
}

const factories: Source = {
  columns: [
    ["chain_id", "UInt64"],
    ["protocol", "String"],
    ["version", "String"],
    ["family", "String"],
    ["factory", "String"],
    ["positions", "Array(String)"],
  ],
  async build(_chainId, query) {
    const { sql, kept } = factoriesFor(query, dexRoom(query).factories);
    const n = DEX_FACTORIES.length;
    const protocols = new Set(DEX_FACTORIES.map((f) => f.protocol)).size;
    const text =
      kept.length < n
        ? `Protocols and their pool factories come from our contract registry. This table holds ${fmt(kept.length)} of its ${fmt(n)} factories: the ones the query names, then the others in the registry's order.`
        : `Protocols and their pool factories come from our contract registry: ${fmt(n)} factories of ${fmt(protocols)} protocols.`;
    return { sql, note: { table: "dex_factories", label: "the contract registry", at: DEX_LISTED_AT, total: n, known: kept.length, text } };
  },
};

const tokens: Source = {
  columns: [
    ["chain_id", "UInt64"],
    ["token", "String"],
    ["decimals", "UInt8"],
    ["quote", "String"],
  ],
  async build(_chainId, query) {
    const { sql, kept } = dexRoom(query).tokens ?? tokensFor(query, TOKENS_ROOM);
    const n = DEX_TOKENS.length;
    const text =
      kept.length < n
        ? `Token decimals come from our list of the tokens with the most DEX volume. This table holds ${fmt(kept.length)} of its ${fmt(n)} tokens: the stablecoins, WAVAX and AVAX, then the ones the query names, then the rest.`
        : `Token decimals come from our list of the ${fmt(n)} tokens with the most DEX volume.`;
    return { sql, note: { table: "dex_tokens", label: "token decimals", at: DEX_LISTED_AT, total: n, known: kept.length, text } };
  },
};

/* ------------------------------------------------------------------ */
/* lending_markets, lending_tokens                                     */

/* The C-Chain's lending protocols (lending.ts): Benqi's markets with the
   asset each lends, and the decimals and price kind of each asset Aave or
   Benqi lends. Aave's Pool names its reserve in each event, so an Aave
   query needs only the tokens. Mainnet only. The two share what the query
   leaves of the budget, each keeping the entries the query names: the
   markets first, since without one a market loses its asset, and without
   a token only its decimals. */

/** the names our server defines in front of a query that reads them: the lending protocols', the families' and MEV's */
const SERVER_NAMES: Record<string, string> = { ...LENDING_NAMES, ...FAMILY_NAMES, ...MEV_NAMES };

/** the WITH around the two tables, in bytes */
const LENDING_WRAP = 64;

function lendingRoom(query: string) {
  // the names the server defines for the query share the budget too
  const free = SQL_BUDGET - Buffer.byteLength(query) - LENDING_WRAP - Buffer.byteLength(namesIn(query, SERVER_NAMES).join(", ")) - scopeBytes(query, LENDING_CHAIN_ID);
  const markets = reads(query, "lending_markets") ? marketsFor(query, free) : null;
  return { markets, tokens: lendingTokensFor(query, free - Buffer.byteLength(markets?.sql ?? "")) };
}

const markets: Source = {
  columns: [
    ["chain_id", "UInt64"],
    ["protocol", "String"],
    ["version", "String"],
    ["market", "String"],
    ["asset", "String"],
    ["decimals", "UInt8"],
    ["price", "String"],
  ],
  async build(_chainId, query) {
    const { sql, kept } = lendingRoom(query).markets ?? marketsFor(query, SQL_BUDGET);
    const versions = new Set(kept.map((m) => m.version));
    // a query that keeps one version gets that version's markets only
    const pool = LENDING_MARKETS.filter((m) => versions.has(m.version));
    const n = pool.length;
    const names = [...new Set(kept.map((m) => LENDING_PROTOCOLS[m.protocol] ?? m.protocol))].join(" and ");
    const which = versions.size === 1 ? ` ${[...versions][0]}` : "";
    const text =
      kept.length < n
        ? `Lending markets and the assets they lend come from our contract registry. This table holds ${fmt(kept.length)} of its ${fmt(n)}${which} markets: the ones the query names, then the others in the registry's order.`
        : `Lending markets and the assets they lend come from our contract registry: ${fmt(n)} ${names}${which} markets.`;
    return { sql, note: { table: "lending_markets", label: "the contract registry", at: LENDING_LISTED_AT, total: n, known: kept.length, text } };
  },
};

const lendingTokens: Source = {
  columns: [
    ["chain_id", "UInt64"],
    ["token", "String"],
    ["decimals", "UInt8"],
    ["price", "String"],
  ],
  async build(_chainId, query) {
    const { sql, kept } = lendingRoom(query).tokens;
    const n = AAVE_ASSETS.length;
    const text =
      kept.length < n
        ? `Token decimals and price sources come from our list of the assets Aave lends. This table holds ${fmt(kept.length)} of its ${fmt(n)} tokens: the ones the query names, then the rest.`
        : `Token decimals and price sources come from our list of the ${fmt(n)} assets Aave lends.`;
    return { sql, note: { table: "lending_tokens", label: "token decimals", at: LENDING_LISTED_AT, total: n, known: kept.length, text } };
  },
};

/* ------------------------------------------------------------------ */
/* chain_names                                                         */

/* The network's chains: the mainnet EVM chains stats-api indexes, as its
   own list (/v2/chains) names them, under the names, tokens and slugs of
   the explorer's catalog where it lists them (by blockchain ID, which
   holds for KiteAI, whose catalog id is not its EVM id; the catalog and
   the list write blockchain IDs in either encoding). When the list does
   not answer, the catalog's mainnet EVM chains stand in. */

export interface NetworkChain {
  chainId: number;
  name: string;
  /** the native token's symbol; null when the catalog does not list the chain */
  symbol: string | null;
  /** the explorer's slug for the chain; null when the catalog does not list it */
  slug: string | null;
  /** the chain's blockchain ID as 0x hex, as an ICM log's topic carries it; null when neither list holds it */
  blockchainId: string | null;
}

interface CatalogChain {
  chainId: string;
  chainName: string;
  slug: string;
  blockchainId?: string;
  isTestnet?: boolean;
  networkToken?: { symbol?: string };
}

const CATALOG = (l1ChainsData as CatalogChain[]).filter((c) => c.isTestnet !== true);
/** a catalog chain's EVM id: KiteAI's catalog id is its blockchain ID */
const evmIdOf = (c: CatalogChain) => Number(DEDICATED_METRICS_CHAINS[c.chainId] ?? c.chainId);
const hexOf = (id: string | undefined) => (id ? (toHexBlockchainId(id) ?? null) : null);
const fromCatalog = (c: CatalogChain): NetworkChain => ({ chainId: evmIdOf(c), name: c.chainId === "43114" ? "C-Chain" : c.chainName, symbol: c.networkToken?.symbol ?? null, slug: c.slug, blockchainId: hexOf(c.blockchainId) });
const CATALOG_CHAINS = CATALOG.map(fromCatalog).filter((c) => Number.isSafeInteger(c.chainId) && c.chainId !== PCHAIN_IDS.mainnet && c.chainId !== PCHAIN_IDS.fuji);

const networkFeed = kept(
  async () => {
    const body = await getJson<{ chains?: { evmChainId?: number | string; chainName?: string; blockchainId?: string; network?: string }[] }>(`${DEDICATED_STATS_BASE_URL}/v2/chains?network=mainnet`, "the chain list");
    const chains = (body.chains ?? [])
      .filter((c) => c.network === "mainnet" && Number.isSafeInteger(Number(c.evmChainId)))
      .map((c): NetworkChain => {
        const hex = hexOf(c.blockchainId);
        const listed = CATALOG.find((k) => (hex !== null && hexOf(k.blockchainId) === hex) || evmIdOf(k) === Number(c.evmChainId));
        const own = { chainId: Number(c.evmChainId), name: c.chainName || `Chain ${c.evmChainId}`, symbol: null, slug: null, blockchainId: hex };
        return listed ? { ...fromCatalog(listed), chainId: own.chainId, blockchainId: hex ?? hexOf(listed.blockchainId) } : own;
      });
    if (!chains.some((c) => c.chainId === 43114)) throw new Error("the chain list holds no C-Chain");
    return { chains, at: Date.now() };
  },
  3600_000,
  24 * 3600_000,
  "the chain list",
);

/** the network's chains, the C-Chain first; the catalog's when the list does not answer in time */
export async function networkChains(): Promise<NetworkChain[]> {
  const chains = await within(
    networkFeed.get("mainnet").then((v) => v.chains),
    4000,
    CATALOG_CHAINS,
  );
  return [...chains.filter((c) => c.chainId === 43114), ...chains.filter((c) => c.chainId !== 43114)];
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

const chainNames: Source = {
  columns: [
    ["chain_id", "UInt64"],
    ["chain", "String"],
    ["token", "String"],
    ["blockchain_id", "FixedString(32)"],
  ],
  async build() {
    const chains = await networkChains();
    // names and symbols as base64: the query service refuses some words (use, file, set) even inside a string
    const rows = chains.map((c) => `(${c.chainId},'${b64(c.name)}','${b64(c.symbol ?? "")}','${c.blockchainId?.slice(2) ?? ""}')`);
    const sql = `SELECT toUInt64(tupleElement(r, 1)) AS chain_id, base64Decode(tupleElement(r, 2)) AS chain, base64Decode(tupleElement(r, 3)) AS token, toFixedString(unhex(tupleElement(r, 4)), 32) AS blockchain_id FROM (SELECT arrayJoin([${rows.join(",")}]) AS r)`;
    const text = `Chain names and native tokens come from the explorer's catalog, for the ${fmt(chains.length)} mainnet chains the stats API indexes.`;
    return { sql, note: { table: "chain_names", label: "chain names", at: networkFeed.peek("mainnet")?.at ?? Date.now(), total: chains.length, known: chains.filter((c) => c.symbol).length, text } };
  },
};

/* ------------------------------------------------------------------ */

const SOURCES: Record<string, Source> = {
  chain_names: chainNames,
  p_validator_versions: versions,
  p_avax_supply: supply,
  dex_factories: factories,
  dex_tokens: tokens,
  lending_markets: markets,
  lending_tokens: lendingTokens,
};

/** the tables a chapter of the prompt describes itself (a DEX or a lending question's), so every other prompt stays as it was */
const OWN_CHAPTER = new Set(["dex_factories", "dex_tokens", "lending_markets", "lending_tokens"]);

/** a reference table's line: its name and typed columns */
export function refLine(table: string): string {
  return `${table}(${SOURCES[table].columns.map(([n, t]) => `${n} ${t}`).join(", ")})`;
}

/** the schema card's lines for this target's reference tables */
export function refSchema(chainId: number): string[] {
  return targetOf(chainId)
    .refs.filter((r) => SOURCES[r] && !OWN_CHAPTER.has(r))
    .map(refLine);
}

const reads = (sql: string, table: string) => new RegExp(`\\b(?:FROM|JOIN)\\s+[\`"]?${table}\\b`, "i").test(sql);

/** the reference tables a query reads, as the guard finds tables */
export function refsIn(sql: string, chainId: number): string[] {
  return targetOf(chainId).refs.filter((r) => SOURCES[r] && reads(sql, r));
}

/** the SQL with each chain table it names, as this chain's rows, and
    each reference table it reads, defined in front of it; and what the
    reference tables cover. Throws when a source cannot be read or the
    whole no longer fits the query service. */
export async function withSources(sql: string, chainId: number): Promise<{ sql: string; sources: SourceNote[] }> {
  const used = refsIn(sql, chainId);
  const ids = chainId === NETWORK_ID ? (await networkChains()).map((c) => c.chainId) : [chainId];
  const scoped = scopeDefs(sql, chainId, ids);
  // the lending and family names the query reads (lending.ts, families.ts), on the C-Chain the registry describes
  const names = chainId === LENDING_CHAIN_ID ? namesIn(sql, SERVER_NAMES) : [];
  if (used.length === 0 && scoped.length === 0 && names.length === 0) return { sql, sources: [] };
  const built = await Promise.all(used.map((r) => SOURCES[r].build(chainId, sql)));
  // the inner name is the table itself: a WITH does not see its own names. The chain tables come first, so the
  // names and reference tables after them read the same chain's rows as the query
  const defs = [...scoped, ...names, ...used.map((r, i) => `${r} AS (${built[i].sql})`)];
  // wrapped, not merged into the query's own WITH: every branch of a UNION sees the tables
  const out = `WITH ${defs.join(", ")} SELECT * FROM (\n${sql}\n)`;
  const bytes = Buffer.byteLength(out);
  if (bytes > SQL_BUDGET) {
    const own = Buffer.byteLength(sql);
    const what = [...used, ...(names.length ? ["the names our server defines"] : []), ...(scoped.length ? ["its chain's tables"] : [])].join(" and ");
    throw new Error(`the query is too long to send with ${what}: the definitions take ${bytes - own} of the ${SQL_BUDGET} bytes the query service accepts, so the query may use ${SQL_BUDGET - (bytes - own)} and it uses ${own}. Write a shorter query.`);
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

/* subnet id -> the name of its newest chain, over every subnet the
   P-Chain has created, as /api/l1-registry reads them: it names the L1s
   the validator feed does not, such as a new L1 with no active seat */
const registryFeed = kept(
  async (network: Network) => {
    const names = new Map<string, { name: string; at: number }>();
    for (const s of await fetchAllSubnets(network)) {
      for (const b of s.blockchains ?? []) {
        const name = b.blockchainName?.trim();
        const at = b.createBlockTimestamp ?? 0;
        if (name && at >= (names.get(s.subnetId)?.at ?? -1)) names.set(s.subnetId, { name, at });
      }
    }
    return { names: new Map([...names].map(([id, n]) => [id, n.name])), at: Date.now() };
  },
  3600_000,
  24 * 3600_000,
  "subnet names",
);

/** subnet id -> name, the validator feed's first, then the registry's; empty when neither answers in time.
    A read that outlasts the wait (a cold registry takes about 9 s) keeps going and fills the kept names,
    so the next answer on this server has them at once */
export async function subnetNames(chainId: number, timeoutMs = 3000): Promise<Map<string, string>> {
  const none = new Map<string, string>();
  const [feed, registry] = await Promise.all([
    within(nameFeed.get(networkOf(chainId)).then((s) => s.names), timeoutMs, none),
    within(registryFeed.get(networkOf(chainId)).then((s) => s.names), timeoutMs, none),
  ]);
  return new Map([...registry, ...feed]);
}
