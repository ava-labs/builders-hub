import { changeOf, deltaOf, type DefiProtocol, type Span } from "@/lib/defi/llama";
import { GROUP, GROUPS, type GroupKey } from "@/lib/defi/taxonomy";

/* The protocol table's filter: facets that AND together (the options in
   one facet OR), a name search, presets for the questions the page is
   asked most, the sort, and the URL form of all of it, so a view can be
   shared as a link. Changes read over one window (1d, 7d or 30d), the
   one the page clock maps to. */

export type FacetKey = "group" | "size" | "trend" | "native" | "age" | "activity";
export const FACET_KEYS: FacetKey[] = ["group", "size", "trend", "native", "age", "activity"];

export type Selection = Partial<Record<FacetKey, string[]>>;

export interface FacetOption {
  id: string;
  label: string;
  test: (p: DefiProtocol, ctx: Ctx) => boolean;
}

export interface Facet {
  key: FacetKey;
  label: string;
  options: FacetOption[];
}

interface Ctx {
  span: Span;
  now: number;
}

/** a move under 5% either way reads as flat */
const TREND = 5;
const DAY = 86_400;

export const FACETS: Facet[] = [
  {
    key: "group",
    label: "Category",
    options: GROUPS.map((g) => ({ id: g.key, label: g.label, test: (p) => p.group === g.key })),
  },
  {
    key: "size",
    label: "TVL",
    options: [
      { id: "100m", label: "$100M+", test: (p) => p.tvl >= 1e8 },
      { id: "10m", label: "$10M–100M", test: (p) => p.tvl >= 1e7 && p.tvl < 1e8 },
      { id: "1m", label: "$1M–10M", test: (p) => p.tvl >= 1e6 && p.tvl < 1e7 },
      { id: "lt1m", label: "Under $1M", test: (p) => p.tvl < 1e6 },
    ],
  },
  {
    key: "trend",
    label: "Trend",
    options: [
      { id: "up", label: "Growing", test: (p, c) => (changeOf(p, c.span) ?? 0) > TREND },
      { id: "flat", label: "Flat", test: (p, c) => changeOf(p, c.span) !== null && Math.abs(changeOf(p, c.span) ?? 0) <= TREND },
      { id: "down", label: "Shrinking", test: (p, c) => (changeOf(p, c.span) ?? 0) < -TREND },
    ],
  },
  {
    key: "native",
    label: "Home chain",
    options: [
      { id: "yes", label: "Mostly on Avalanche", test: (p) => (p.avalancheShare ?? 0) >= 0.5 },
      { id: "no", label: "Mostly elsewhere", test: (p) => p.avalancheShare !== null && p.avalancheShare < 0.5 },
    ],
  },
  {
    key: "age",
    label: "Listed",
    options: [
      { id: "90d", label: "Last 90 days", test: (p, c) => p.listedAt !== null && c.now - p.listedAt <= 90 * DAY },
      { id: "1y", label: "Last year", test: (p, c) => p.listedAt !== null && c.now - p.listedAt <= 365 * DAY },
      { id: "older", label: "Over a year ago", test: (p, c) => p.listedAt !== null && c.now - p.listedAt > 365 * DAY },
    ],
  },
  {
    key: "activity",
    label: "Activity",
    options: [
      { id: "volume", label: "DEX volume", test: (p) => (p.volume24h ?? 0) > 0 },
      { id: "fees", label: "Earns fees", test: (p) => (p.fees24h ?? 0) > 0 },
      { id: "borrowing", label: "Lends", test: (p) => (p.borrowed ?? 0) > 0 },
    ],
  },
];

export const FACET: Record<FacetKey, Facet> = Object.fromEntries(FACETS.map((f) => [f.key, f])) as Record<FacetKey, Facet>;

/* ------------------------------------------------------------------ */
/* matching                                                            */
/* ------------------------------------------------------------------ */

function matchesQuery(p: DefiProtocol, q: string): boolean {
  if (!q) return true;
  return (
    p.name.toLowerCase().includes(q) ||
    p.slug.includes(q) ||
    p.category.toLowerCase().includes(q) ||
    GROUP[p.group].label.toLowerCase().includes(q)
  );
}

function matchesFacets(p: DefiProtocol, sel: Selection, ctx: Ctx, skip?: FacetKey): boolean {
  for (const f of FACETS) {
    if (f.key === skip) continue;
    const picked = sel[f.key];
    if (!picked?.length) continue;
    if (!f.options.some((o) => picked.includes(o.id) && o.test(p, ctx))) return false;
  }
  return true;
}

export function applyFilter(rows: DefiProtocol[], sel: Selection, query: string, span: Span, now: number): DefiProtocol[] {
  const q = query.trim().toLowerCase();
  const ctx = { span, now };
  return rows.filter((p) => matchesQuery(p, q) && matchesFacets(p, sel, ctx));
}

/* each option counts what the table would hold if it were ticked: every
   other part of the filter applies, its own facet does not */
export function facetCounts(
  rows: DefiProtocol[],
  sel: Selection,
  query: string,
  span: Span,
  now: number,
): Record<FacetKey, Record<string, { n: number; tvl: number }>> {
  const q = query.trim().toLowerCase();
  const ctx = { span, now };
  const searched = rows.filter((p) => matchesQuery(p, q));
  const out = {} as Record<FacetKey, Record<string, { n: number; tvl: number }>>;
  for (const f of FACETS) {
    const pool = searched.filter((p) => matchesFacets(p, sel, ctx, f.key));
    out[f.key] = Object.fromEntries(
      f.options.map((o) => {
        const hit = pool.filter((p) => o.test(p, ctx));
        return [o.id, { n: hit.length, tvl: hit.reduce((s, p) => s + p.tvl, 0) }];
      }),
    );
  }
  return out;
}

export function isFiltering(sel: Selection, query: string): boolean {
  return !!query.trim() || Object.values(sel).some((v) => !!v?.length);
}

export function toggleOption(sel: Selection, key: FacetKey, id: string): Selection {
  const cur = sel[key] ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  return { ...sel, [key]: next.length ? next : undefined };
}

function sameIds(a: string[] | undefined, b: string[] | undefined): boolean {
  const x = [...(a ?? [])].sort();
  const y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** set one facet to exactly these options, or clear it when it already is */
export function cutTo(sel: Selection, key: FacetKey, ids: string[]): Selection {
  return { ...sel, [key]: sameIds(sel[key], ids) ? undefined : ids };
}

/* ------------------------------------------------------------------ */
/* presets                                                             */
/* ------------------------------------------------------------------ */

export interface Preset {
  id: string;
  label: string;
  title: string;
  selection: Selection;
}

export const PRESETS: Preset[] = [
  { id: "growing", label: "Growing", title: "TVL on Avalanche up more than 5% over the window", selection: { trend: ["up"] } },
  { id: "shrinking", label: "Shrinking", title: "TVL on Avalanche down more than 5% over the window", selection: { trend: ["down"] } },
  {
    id: "natives",
    label: "Avalanche natives",
    title: "Protocols with most of their TVL, across all chains, on Avalanche",
    selection: { native: ["yes"] },
  },
  { id: "new", label: "New this quarter", title: "Protocols DefiLlama listed in the last 90 days", selection: { age: ["90d"] } },
  { id: "fees", label: "Earning fees", title: "Protocols that earned fees on Avalanche in the last 24 hours", selection: { activity: ["fees"] } },
];

export function presetActive(p: Preset, sel: Selection): boolean {
  return FACET_KEYS.every((k) => sameIds(sel[k], p.selection[k]));
}

/* ------------------------------------------------------------------ */
/* sorting                                                             */
/* ------------------------------------------------------------------ */

export type SortKey = "tvl" | "change" | "delta" | "volume" | "fees" | "share" | "listed" | "name";
export interface Sort {
  key: SortKey;
  dir: 1 | -1;
}
export const DEFAULT_SORT: Sort = { key: "tvl", dir: -1 };
const SORT_KEYS: SortKey[] = ["tvl", "change", "delta", "volume", "fees", "share", "listed", "name"];

function sortValue(p: DefiProtocol, key: SortKey, span: Span): number | null {
  switch (key) {
    case "tvl":
      return p.tvl;
    case "change":
      return changeOf(p, span);
    case "delta":
      return deltaOf(p, span);
    case "volume":
      return p.volume24h;
    case "fees":
      return p.fees24h;
    case "share":
      return p.avalancheShare;
    case "listed":
      return p.listedAt;
    case "name":
      return null;
  }
}

/** a missing value sorts last either way; ties fall back to TVL */
export function sortRows(rows: DefiProtocol[], sort: Sort, span: Span): DefiProtocol[] {
  if (sort.key === "name") return [...rows].sort((a, b) => a.name.localeCompare(b.name) * sort.dir);
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key, span);
    const y = sortValue(b, sort.key, span);
    if (x === null && y === null) return b.tvl - a.tvl;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sort.dir || b.tvl - a.tvl;
  });
}

/* ------------------------------------------------------------------ */
/* the URL form                                                        */
/* ------------------------------------------------------------------ */

export interface TableState {
  q: string;
  selection: Selection;
  sort: Sort;
}

const TOKEN = /^[a-z0-9-]{1,16}$/;

export function readState(params: URLSearchParams): TableState {
  const selection: Selection = {};
  for (const key of FACET_KEYS) {
    const valid = new Set(FACET[key].options.map((o) => o.id));
    const ids = (params.get(key) ?? "").split(",").filter((id) => TOKEN.test(id) && valid.has(id));
    if (ids.length) selection[key] = [...new Set(ids)];
  }
  const sortKey = params.get("sort") as SortKey | null;
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    selection,
    sort: sortKey && SORT_KEYS.includes(sortKey) ? { key: sortKey, dir: params.get("dir") === "asc" ? 1 : -1 } : DEFAULT_SORT,
  };
}

/** the page's params with the table state written in; other params are kept */
export function writeState(params: URLSearchParams, s: TableState): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of [...FACET_KEYS, "q", "sort", "dir"]) next.delete(key);
  for (const key of FACET_KEYS) {
    const ids = s.selection[key];
    if (ids?.length) next.set(key, ids.join(","));
  }
  const q = s.q.trim();
  if (q) next.set("q", q.slice(0, 80));
  if (s.sort.key !== DEFAULT_SORT.key || s.sort.dir !== DEFAULT_SORT.dir) {
    next.set("sort", s.sort.key);
    next.set("dir", s.sort.dir === 1 ? "asc" : "desc");
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

function csvCell(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: DefiProtocol[], span: Span): string {
  const head = [
    "protocol",
    "category",
    "group",
    "tvl_usd",
    `change_${span}_pct`,
    `change_${span}_usd`,
    "volume_24h_usd",
    "fees_24h_usd",
    "borrowed_usd",
    "avalanche_share_pct",
    "listed",
    "defillama",
  ];
  const lines = rows.map((p) => {
    const c = changeOf(p, span);
    const d = deltaOf(p, span);
    return [
      p.name,
      p.category,
      GROUP[p.group].label,
      Math.round(p.tvl),
      c === null ? null : Number(c.toFixed(2)),
      d === null ? null : Math.round(d),
      p.volume24h === null ? null : Math.round(p.volume24h),
      p.fees24h === null ? null : Math.round(p.fees24h),
      p.borrowed === null ? null : Math.round(p.borrowed),
      p.avalancheShare === null ? null : Number((p.avalancheShare * 100).toFixed(1)),
      p.listedAt === null ? null : new Date(p.listedAt * 1000).toISOString().slice(0, 10),
      `https://defillama.com/protocol/${p.slug}`,
    ]
      .map(csvCell)
      .join(",");
  });
  return [head.join(","), ...lines].join("\n") + "\n";
}

export type { GroupKey };
