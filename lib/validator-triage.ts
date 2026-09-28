/* The validators page's triage model. One row per Primary Network
   validator, a version status against a target release, the facets the
   roster filters by, and the URL form of a filter so a triage view can be
   shared as a link. Pure: the page, the URL and the tests share it. */

export type VersionStatus = "current" | "behind" | "unknown";

export interface TriageRow {
  nodeId: string;
  /** release, e.g. "1.15.0"; null when the node reported none */
  version: string | null;
  /** AVAX, own stake plus delegations */
  stake: number;
  delegators: number;
  /** percent */
  fee: number | null;
  /** percent, the crawler's median across its observers */
  uptime: number | null;
  daysLeft: number | null;
  /** percent of proposer slots missed in the last 14 days */
  missRate: number | null;
  blocks14d: number | null;
  /** the P-Chain API node is connected to it; null when not reported */
  online: boolean | null;
  /** host:port the crawler reached; null when it reached none */
  ip: string | null;
}

export interface StatusRow extends TriageRow {
  status: VersionStatus;
}

/* ------------------------------------------------------------------ */
/* versions                                                            */
/* ------------------------------------------------------------------ */

/** "avalanchego/1.15.0" to "1.15.0"; null when there is no release in it */
export function releaseOf(raw: string | null | undefined): string | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(raw ?? "");
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

function parts(v: string): [number, number, number] {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : [0, 0, 0];
}

/** release order, not text order: negative when a is older than b */
export function compareRelease(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function statusOf(version: string | null, target: string): VersionStatus {
  if (!version) return "unknown";
  return compareRelease(version, target) >= 0 ? "current" : "behind";
}

/** how far behind the target a release is: the same minor line or one line back is near */
export function lagOf(version: string, target: string): "current" | "near" | "far" {
  if (compareRelease(version, target) >= 0) return "current";
  const v = parts(version);
  const t = parts(target);
  if (v[0] !== t[0]) return "far";
  return v[1] === t[1] || v[1] === t[1] - 1 ? "near" : "far";
}

/* ------------------------------------------------------------------ */
/* rows from the two feeds                                             */
/* ------------------------------------------------------------------ */

const NANO = 1e9;

/** the stats API's roster row: every current validator */
export interface RosterFeedRow {
  nodeId: string;
  /** nAVAX */
  amountStaked: string;
  /** nAVAX */
  amountDelegated: string;
  delegationFee: string;
  delegatorCount: number;
  version?: string;
  connected?: boolean;
}

/** the p2p crawler's row: health, and the version from its handshake */
export interface CrawlerFeedRow {
  /** nAVAX */
  total_stake: number;
  p50_uptime: number;
  days_left: number;
  miss_rate_14d: number;
  block_count_14d: number;
  /** "" when the crawler never completed a handshake */
  version: string;
  public_ip?: string;
}

function toNumber(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/* The roster says who validates; the crawler adds how each one behaves.
   The crawler's version wins because it is read from a live handshake. */
export function buildRows(roster: RosterFeedRow[], crawler: Map<string, CrawlerFeedRow> | null): TriageRow[] {
  return roster.map((v) => {
    const c = crawler?.get(v.nodeId);
    const own = toNumber(v.amountStaked) ?? 0;
    const delegated = toNumber(v.amountDelegated) ?? 0;
    return {
      nodeId: v.nodeId,
      version: releaseOf(c?.version || v.version),
      stake: (c?.total_stake ?? own + delegated) / NANO,
      delegators: v.delegatorCount ?? 0,
      fee: toNumber(v.delegationFee),
      uptime: c ? c.p50_uptime : null,
      daysLeft: c ? c.days_left : null,
      missRate: c ? c.miss_rate_14d : null,
      blocks14d: c ? c.block_count_14d : null,
      online: typeof v.connected === "boolean" ? v.connected : null,
      ip: c?.public_ip || null,
    };
  });
}

export function withStatus(rows: TriageRow[], target: string): StatusRow[] {
  return rows.map((r) => ({ ...r, status: statusOf(r.version, target) }));
}

/* ------------------------------------------------------------------ */
/* the target release                                                  */
/* ------------------------------------------------------------------ */

export interface ReleaseLike {
  version: string;
  mandatory: boolean;
}

export type TargetTag = "required" | "latest" | "unreleased";

export interface TargetOption {
  version: string;
  tag: TargetTag | null;
  nodes: number;
}

/** the release the network requires: the newest one its notes call mandatory */
export function requiredRelease<T extends ReleaseLike>(releases: T[] | null): T | null {
  if (!releases?.length) return null;
  return [...releases].sort((a, b) => compareRelease(b.version, a.version)).find((r) => r.mandatory) ?? null;
}

/* Without release data, the newest release with real adoption. The
   highest version present is often a single canary node, and measuring
   the whole network against it reads as a network-wide lag. */
function adoptedRelease(rows: TriageRow[], minShare = 0.01): string | null {
  const counts = versionCounts(rows);
  const total = rows.filter((r) => r.version).length;
  const ranked = [...counts.keys()].sort((a, b) => compareRelease(b, a));
  return ranked.find((v) => total > 0 && (counts.get(v) ?? 0) / total >= minShare) ?? ranked[0] ?? null;
}

export function defaultTarget(rows: TriageRow[], releases: ReleaseLike[] | null): string | null {
  return requiredRelease(releases)?.version ?? adoptedRelease(rows);
}

export function versionCounts(rows: TriageRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.version) counts.set(r.version, (counts.get(r.version) ?? 0) + 1);
  return counts;
}

/* The target picks: the required release, the latest published one and
   the active target always, even while no node runs them yet; then the
   newest releases nodes run, up to the cap, since an old release is never
   an upgrade target. Newest first. */
export function targetOptions(rows: TriageRow[], releases: ReleaseLike[] | null, active: string | null = null, cap = 6): TargetOption[] {
  const counts = versionCounts(rows);
  const required = requiredRelease(releases)?.version ?? null;
  const published = releases?.length ? [...releases].sort((a, b) => compareRelease(b.version, a.version)) : null;
  const latest = published?.[0]?.version ?? null;
  const keep = new Set([required, latest, active].filter((v): v is string => !!v));
  const rest = [...counts.keys()].filter((v) => !keep.has(v)).sort((a, b) => compareRelease(b, a));
  return [...keep, ...rest.slice(0, Math.max(0, cap - keep.size))]
    .sort((a, b) => compareRelease(b, a))
    .map((version) => ({
      version,
      nodes: counts.get(version) ?? 0,
      tag:
        version === required
          ? "required"
          : version === latest
            ? "latest"
            : latest && compareRelease(version, latest) > 0
              ? "unreleased"
              : null,
    }));
}

/* ------------------------------------------------------------------ */
/* facets                                                              */
/* ------------------------------------------------------------------ */

export type FacetKey = "status" | "version" | "online" | "stake" | "uptime" | "miss" | "ends" | "delegators";

export const FACET_KEYS: FacetKey[] = ["status", "version", "online", "stake", "uptime", "miss", "ends", "delegators"];

export interface FacetOption {
  id: string;
  label: string;
  test: (r: StatusRow) => boolean;
}

export interface Facet {
  key: FacetKey;
  label: string;
  options: FacetOption[];
}

/** facet key to the option ids picked in it; the parts AND, the ids in a part OR */
export type Selection = Partial<Record<FacetKey, string[]>>;

/** the facets only the crawler feed can answer */
export const CRAWLER_FACETS: FacetKey[] = ["uptime", "miss", "ends"];

/** the version facet's id for a node that reported none */
export const NO_VERSION = "unknown";

const within = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v < hi;

/* the health charts' buckets; the charts and the facets share them, so a
   click on a bar and a tick in the rail are the same filter */
export const MISS_OPTIONS: FacetOption[] = [
  { id: "0", label: "0%", test: (r) => r.missRate === 0 },
  { id: "0-1", label: "0–1%", test: (r) => r.missRate !== null && r.missRate > 0 && r.missRate < 1 },
  { id: "1-5", label: "1–5%", test: (r) => within(r.missRate, 1, 5) },
  { id: "5-10", label: "5–10%", test: (r) => within(r.missRate, 5, 10) },
  { id: "10-25", label: "10–25%", test: (r) => within(r.missRate, 10, 25) },
  { id: "25-50", label: "25–50%", test: (r) => within(r.missRate, 25, 50) },
  { id: "50", label: "50%+", test: (r) => r.missRate !== null && r.missRate >= 50 },
];

export const ENDS_OPTIONS: FacetOption[] = [
  { id: "lt7", label: "< 7d", test: (r) => within(r.daysLeft, 0, 7) },
  { id: "7-30", label: "7–30d", test: (r) => within(r.daysLeft, 7, 30) },
  { id: "30-90", label: "30–90d", test: (r) => within(r.daysLeft, 30, 90) },
  { id: "90-180", label: "90–180d", test: (r) => within(r.daysLeft, 90, 180) },
  { id: "180-365", label: "180–365d", test: (r) => within(r.daysLeft, 180, 365) },
  { id: "365", label: "365d+", test: (r) => r.daysLeft !== null && r.daysLeft >= 365 },
];

export function facetsFor(rows: TriageRow[]): Facet[] {
  const versions = [...versionCounts(rows).keys()].sort((a, b) => compareRelease(b, a));
  return [
    {
      key: "status",
      label: "Version status",
      options: [
        { id: "current", label: "On target", test: (r) => r.status === "current" },
        { id: "behind", label: "Behind target", test: (r) => r.status === "behind" },
        { id: "unknown", label: "Unknown version", test: (r) => r.status === "unknown" },
      ],
    },
    {
      key: "version",
      label: "Version",
      options: [
        ...versions.map((v) => ({ id: v, label: v, test: (r: StatusRow) => r.version === v })),
        { id: NO_VERSION, label: "Unknown", test: (r: StatusRow) => r.version === null },
      ],
    },
    {
      key: "online",
      label: "Connection",
      options: [
        { id: "yes", label: "Online", test: (r) => r.online === true },
        { id: "no", label: "Offline", test: (r) => r.online === false },
      ],
    },
    {
      key: "stake",
      label: "Total stake",
      options: [
        { id: "1m", label: "1M+ AVAX", test: (r) => r.stake >= 1e6 },
        { id: "100k", label: "100K–1M", test: (r) => within(r.stake, 1e5, 1e6) },
        { id: "10k", label: "10K–100K", test: (r) => within(r.stake, 1e4, 1e5) },
        { id: "lt10k", label: "Under 10K", test: (r) => r.stake < 1e4 },
      ],
    },
    {
      key: "uptime",
      label: "Uptime",
      options: [
        { id: "99", label: "99%+", test: (r) => r.uptime !== null && r.uptime >= 99 },
        { id: "90", label: "90–99%", test: (r) => within(r.uptime, 90, 99) },
        { id: "80", label: "80–90%", test: (r) => within(r.uptime, 80, 90) },
        { id: "lt80", label: "Under 80%", test: (r) => r.uptime !== null && r.uptime < 80 },
      ],
    },
    { key: "miss", label: "Miss rate · 14d", options: MISS_OPTIONS },
    { key: "ends", label: "Ends in", options: ENDS_OPTIONS },
    {
      key: "delegators",
      label: "Delegators",
      options: [
        { id: "yes", label: "Has delegators", test: (r) => r.delegators > 0 },
        { id: "no", label: "None", test: (r) => r.delegators === 0 },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* search                                                              */
/* ------------------------------------------------------------------ */

export interface Query {
  /** a pasted list of NodeIDs: the roster is cut to exactly these */
  ids: string[] | null;
  /** otherwise part of a NodeID, or the start of an IP */
  text: string;
  /** the text as a release prefix: "v1.15" and "avalanchego/1.15" read as "1.15" */
  release: string;
}

/* base58 has no "I", so "NodeID-" never occurs inside an ID: a list that
   lost its separators on the way in still splits at each prefix */
const NODE_ID = /NodeID-[1-9A-HJ-NP-Za-km-z]{20,}?(?=NodeID-|[^1-9A-HJ-NP-Za-km-z]|$)/g;

export function parseQuery(raw: string): Query {
  const ids = [...new Set(raw.match(NODE_ID) ?? [])];
  if (ids.length >= 2) return { ids, text: "", release: "" };
  // one ID inside other text (a trailing period, quotes, a node-page URL) searches as that ID alone
  const text = (ids[0] ?? raw).trim().toLowerCase();
  return { ids: null, text, release: text.replace(/^avalanchego\//, "").replace(/^v(?=\d)/, "") };
}

/* A version or an IP matches from its start, so "1.14" finds 1.14.2 and
   not the IP 108.131.140.243; a NodeID matches anywhere. */
function matchesQuery(r: StatusRow, q: Query, ids: Set<string> | null): boolean {
  if (ids) return ids.has(r.nodeId);
  if (!q.text) return true;
  return (
    r.nodeId.toLowerCase().includes(q.text) ||
    (!!q.release && (r.version ?? NO_VERSION).startsWith(q.release)) ||
    (r.ip ?? "").startsWith(q.text)
  );
}

/** the pasted NodeIDs that are not in the current set */
export function missingIds(rows: TriageRow[], q: Query): string[] {
  if (!q.ids) return [];
  const known = new Set(rows.map((r) => r.nodeId));
  return q.ids.filter((id) => !known.has(id));
}

/* ------------------------------------------------------------------ */
/* filtering and counts                                                */
/* ------------------------------------------------------------------ */

function matchesFacets(r: StatusRow, facets: Facet[], sel: Selection, skip?: FacetKey): boolean {
  for (const f of facets) {
    if (f.key === skip) continue;
    const picked = sel[f.key];
    if (!picked?.length) continue;
    if (!f.options.some((o) => picked.includes(o.id) && o.test(r))) return false;
  }
  return true;
}

export function applyFilter(rows: StatusRow[], facets: Facet[], sel: Selection, q: Query): StatusRow[] {
  const ids = q.ids ? new Set(q.ids) : null;
  return rows.filter((r) => matchesQuery(r, q, ids) && matchesFacets(r, facets, sel));
}

/* Each option's count is what the roster would hold if it were ticked:
   every other part of the filter applies, its own facet does not. */
export function facetCounts(
  rows: StatusRow[],
  facets: Facet[],
  sel: Selection,
  q: Query,
): Record<FacetKey, Record<string, number>> {
  const ids = q.ids ? new Set(q.ids) : null;
  const searched = rows.filter((r) => matchesQuery(r, q, ids));
  const out = {} as Record<FacetKey, Record<string, number>>;
  for (const f of facets) {
    const pool = searched.filter((r) => matchesFacets(r, facets, sel, f.key));
    out[f.key] = Object.fromEntries(f.options.map((o) => [o.id, pool.filter(o.test).length]));
  }
  return out;
}

export function isFiltering(sel: Selection, q: Query): boolean {
  return !!q.ids || !!q.text || Object.values(sel).some((v) => !!v?.length);
}

/** tick or untick one option */
export function toggleOption(sel: Selection, key: FacetKey, id: string): Selection {
  const cur = sel[key] ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  return { ...sel, [key]: next.length ? next : undefined };
}

/** set one facet to exactly these options, or clear it when it already is */
export function cutTo(sel: Selection, key: FacetKey, ids: string[]): Selection {
  return { ...sel, [key]: sameIds(sel[key], ids) ? undefined : ids };
}

function sameIds(a: string[] | undefined, b: string[] | undefined): boolean {
  const x = [...(a ?? [])].sort();
  const y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/* ------------------------------------------------------------------ */
/* triage presets: the questions the page is asked most                */
/* ------------------------------------------------------------------ */

export interface Preset {
  id: string;
  label: string;
  title: string;
  selection: Selection;
}

export const PRESETS: Preset[] = [
  {
    id: "not-on-target",
    label: "Not on target",
    title: "Validators behind the target release, or with no version reported",
    selection: { status: ["behind", "unknown"] },
  },
  {
    id: "offline",
    label: "Offline",
    title: "Validators the P-Chain API node is not connected to",
    selection: { online: ["no"] },
  },
  {
    id: "low-uptime",
    label: "Uptime under 90%",
    title: "Validations that start after Helicon need 90% uptime to earn rewards. Earlier ones need 80%.",
    selection: { uptime: ["80", "lt80"] },
  },
  {
    id: "missing-blocks",
    label: "Miss rate 5%+",
    title: "Validators that missed 5% or more of their proposer slots in the last 14 days",
    selection: { miss: ["5-10", "10-25", "25-50", "50"] },
  },
  {
    id: "ending",
    label: "Ends inside 7 days",
    title: "Validators whose current staking period ends inside 7 days",
    selection: { ends: ["lt7"] },
  },
];

/** a preset is on when the facets are exactly its selection */
export function presetActive(p: Preset, sel: Selection): boolean {
  return FACET_KEYS.every((k) => sameIds(sel[k], p.selection[k]));
}

/* ------------------------------------------------------------------ */
/* sorting                                                             */
/* ------------------------------------------------------------------ */

export type SortKey = "stake" | "version" | "delegators" | "fee" | "uptime" | "daysLeft" | "missRate";

export interface Sort {
  key: SortKey;
  dir: 1 | -1;
}

export const DEFAULT_SORT: Sort = { key: "stake", dir: -1 };

const SORT_KEYS: SortKey[] = ["stake", "version", "delegators", "fee", "uptime", "daysLeft", "missRate"];

function sortValue(r: TriageRow, key: SortKey): number | null {
  switch (key) {
    case "version": {
      if (!r.version) return null;
      const [a, b, c] = parts(r.version);
      return a * 1e6 + b * 1e3 + c;
    }
    case "stake":
      return r.stake;
    case "delegators":
      return r.delegators;
    case "fee":
      return r.fee;
    case "uptime":
      return r.uptime;
    case "daysLeft":
      return r.daysLeft;
    case "missRate":
      return r.missRate;
  }
}

/** a missing value sorts last in either direction; ties fall back to stake */
export function sortRows<T extends TriageRow>(rows: T[], sort: Sort): T[] {
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null && y === null) return b.stake - a.stake;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sort.dir || b.stake - a.stake;
  });
}

/* ------------------------------------------------------------------ */
/* the URL form                                                        */
/* ------------------------------------------------------------------ */

export interface TriageState {
  /** the target the reader picked; null follows the default */
  target: string | null;
  q: string;
  selection: Selection;
  sort: Sort;
}

const TOKEN = /^[A-Za-z0-9.+-]{1,24}$/;
const BASE58_ID = /^[1-9A-HJ-NP-Za-km-z]{20,60}$/;
const MAX_Q = 2000;
/* A pasted list rides as nodes=, without the "NodeID-" prefixes. 12 000
   characters is about 350 IDs, and keeps the URL under Vercel's 14 KB cap. */
const MAX_NODES = 12000;

function nodesParam(q: string): string | null {
  const ids = parseQuery(q).ids;
  return ids ? ids.map((id) => id.slice("NodeID-".length)).join(",") : null;
}

/** the search fits in a link; a longer NodeID list is left out of it */
export function linkable(q: string): boolean {
  const nodes = nodesParam(q);
  return nodes !== null ? nodes.length <= MAX_NODES : q.trim().length <= MAX_Q;
}
const RELEASE = /^\d+\.\d+\.\d+$/;

export function readState(params: URLSearchParams): TriageState {
  const selection: Selection = {};
  for (const key of FACET_KEYS) {
    const ids = (params.get(key) ?? "").split(",").filter((id) => TOKEN.test(id));
    if (ids.length) selection[key] = [...new Set(ids)];
  }
  const target = params.get("target");
  const sortKey = params.get("sort") as SortKey | null;
  const nodes = (params.get("nodes") ?? "").split(",").filter((id) => BASE58_ID.test(id));
  return {
    target: target && RELEASE.test(target) ? target : null,
    q: nodes.length ? nodes.map((id) => `NodeID-${id}`).join(" ") : (params.get("q") ?? "").slice(0, MAX_Q),
    selection,
    sort: sortKey && SORT_KEYS.includes(sortKey) ? { key: sortKey, dir: params.get("dir") === "asc" ? 1 : -1 } : DEFAULT_SORT,
  };
}

/** the page's params with the triage state written in; other params are kept */
export function writeState(params: URLSearchParams, s: TriageState): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of [...FACET_KEYS, "target", "q", "nodes", "sort", "dir"]) next.delete(key);
  if (s.target) next.set("target", s.target);
  for (const key of FACET_KEYS) {
    const ids = s.selection[key];
    if (ids?.length) next.set(key, ids.join(","));
  }
  const q = s.q.trim();
  const nodes = nodesParam(q);
  if (nodes !== null) {
    if (nodes.length <= MAX_NODES) next.set("nodes", nodes);
  } else if (q && q.length <= MAX_Q) next.set("q", q);
  if (s.sort.key !== DEFAULT_SORT.key || s.sort.dir !== DEFAULT_SORT.dir) {
    next.set("sort", s.sort.key);
    next.set("dir", s.sort.dir === 1 ? "asc" : "desc");
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* summaries and export                                                */
/* ------------------------------------------------------------------ */

export function summarize(rows: TriageRow[]): { count: number; stake: number; delegators: number } {
  let stake = 0;
  let delegators = 0;
  for (const r of rows) {
    stake += r.stake;
    delegators += r.delegators;
  }
  return { count: rows.length, stake, delegators };
}

const STATUS_WORD: Record<VersionStatus, string> = { current: "on_target", behind: "behind", unknown: "unknown" };

function csvCell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: StatusRow[], target: string): string {
  const head = [
    "node_id",
    "version",
    `status_vs_${target}`,
    "online",
    "total_stake_avax",
    "delegators",
    "delegation_fee_pct",
    "uptime_pct",
    "days_left",
    "miss_rate_14d_pct",
    "public_ip",
  ];
  const lines = rows.map((r) =>
    [
      r.nodeId,
      r.version,
      STATUS_WORD[r.status],
      r.online === null ? null : r.online ? "yes" : "no",
      Math.round(r.stake),
      r.delegators,
      r.fee,
      r.uptime === null ? null : Number(r.uptime.toFixed(2)),
      r.daysLeft,
      r.missRate === null ? null : Number(r.missRate.toFixed(2)),
      r.ip,
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}
