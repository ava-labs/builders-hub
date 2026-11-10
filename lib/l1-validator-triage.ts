/* The L1 validators view's triage model, beside the Primary Network's
   (validator-triage.ts), whose filter, search grammar and URL form it
   shares. One row per L1 validation: a node can validate more than one
   L1, so the validation ID is a row's key. An L1 validator stakes
   nothing and takes no delegators: it holds a weight on its own L1 and
   prepays the P-Chain's continuous fee from a balance, so those are its
   figures, beside its release and the crawler's last handshake with it.
   Pure: the page, the route and the tests share it. */

import {
  NO_VERSION,
  STATUS_WORD,
  compareRelease,
  csvOf,
  triageUrl,
  versionFacets,
  type Facet,
  type FacetOption,
  type Preset,
  type Query,
  type Sort,
  type TriageState,
  type VersionStatus,
} from "./validator-triage";

/** a validation as /api/l1-validators/[network] sends it */
export interface L1FeedRow {
  nodeId: string;
  validationId: string;
  subnetId: string;
  weight: number;
  /** nAVAX left to pay the continuous fee */
  balance: number;
  /** unix seconds the validation was registered */
  createdAt: number;
  /** release, e.g. "1.14.1", from the last handshake; null when there was none */
  version: string | null;
  /** unix seconds of that handshake; null when there was none */
  seenAt: number | null;
  /** host:port the crawler reached; null when it reached none */
  ip: string | null;
}

export interface L1Feed {
  validators: L1FeedRow[];
  /** the continuous fee, nAVAX per second per validator; null when the node did not answer */
  price: number | null;
}

/** what the page knows of an L1 beyond its validators */
export interface L1Info {
  name: string;
  logo?: string;
  /** its explorer slug; none when the catalog lacks the L1 */
  slug?: string;
  isPrivate?: boolean;
}

export interface L1Row {
  nodeId: string;
  validationId: string;
  subnetId: string;
  /** the L1's name */
  l1: string;
  logo: string | null;
  slug: string | null;
  isPrivate: boolean;
  /** the validators its L1 has */
  l1Size: number;
  version: string | null;
  weight: number;
  /** percent of its L1's weight */
  share: number;
  /** AVAX */
  balance: number;
  /** the days the balance pays at the current fee; null while the fee is unknown */
  daysLeft: number | null;
  /** unix seconds */
  createdAt: number;
  /** days since the last handshake; null when there was none */
  seenDays: number | null;
  ip: string | null;
}

export interface L1StatusRow extends L1Row {
  status: VersionStatus;
}

const NANO = 1e9;
const DAY_S = 86_400;

/** rows from the feed; `info` names each L1 and `price` is the fee in nAVAX per second */
export function buildL1Rows(feed: L1FeedRow[], info: (subnetId: string) => L1Info, price: number | null, now = Date.now() / 1000): L1Row[] {
  const sets = new Map<string, { weight: number; n: number; info?: L1Info }>();
  for (const v of feed) {
    const s = sets.get(v.subnetId) ?? { weight: 0, n: 0 };
    sets.set(v.subnetId, { weight: s.weight + v.weight, n: s.n + 1 });
  }
  return feed.map((v) => {
    const set = sets.get(v.subnetId)!;
    const l1 = (set.info ??= info(v.subnetId));
    return {
      nodeId: v.nodeId,
      validationId: v.validationId,
      subnetId: v.subnetId,
      l1: l1.name,
      logo: l1.logo ?? null,
      slug: l1.slug ?? null,
      isPrivate: l1.isPrivate === true,
      l1Size: set.n,
      version: v.version,
      weight: v.weight,
      share: set.weight > 0 ? (v.weight / set.weight) * 100 : 0,
      balance: v.balance / NANO,
      daysLeft: price !== null && price > 0 ? v.balance / (price * DAY_S) : null,
      createdAt: v.createdAt,
      seenDays: v.seenAt ? Math.max(0, (now - v.seenAt) / DAY_S) : null,
      ip: v.ip,
    };
  });
}

/** a handshake's age in words: "5h ago", "12d ago" */
export function seenText(days: number): string {
  return days < 1 ? `${Math.max(1, Math.round(days * 24))}h ago` : `${Math.floor(days)}d ago`;
}

/* ------------------------------------------------------------------ */
/* facets                                                              */
/* ------------------------------------------------------------------ */

export type L1FacetKey = "status" | "version" | "l1" | "share" | "runway" | "seen";

export const L1_FACET_KEYS: L1FacetKey[] = ["status", "version", "l1", "share", "runway", "seen"];

/** the facets only the fee price can answer */
export const PRICE_FACETS: L1FacetKey[] = ["runway"];

const within = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v < hi;

/* the health charts' buckets; the charts and the facets share them, so a
   click on a bar and a tick in the rail are the same filter */
export const RUNWAY_OPTIONS: FacetOption<L1StatusRow>[] = [
  { id: "lt7", label: "< 7d", test: (r) => within(r.daysLeft, 0, 7) },
  { id: "7-30", label: "7–30d", test: (r) => within(r.daysLeft, 7, 30) },
  { id: "30-90", label: "30–90d", test: (r) => within(r.daysLeft, 30, 90) },
  { id: "90-365", label: "90–365d", test: (r) => within(r.daysLeft, 90, 365) },
  { id: "365", label: "365d+", test: (r) => r.daysLeft !== null && r.daysLeft >= 365 },
];

export const SEEN_OPTIONS: FacetOption<L1StatusRow>[] = [
  { id: "lt1", label: "< 1d", test: (r) => within(r.seenDays, 0, 1) },
  { id: "1-7", label: "1–7d", test: (r) => within(r.seenDays, 1, 7) },
  { id: "7-30", label: "7–30d", test: (r) => within(r.seenDays, 7, 30) },
  { id: "30", label: "30d+", test: (r) => r.seenDays !== null && r.seenDays >= 30 },
  { id: "never", label: "Never", test: (r) => r.seenDays === null },
];

export function l1FacetsFor(rows: L1Row[]): Facet<L1FacetKey, L1StatusRow>[] {
  // the L1s the biggest first, as the roster opens
  const sets = new Map<string, { name: string; n: number }>();
  for (const r of rows) sets.set(r.subnetId, { name: r.l1, n: r.l1Size });
  const l1s = [...sets].sort(([a, x], [b, y]) => y.n - x.n || x.name.localeCompare(y.name) || a.localeCompare(b));
  // the L1 leads: the view reads one L1 at a time
  return [
    {
      key: "l1",
      label: "L1",
      options: l1s.map(([id, s]) => ({ id, label: s.name, test: (r: L1StatusRow) => r.subnetId === id })),
    },
    ...versionFacets<L1StatusRow>(rows),
    {
      key: "share",
      label: "Share of its L1",
      options: [
        { id: "50", label: "50%+", test: (r) => r.share >= 50 },
        { id: "20-50", label: "20–50%", test: (r) => within(r.share, 20, 50) },
        { id: "5-20", label: "5–20%", test: (r) => within(r.share, 5, 20) },
        { id: "lt5", label: "Under 5%", test: (r) => r.share < 5 },
      ],
    },
    { key: "runway", label: "Balance lasts", options: RUNWAY_OPTIONS },
    { key: "seen", label: "Last handshake", options: SEEN_OPTIONS },
  ];
}

/* ------------------------------------------------------------------ */
/* triage presets                                                      */
/* ------------------------------------------------------------------ */

export const L1_PRESETS: Preset<L1FacetKey>[] = [
  {
    id: "not-on-target",
    label: "Not on target",
    title: "Validators behind the target release, or with no version reported",
    selection: { status: ["behind", "unknown"] },
  },
  {
    id: "behind-heavy",
    label: "Behind, 20%+ of its L1",
    title: "Validators behind the target release that hold 20% or more of their L1's weight",
    selection: { status: ["behind"], share: ["50", "20-50"] },
  },
  {
    id: "runs-out",
    label: "Runs out inside 7 days",
    title: "Validators whose balance pays the fee for less than 7 more days at the current price. At zero the validator goes inactive.",
    selection: { runway: ["lt7"] },
  },
  {
    id: "unseen",
    label: "No handshake in 30 days",
    title: "Validators the network crawler has not reached in 30 days, or never",
    selection: { seen: ["30", "never"] },
  },
];

/* ------------------------------------------------------------------ */
/* search                                                              */
/* ------------------------------------------------------------------ */

/* The Primary Network roster's grammar: a pasted list cuts to exactly
   those NodeIDs; else a NodeID or a validation ID matches anywhere, a
   version or an IP from its start, and an L1 by any part of its name. */
export function l1Finder(q: Query): (r: L1Row) => boolean {
  const ids = q.ids ? new Set(q.ids) : null;
  return (r) => {
    if (ids) return ids.has(r.nodeId);
    if (!q.text) return true;
    return (
      r.nodeId.toLowerCase().includes(q.text) ||
      r.validationId.toLowerCase().includes(q.text) ||
      r.l1.toLowerCase().includes(q.text) ||
      (!!q.release && (r.version ?? NO_VERSION).startsWith(q.release)) ||
      (r.ip ?? "").startsWith(q.text)
    );
  };
}

/* ------------------------------------------------------------------ */
/* sorting                                                             */
/* ------------------------------------------------------------------ */

export type L1SortKey = "l1" | "version" | "share" | "balance" | "seen";

export const L1_SORT_KEYS: L1SortKey[] = ["l1", "version", "share", "balance", "seen"];

/** the roster opens by L1, the biggest first */
export const L1_DEFAULT_SORT: Sort<L1SortKey> = { key: "l1", dir: -1 };

function sortValue(r: L1Row, key: L1SortKey): number | null {
  switch (key) {
    case "l1":
      return r.l1Size;
    case "version": {
      if (!r.version) return null;
      const [a, b, c] = r.version.split(".").map(Number);
      return a * 1e6 + b * 1e3 + c;
    }
    case "share":
      return r.share;
    case "balance":
      return r.balance;
    case "seen":
      return r.seenDays;
  }
}

/** a missing value sorts last in either direction; a tie keeps an L1 together, its heaviest validator first */
export function sortL1Rows<T extends L1Row>(rows: T[], sort: Sort<L1SortKey>): T[] {
  const tie = (a: T, b: T) => a.l1.localeCompare(b.l1) || a.subnetId.localeCompare(b.subnetId) || b.share - a.share;
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null && y === null) return tie(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sort.dir || tie(a, b);
  });
}

/* ------------------------------------------------------------------ */
/* the URL form                                                        */
/* ------------------------------------------------------------------ */

export type L1TriageState = TriageState<L1FacetKey, L1SortKey>;

// an L1 option's id is its subnet ID, longer than the Primary Network roster's ids
const L1_URL = triageUrl(L1_FACET_KEYS, L1_SORT_KEYS, L1_DEFAULT_SORT, /^[A-Za-z0-9.+-]{1,64}$/);

export function readL1State(params: URLSearchParams): L1TriageState {
  return L1_URL.read(params);
}

/** the page's params with the triage state written in; other params are kept */
export function writeL1State(params: URLSearchParams, s: L1TriageState): URLSearchParams {
  return L1_URL.write(params, s);
}

/* ------------------------------------------------------------------ */
/* per L1                                                              */
/* ------------------------------------------------------------------ */

export interface L1Summary {
  subnetId: string;
  name: string;
  logo: string | null;
  slug: string | null;
  isPrivate: boolean;
  validators: number;
  behind: number;
  unknown: number;
  /** percent of the L1's weight on validators at or past the target */
  weightOn: number;
  /** percent of the L1's weight on validators behind it */
  weightBehind: number;
  /** the days until its first validator's balance runs out; null while the fee is unknown */
  soonest: number | null;
  /** its validators by release, newest first, the unknown last */
  versions: { version: string; n: number }[];
}

/* One summary per L1, the most exposed first: the share of its weight
   behind the target, then the share of its validators with no version
   (a private L1 reports none by design, so it does not count), then its
   size. */
export function summarizeL1s(rows: L1StatusRow[]): L1Summary[] {
  const by = new Map<string, L1Summary & { counts: Map<string, number> }>();
  for (const r of rows) {
    let s = by.get(r.subnetId);
    if (!s) {
      s = { subnetId: r.subnetId, name: r.l1, logo: r.logo, slug: r.slug, isPrivate: r.isPrivate, validators: 0, behind: 0, unknown: 0, weightOn: 0, weightBehind: 0, soonest: null, versions: [], counts: new Map() };
      by.set(r.subnetId, s);
    }
    s.validators++;
    if (r.status === "current") s.weightOn += r.share;
    else if (r.status === "behind") {
      s.behind++;
      s.weightBehind += r.share;
    } else s.unknown++;
    if (r.daysLeft !== null) s.soonest = s.soonest === null ? r.daysLeft : Math.min(s.soonest, r.daysLeft);
    const k = r.version ?? NO_VERSION;
    s.counts.set(k, (s.counts.get(k) ?? 0) + 1);
  }
  const dark = (s: L1Summary) => (s.isPrivate ? 0 : s.unknown / s.validators);
  return [...by.values()]
    .map(({ counts, ...s }) => ({
      ...s,
      versions: [...counts]
        .sort(([a], [b]) => (a === NO_VERSION ? 1 : b === NO_VERSION ? -1 : compareRelease(b, a)))
        .map(([version, n]) => ({ version, n })),
    }))
    .sort((a, b) => b.weightBehind - a.weightBehind || dark(b) - dark(a) || b.validators - a.validators || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* summaries and export                                                */
/* ------------------------------------------------------------------ */

export function summarizeL1Rows(rows: L1Row[]): { count: number; l1s: number; balance: number } {
  let balance = 0;
  const l1s = new Set<string>();
  for (const r of rows) {
    balance += r.balance;
    l1s.add(r.subnetId);
  }
  return { count: rows.length, l1s: l1s.size, balance };
}

export function toL1Csv(rows: L1StatusRow[], target: string): string {
  return csvOf(
    [
      "node_id",
      "validation_id",
      "l1",
      "subnet_id",
      "version",
      `status_vs_${target}`,
      "last_handshake_days_ago",
      "weight",
      "weight_share_pct",
      "balance_avax",
      "days_left",
      "registered",
      "public_ip",
    ],
    rows.map((r) => [
      r.nodeId,
      r.validationId,
      r.l1,
      r.subnetId,
      r.version,
      STATUS_WORD[r.status],
      r.seenDays === null ? null : Number(r.seenDays.toFixed(1)),
      r.weight,
      Number(r.share.toFixed(2)),
      Number(r.balance.toFixed(4)),
      r.daysLeft === null ? null : Math.floor(r.daysLeft),
      new Date(r.createdAt * 1000).toISOString().slice(0, 10),
      r.ip,
    ]),
  );
}
