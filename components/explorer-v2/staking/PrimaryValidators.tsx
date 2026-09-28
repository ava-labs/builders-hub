"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, Link2, Search, SlidersHorizontal, X } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Board, CellLabel, ChartBoard, LoadMore, SectionHeader, HEAD, ROW, EmptyRow, RowSkeleton, idInk } from "@/components/explorer-v2/ui";
import { StatSlab } from "@/components/explorer-v2/StatSlab";
import { uptimeRequirementAt } from "@/constants/helicon";
import {
  CRAWLER_FACETS,
  ENDS_OPTIONS,
  MISS_OPTIONS,
  NO_VERSION,
  PRESETS,
  applyFilter,
  buildRows,
  cutTo,
  defaultTarget,
  facetCounts,
  facetsFor,
  isFiltering,
  linkable,
  missingIds,
  parseQuery,
  presetActive,
  readState,
  requiredRelease,
  sortRows,
  summarize,
  targetOptions,
  toCsv,
  toggleOption,
  withStatus,
  writeState,
  type FacetKey,
  type FacetOption,
  type Preset,
  type Selection,
  type Sort,
  type SortKey,
  type StatusRow,
} from "@/lib/validator-triage";
import { BEHIND_SWATCH, UpgradeReadiness, releaseShares } from "./UpgradeReadiness";
import { ActiveChips, FacetRail, PresetRow, type Pending } from "./TriageFilters";
import { ChartEmpty, TipPlate } from "./bits";
import {
  NANO,
  fmtCompact,
  num,
  thin,
  toSeries,
  useAvalancheGoReleases,
  usePrimaryMetrics,
  useP2pValidators,
  useSdkValidators,
  useTotalSeats,
} from "./data";

/* The Primary Network's validator set, built for the question it is asked
   most: who has not upgraded yet. The readiness board measures the set
   against a target release (by default the newest one its notes call
   mandatory) and draws every validator; the roster below cuts the set by
   any mix of version, connection, stake, uptime, miss rate, time left and
   delegators, and hands the cut on as a link, a NodeID list or a CSV. The
   whole filter rides in the URL, so a triage view can be shared as is.

   Same stats grammar as the gas market: outlined ChartBoards, mono titles
   fused into the border, legends and toggles in the action slot. It stays
   off the page clock: this is a roster plus all-time context, not a
   windowed trend, so each card states its own basis (· 14d, · all-time). */

const QUIET_BAR = "#A2AFB2";
const SEATS_COLOR = "#0061E2";
const ETNA_DAY = "2024-12-16";
const PAGE = 50;
const GRID = "md:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_7rem_5rem_3.5rem_5rem_5rem_5rem]";

function uptimeTone(pct: number, need: number): string {
  if (pct >= 99) return "text-zinc-700 dark:text-zinc-300";
  if (pct >= need) return "text-amber-600 dark:text-amber-400";
  return "text-[#E6212F]";
}

function daysLeftTone(days: number): string {
  if (days < 7) return "font-medium text-[#E6212F]";
  if (days < 30) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-700 dark:text-zinc-300";
}

function missRateTone(pct: number): string {
  if (pct === 0) return "text-zinc-700 dark:text-zinc-300";
  if (pct < 5) return "text-amber-600 dark:text-amber-400";
  return "text-[#E6212F]";
}

const STATUS_INK = {
  current: "text-zinc-700 dark:text-zinc-300",
  behind: "text-[#E6212F]",
  unknown: "text-zinc-400 dark:text-zinc-500",
} as const;

const NA = <span className="text-zinc-300 dark:text-zinc-700">n/a</span>;

/* simple bucket bars shared by the two health charts */
function BucketBars({
  data,
  tint,
  picked,
  onPick,
}: {
  data: { id: string; label: string; count: number }[];
  /** per-bucket bar color; defaults to the quiet steel */
  tint?: (bucket: { id: string }) => string;
  /** the bucket the roster is cut to */
  picked?: string;
  onPick?: (id: string) => void;
}) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="18%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" }} />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { id: string; label: string; count: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.label}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.count.toLocaleString()} validator{d.count === 1 ? "" : "s"}
                  </p>
                  {onPick && d.count > 0 && <p className="text-[10px] text-zinc-400">{picked === d.id ? "Click to show all" : "Click to list them"}</p>}
                </TipPlate>
              );
            }}
          />
          <Bar
            dataKey="count"
            minPointSize={1}
            isAnimationActive={false}
            radius={[2, 2, 0, 0]}
            className={onPick ? "cursor-pointer" : undefined}
            onClick={(d: { payload?: { id: string; count: number } }) => d.payload && d.payload.count > 0 && onPick?.(d.payload.id)}
          >
            {data.map((bucket) => (
              <Cell
                key={bucket.id}
                fill={tint ? tint(bucket) : QUIET_BAR}
                fillOpacity={picked && picked !== bucket.id ? 0.25 : 1}
                style={{ transition: "fill-opacity 250ms cubic-bezier(0.32,0.72,0,1)" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CountPoint {
  day: string;
  count: number;
  seats?: number;
}

/* validator count with the post-Etna total-seats overlay */
function CountChart({ data }: { data: CountPoint[] }) {
  return (
    <div className="h-56 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as CountPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.day}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {Math.round(d.count).toLocaleString()} Primary Network validators
                  </p>
                  {d.seats !== undefined && (
                    <p className="text-[10px] tabular-nums text-zinc-500">{Math.round(d.seats).toLocaleString()} seats incl. L1s</p>
                  )}
                </TipPlate>
              );
            }}
          />
          <Area type="monotone" dataKey="count" stroke="currentColor" strokeWidth={1.5} fill="currentColor" fillOpacity={0.1} isAnimationActive={false} />
          <Line type="monotone" dataKey="seats" stroke={SEATS_COLOR} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <ReferenceLine
            x={ETNA_DAY}
            stroke="#E6212F"
            strokeDasharray="4 3"
            label={{ value: "ACP-77", position: "insideTopRight", fontSize: 10, fontFamily: "monospace", fill: "#E6212F" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** a toolbar action in the ledger voice */
function ToolButton({
  icon: Icon,
  onClick,
  disabled,
  title,
  children,
}: {
  icon: typeof Copy;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex shrink-0 items-center gap-1.5 border border-zinc-200 bg-white/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 transition-colors enabled:hover:border-zinc-900 enabled:hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:enabled:hover:border-zinc-100 dark:enabled:hover:text-zinc-100"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {children}
    </button>
  );
}

function OnlineDot({ online }: { online: boolean | null }) {
  if (online === null) return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" title="Connection not reported" />;
  return online ? (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" title="Online" />
  ) : (
    <span className="h-2 w-2 shrink-0 rounded-full ring-[1.5px] ring-inset ring-[#E6212F]" title="Offline" />
  );
}

export function PrimaryValidatorsContent(props: { stakingHref: string; switched?: boolean }) {
  return (
    // the roster's filter rides in the URL, so the view renders under a Suspense boundary
    <Suspense
      fallback={
        <Board divide={false} className="border">
          <RowSkeleton n={8} />
        </Board>
      }
    >
      <PrimaryValidatorsView {...props} />
    </Suspense>
  );
}

function PrimaryValidatorsView({ stakingHref, switched = false }: { stakingHref: string; switched?: boolean }) {
  const params = useSearchParams();
  const [initial] = useState(() => readState(new URLSearchParams(params.toString())));
  const [targetPick, setTargetPick] = useState<string | null>(initial.target);
  const [query, setQuery] = useState(initial.q);
  const [selection, setSelection] = useState<Selection>(initial.selection);
  const [sort, setSort] = useState<Sort>(initial.sort);
  const [shown, setShown] = useState(PAGE);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const rosterRef = useRef<HTMLElement>(null);

  const { data: metrics, failed: metricsFailed } = usePrimaryMetrics();
  const { data: sdkValidators, failed: sdkFailed } = useSdkValidators();
  const { data: p2p, failed: p2pFailed } = useP2pValidators();
  const { data: totalSeats } = useTotalSeats();
  const { data: releases } = useAvalancheGoReleases();

  /* ---------------------------------------------------------------- */
  /* the set, measured against the target                             */
  /* ---------------------------------------------------------------- */

  const base = useMemo(() => (sdkValidators ? buildRows(sdkValidators, p2p) : null), [sdkValidators, p2p]);
  const required = useMemo(() => requiredRelease(releases), [releases]);
  const latest = releases?.[0] ?? null;
  const target = targetPick ?? (base ? defaultTarget(base, releases) : null);
  // no target only when no node reports a version and GitHub is unreachable: the roster still lists
  const rows = useMemo(() => (base ? withStatus(base, target ?? "0.0.0") : null), [base, target]);
  const targets = useMemo(() => (base ? targetOptions(base, releases, target) : []), [base, releases, target]);
  const shares = useMemo(() => (rows && target ? releaseShares(rows, target) : []), [rows, target]);

  /* ---------------------------------------------------------------- */
  /* the roster's filter                                              */
  /* ---------------------------------------------------------------- */

  const facets = useMemo(() => facetsFor(rows ?? []), [rows]);
  const q = useMemo(() => parseQuery(query), [query]);
  const filtering = isFiltering(selection, q);
  const filtered = useMemo(() => (rows ? sortRows(applyFilter(rows, facets, selection, q), sort) : []), [rows, facets, selection, q, sort]);
  const counts = useMemo(() => (rows ? facetCounts(rows, facets, selection, q) : null), [rows, facets, selection, q]);
  const visible = useMemo(() => (filtering ? new Set(filtered.map((r) => r.nodeId)) : null), [filtering, filtered]);
  const missing = useMemo(() => (rows ? missingIds(rows, q) : []), [rows, q]);
  // a preset counts inside the search, so a pasted list reads its own triage
  const presetCounts = useMemo(
    () => Object.fromEntries(PRESETS.map((p) => [p.id, rows ? applyFilter(rows, facets, p.selection, q).length : 0])),
    [rows, facets, q],
  );
  const activeFacets = Object.values(selection).filter((v) => v?.length).length;
  const canLink = linkable(query);

  /* uptime, miss rate and time left come from the crawler alone: until it
     answers, those counts read as waiting, not as zero */
  const pending: Pending | null = p2p
    ? null
    : p2pFailed
      ? { keys: CRAWLER_FACETS, label: "n/a", title: "The crawler feed is unavailable, so uptime, miss rate and time left cannot filter" }
      : { keys: CRAWLER_FACETS, label: "…", title: "Waiting for the crawler feed" };
  const waitingOnCrawler = !!pending && CRAWLER_FACETS.some((k) => !!selection[k]?.length);

  /* The filter rides in the URL, so a triage view can be shared as a link.
     The write waits for typing to pause: Safari refuses more than 100
     history updates in 10 seconds, and Next adds one of its own to each. */
  const viewUrl = () => {
    const url = new URL(window.location.href);
    const next = writeState(url.searchParams, { target: targetPick, q: query, selection, sort }).toString();
    return `${url.pathname}${next ? `?${next}` : ""}${url.hash}`;
  };
  useEffect(() => {
    const t = setTimeout(() => {
      const next = viewUrl();
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      try {
        window.history.replaceState(null, "", next);
      } catch {
        /* a browser that refuses the update keeps the old URL; the view is unaffected */
      }
    }, 300);
    return () => clearTimeout(t);
    // viewUrl reads the same four values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPick, query, selection, sort]);

  const reveal = () => requestAnimationFrame(() => rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const onToggle = (key: FacetKey, id: string) => {
    setSelection((s) => toggleOption(s, key, id));
    setShown(PAGE);
  };
  /** a figure above the roster cuts it to one facet's options, and brings it into view */
  const onCut = (key: FacetKey, ids: string[]) => {
    const next = cutTo(selection, key, ids);
    setSelection(next);
    setShown(PAGE);
    if (next[key]) reveal();
  };
  const onPreset = (p: Preset) => {
    setSelection(presetActive(p, selection) ? {} : p.selection);
    setShown(PAGE);
  };
  const clearFacet = (key: FacetKey) => {
    setSelection((s) => ({ ...s, [key]: undefined }));
    setShown(PAGE);
  };
  const clearAll = () => {
    setSelection({});
    setQuery("");
    setShown(PAGE);
  };
  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: -1 }));
    setShown(PAGE);
  };
  const cutIs = (key: FacetKey, ids: string[]) => {
    const cur = selection[key] ?? [];
    return cur.length === ids.length && ids.every((id) => cur.includes(id));
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable: the IDs are in the table and the CSV */
    }
  };
  const download = () => {
    if (!target) return;
    const href = URL.createObjectURL(new Blob([toCsv(filtered, target)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = `avalanche-validators-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  };

  /* the swatches tie the rail's options to the colors on the board */
  const paintOf = useMemo(() => new Map(shares.map((s) => [s.version, s.paint])), [shares]);
  const swatch = (key: FacetKey, id: string): CSSProperties | undefined => {
    if (key === "version") return { background: paintOf.get(id) ?? "#a1a1aa" };
    if (key === "status") return { background: id === "current" ? "#16a34a" : id === "behind" ? BEHIND_SWATCH : "#a1a1aa" };
    if (key === "online") return id === "yes" ? { background: "#10b981" } : { boxShadow: "inset 0 0 0 1.5px #E6212F" };
    return undefined;
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sort.key === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn("uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100", active && "text-zinc-900 dark:text-zinc-100")}
      >
        {label}
        {active ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  /* ---------------------------------------------------------------- */
  /* health across the set                                            */
  /* ---------------------------------------------------------------- */

  // validations that start after Helicon need 90% uptime to earn rewards; earlier ones 80%
  const need = useMemo(() => uptimeRequirementAt(Date.now()), []);
  const underIds = need > 80 ? ["80", "lt80"] : ["lt80"];
  const uptime = useMemo(() => {
    const all = (rows ?? []).map((r) => r.uptime).filter((u): u is number => u !== null).sort((a, b) => a - b);
    if (!all.length) return null;
    return { median: all[Math.floor(all.length / 2)], under: all.filter((u) => u < need).length };
  }, [rows, need]);

  const expiring = useMemo(() => {
    const days = (rows ?? []).map((r) => r.daysLeft).filter((d): d is number => d !== null);
    if (!days.length) return null;
    return { within30: days.filter((d) => d < 30).length, within7: days.filter((d) => d < 7).length };
  }, [rows]);

  // the health charts draw the crawler's buckets over the whole set, whatever the cut
  const [missBuckets, daysBuckets] = useMemo(() => {
    const crawled = (rows ?? []).filter((r) => r.missRate !== null);
    const bucket = (options: FacetOption[]) =>
      crawled.length ? options.map((o) => ({ id: o.id, label: o.label, count: crawled.filter(o.test).length })) : [];
    return [bucket(MISS_OPTIONS), bucket(ENDS_OPTIONS)];
  }, [rows]);
  const single = (key: FacetKey) => (selection[key]?.length === 1 ? selection[key]?.[0] : undefined);

  const topProducers = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => (r.blocks14d ?? 0) > 0)
        .sort((a, b) => (b.blocks14d ?? 0) - (a.blocks14d ?? 0))
        .slice(0, 15),
    [rows],
  );
  const maxBlocks = topProducers[0]?.blocks14d ?? 0;

  /* ---------------------------------------------------------------- */
  /* validator count trend + the total-seats overlay                   */
  /* ---------------------------------------------------------------- */

  const countSeries = useMemo<CountPoint[]>(() => {
    const series = toSeries(metrics?.validator_count);
    if (!series.length) return [];
    const seats = new Map(toSeries(totalSeats).map((p) => [p.day, p.value]));
    return thin(
      series.map((p) => ({
        day: p.day,
        count: p.value,
        // the seats series only means something after Etna split the roles
        seats: p.day >= ETNA_DAY ? seats.get(p.day) : undefined,
      })),
    );
  }, [metrics, totalSeats]);

  const ownStake = num(metrics?.validator_weight?.current_value);
  const delegatedStake = num(metrics?.delegator_weight?.current_value);
  const totalWeight = ownStake !== null && delegatedStake !== null ? (ownStake + delegatedStake) / NANO : null;

  /* the slabs' strips: the last 60 days of each figure */
  const countSpark = useMemo(() => toSeries(metrics?.validator_count).slice(-60).map((p) => p.value), [metrics]);
  const countDelta = countSpark.length > 30 ? countSpark[countSpark.length - 1] - countSpark[countSpark.length - 31] : null;
  const weightSpark = useMemo(() => {
    const own = toSeries(metrics?.validator_weight);
    const del = new Map(toSeries(metrics?.delegator_weight).map((p) => [p.day, p.value]));
    return own
      .filter((p) => del.has(p.day))
      .slice(-60)
      .map((p) => (p.value + (del.get(p.day) ?? 0)) / NANO);
  }, [metrics]);

  const nodeHref = (nodeId: string) => `/explorer/mainnet/p-chain/node/${encodeURIComponent(nodeId)}`;
  const total = useMemo(() => summarize(rows ?? []), [rows]);
  const sum = useMemo(() => summarize(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-10">
      {/* the set at a glance: each figure a solid; the ones that can cut
          the roster do, and wear the selection blue while they do */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4 lg:gap-x-4">
          <StatSlab
            label="Validators"
            value={sdkValidators ? sdkValidators.length : null}
            format={(n) => n.toLocaleString("en-US")}
            sub={countDelta !== null ? `${countDelta >= 0 ? "+" : ""}${Math.round(countDelta)} in 30 days` : undefined}
            spark={countSpark}
            active={false}
            onClick={filtering ? clearAll : undefined}
            title={filtering ? "Show every validator" : undefined}
          />
          <StatSlab
            label="Median Uptime"
            value={uptime ? uptime.median : null}
            format={(n) => n.toFixed(2)}
            unit="%"
            fill={uptime ? uptime.median / 100 : undefined}
            sub={uptime ? (uptime.under > 0 ? `${uptime.under} under ${need}%` : `every node over ${need}%`) : undefined}
            alert={!!uptime && uptime.under > 0 && cutIs("uptime", underIds)}
            active={cutIs("uptime", underIds)}
            onClick={uptime?.under ? () => onCut("uptime", underIds) : undefined}
            title={`Validations that start after Helicon need 90% uptime to earn rewards. Earlier ones need 80%. Click to list the validators under ${need}%.`}
          />
          <StatSlab
            label="Total Weight"
            value={totalWeight}
            format={fmtCompact}
            unit="AVAX"
            sub="own stake + delegations"
            spark={weightSpark}
            href={switched ? undefined : stakingHref}
            title="Staking economics"
          />
          <StatSlab
            label="Ending · 30d"
            value={expiring ? expiring.within30 : null}
            format={(n) => n.toLocaleString("en-US")}
            alert={!!expiring && expiring.within7 > 0}
            sub={expiring ? expiring.within7 > 0 ? <span className="text-[#E6212F]">{expiring.within7} inside a week</span> : "none inside a week" : undefined}
            active={cutIs("ends", ["lt7", "7-30"])}
            onClick={expiring?.within30 ? () => onCut("ends", ["lt7", "7-30"]) : undefined}
            title="List the validators whose stake ends inside 30 days"
          />
        </div>
      </section>

      {/* how far the set is from the target release */}
      <section>
        {rows && target ? (
          <UpgradeReadiness
            rows={rows}
            visible={visible}
            target={target}
            targets={targets}
            onTarget={(v) => {
              setTargetPick(v);
              setShown(PAGE);
            }}
            required={required}
            latest={latest}
            selection={selection}
            onCut={onCut}
            nodeHref={nodeHref}
          />
        ) : (
          <Board divide={false} className="border">
            {sdkFailed ? (
              <EmptyRow>
                <span className="text-[#E6212F]">validator feed unavailable</span>
              </EmptyRow>
            ) : rows ? (
              <EmptyRow>no validator reports a version</EmptyRow>
            ) : (
              <RowSkeleton n={6} />
            )}
          </Board>
        )}
      </section>

      {/* the roster: the presets, the rail and every figure above can cut it */}
      <section ref={rosterRef} className="flex scroll-mt-24 flex-col gap-4">
        <SectionHeader
          label="Validator Set"
          action={
            rows?.length ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {filtering
                  ? `${filtered.length.toLocaleString("en-US")} / ${rows.length.toLocaleString("en-US")}`
                  : `${rows.length.toLocaleString("en-US")} validators`}
              </span>
            ) : undefined
          }
        />
        <PresetRow counts={presetCounts} selection={selection} onPreset={onPreset} pending={pending} />

        <div className="grid items-start gap-6 xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-8">
          {/* the rail: every part of the filter, each option with the count it would leave */}
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:thin] xl:block">
            <FacetRail facets={facets} counts={counts} selection={selection} onToggle={onToggle} onClearFacet={clearFacet} swatch={swatch} pending={pending} />
          </aside>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-[26rem] dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
                <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShown(PAGE);
                  }}
                  onPaste={(e) => {
                    // a one-line input drops line breaks, which would glue a pasted list together
                    const text = e.clipboardData.getData("text");
                    if (!/[\r\n]/.test(text)) return;
                    e.preventDefault();
                    const el = e.currentTarget;
                    const start = el.selectionStart ?? el.value.length;
                    const end = el.selectionEnd ?? el.value.length;
                    setQuery(`${el.value.slice(0, start)}${text.replace(/\s+/g, " ").trim()}${el.value.slice(end)}`);
                    setShown(PAGE);
                  }}
                  placeholder="NodeID, version, IP, or a list of NodeIDs"
                  aria-label="Search validators"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setShown(PAGE);
                    }}
                    aria-label="Clear search"
                    className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen((o) => !o)}
                aria-expanded={panelOpen}
                className={cn(
                  "inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors xl:hidden",
                  panelOpen || activeFacets > 0
                    ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                Filters{activeFacets > 0 ? ` · ${activeFacets}` : ""}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <ToolButton
                  icon={copied === "ids" ? Check : Copy}
                  onClick={() => copy("ids", filtered.map((r) => r.nodeId).join("\n"))}
                  disabled={!filtered.length}
                  title="Copy the NodeIDs of every validator in this list, one per line"
                >
                  {copied === "ids" ? "Copied" : `Copy ${filtered.length.toLocaleString("en-US")} IDs`}
                </ToolButton>
                <ToolButton icon={Download} onClick={download} disabled={!filtered.length} title="Download this list as CSV">
                  CSV
                </ToolButton>
                <ToolButton
                  icon={copied === "link" ? Check : Link2}
                  onClick={() => copy("link", new URL(viewUrl(), window.location.origin).toString())}
                  title={canLink ? "Copy a link to this view" : "This NodeID list is too long for a link. The link keeps the other filters; use Copy IDs or CSV for the list."}
                >
                  {copied === "link" ? (canLink ? "Copied" : "Copied without the list") : "Link"}
                </ToolButton>
              </div>
            </div>

            {panelOpen && (
              <div className="border border-zinc-200 bg-white/80 px-5 py-4 xl:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
                <FacetRail
                  facets={facets}
                  counts={counts}
                  selection={selection}
                  onToggle={onToggle}
                  onClearFacet={clearFacet}
                  swatch={swatch}
                  pending={pending}
                  layout="grid"
                />
              </div>
            )}

            <ActiveChips facets={facets} selection={selection} onClearFacet={clearFacet} onClearAll={clearAll} />

            {q.ids && rows && (
              <p className="font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {(q.ids.length - missing.length).toLocaleString("en-US")} of {q.ids.length.toLocaleString("en-US")} pasted NodeIDs are in the validator set.
                {missing.length > 0 && (
                  <>
                    {" "}
                    <span className="text-[#E6212F]">
                      {missing.length.toLocaleString("en-US")} {missing.length === 1 ? "is" : "are"} not validating now.
                    </span>{" "}
                    <button
                      type="button"
                      onClick={() => copy("missing", missing.join("\n"))}
                      className="text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                    >
                      {copied === "missing" ? "Copied" : "Copy them"}
                    </button>
                  </>
                )}
              </p>
            )}

            {rows && (
              <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                <span className="text-zinc-900 dark:text-zinc-100">{sum.count.toLocaleString("en-US")}</span> validator{sum.count === 1 ? "" : "s"}
                {" · "}
                <span className="text-zinc-900 dark:text-zinc-100">{fmtCompact(sum.stake)}</span> AVAX
                {filtering && total.stake > 0 && ` · ${((sum.stake / total.stake) * 100).toFixed(1)}% of stake`}
                {" · "}
                {sum.delegators.toLocaleString("en-US")} delegator{sum.delegators === 1 ? "" : "s"}
              </p>
            )}

            <Board divide={false}>
              {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
              <div className="overflow-x-auto">
                <div className="md:min-w-[60rem]">
                  <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
                    <span>#</span>
                    <span>Node</span>
                    <span><SortHeader label="Version" k="version" /></span>
                    <span className="text-right"><SortHeader label="Total Stake" k="stake" /></span>
                    <span className="text-right"><SortHeader label="Delegators" k="delegators" /></span>
                    <span className="text-right"><SortHeader label="Fee" k="fee" /></span>
                    <span className="text-right"><SortHeader label="Uptime" k="uptime" /></span>
                    <span className="whitespace-nowrap text-right"><SortHeader label="Days Left" k="daysLeft" /></span>
                    <span className="whitespace-nowrap text-right"><SortHeader label="Miss · 14d" k="missRate" /></span>
                  </div>
                  {!rows && !sdkFailed && <RowSkeleton n={12} />}
                  {rows &&
                    filtered.slice(0, shown).map((r: StatusRow, i) => (
                      <Link
                        key={r.nodeId}
                        href={nodeHref(r.nodeId)}
                        title={r.ip ? `${r.nodeId} · ${r.ip}` : r.nodeId}
                        className={cn(ROW, "grid-cols-4 gap-x-3 md:gap-x-4", GRID, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}
                      >
                        <span className="hidden font-mono text-[12px] tabular-nums text-zinc-400 md:block dark:text-zinc-500">{i + 1}</span>
                        <span className="col-span-4 flex min-w-0 items-center gap-2 md:col-span-1">
                          <OnlineDot online={r.online} />
                          <span className={cn("flex min-w-0 font-mono text-[12px]", idInk)}>
                            <span className="truncate">{r.nodeId.slice(0, -6)}</span>
                            <span className="shrink-0">{r.nodeId.slice(-6)}</span>
                          </span>
                        </span>
                        <span className="min-w-0">
                          <CellLabel>Version</CellLabel>
                          <span className="flex items-center gap-1.5 font-mono text-[12px]">
                            <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: paintOf.get(r.version ?? NO_VERSION) ?? "#a1a1aa" }} />
                            <span className={cn("truncate", STATUS_INK[r.status])}>{r.version ?? "unknown"}</span>
                          </span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Stake</CellLabel>
                          <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">
                            {fmtCompact(r.stake)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                          </span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Delegators</CellLabel>
                          <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{r.delegators.toLocaleString("en-US")}</span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Fee</CellLabel>
                          <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">{r.fee !== null ? `${r.fee.toFixed(0)}%` : NA}</span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Uptime</CellLabel>
                          <span className={cn("font-mono text-[12px] tabular-nums", r.uptime !== null && uptimeTone(r.uptime, need))}>
                            {r.uptime !== null ? `${r.uptime.toFixed(2)}%` : NA}
                          </span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Days left</CellLabel>
                          <span className={cn("font-mono text-[12px] tabular-nums", r.daysLeft !== null && daysLeftTone(r.daysLeft))}>{r.daysLeft ?? NA}</span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Miss · 14d</CellLabel>
                          <span className={cn("font-mono text-[12px] tabular-nums", r.missRate !== null && missRateTone(r.missRate))}>
                            {r.missRate !== null ? `${r.missRate.toFixed(1)}%` : NA}
                          </span>
                        </span>
                      </Link>
                    ))}
                  {rows && filtered.length === 0 && (
                    <EmptyRow>
                      {waitingOnCrawler ? (
                        p2pFailed ? (
                          <>
                            the crawler feed is unavailable, so the uptime, miss rate and time-left filters cannot apply.{" "}
                            <button type="button" onClick={clearAll} className="text-[#0061E2] hover:underline dark:text-[#5f9dff]">
                              Clear the filter
                            </button>
                          </>
                        ) : (
                          "loading uptime, miss rate and time left from the crawler feed…"
                        )
                      ) : filtering ? (
                        <>
                          no validators match.{" "}
                          <button type="button" onClick={clearAll} className="text-[#0061E2] hover:underline dark:text-[#5f9dff]">
                            Clear the filter
                          </button>
                        </>
                      ) : (
                        "no validators found"
                      )}
                    </EmptyRow>
                  )}
                  {sdkFailed && !rows && (
                    <EmptyRow>
                      <span className="text-[#E6212F]">validator feed unavailable</span>
                    </EmptyRow>
                  )}
                </div>
              </div>
            </Board>
            {shown < filtered.length && (
              <LoadMore onClick={() => setShown((s) => s + PAGE)} label={`Load more · ${(filtered.length - shown).toLocaleString("en-US")} remaining`} />
            )}
          </div>
        </div>
      </section>

      {/* how the fleet is behaving */}
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label="Block Miss Rate · 14d">
          {missBuckets.length ? (
            <BucketBars
              data={missBuckets}
              picked={single("miss")}
              onPick={(id) => onCut("miss", [id])}
              tint={(b) => (b.id === "0" || b.id === "0-1" ? QUIET_BAR : "#E6212F")}
            />
          ) : (
            <ChartEmpty failed={false} />
          )}
        </ChartBoard>

        <ChartBoard label="Time Remaining · current set">
          {daysBuckets.length ? (
            <BucketBars
              data={daysBuckets}
              picked={single("ends")}
              onPick={(id) => onCut("ends", [id])}
              tint={(b) => (b.id === "lt7" ? "#E6212F" : b.id === "7-30" ? "#d97706" : QUIET_BAR)}
            />
          ) : (
            <ChartEmpty failed={false} />
          )}
        </ChartBoard>
      </div>

      {/* who is actually sealing the chain */}
      {topProducers.length > 0 && (
        <ChartBoard label="Top Block Producers · 14d" bodyClassName="p-0 divide-y divide-zinc-200 dark:divide-zinc-800">
          {topProducers.map((r, i) => (
            <div key={r.nodeId} className="grid grid-cols-[2rem_minmax(0,14rem)_1fr_auto] items-center gap-4 px-5 py-2.5 md:px-6">
              <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
              <Link href={nodeHref(r.nodeId)} className="truncate font-mono text-[12px] text-[#0061E2] hover:underline dark:text-[#5f9dff]">
                {r.nodeId.slice(7, 15)}…{r.nodeId.slice(-6)}
              </Link>
              <span className="h-2 bg-zinc-100 dark:bg-zinc-900">
                <span className="block h-full bg-[#A2AFB2] dark:bg-zinc-600" style={{ width: `${maxBlocks > 0 ? ((r.blocks14d ?? 0) / maxBlocks) * 100 : 0}%` }} />
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300">
                {(r.blocks14d ?? 0).toLocaleString("en-US")}
                <span className="ml-2 text-zinc-400 dark:text-zinc-500">miss {(r.missRate ?? 0).toFixed(1)}%</span>
              </span>
            </div>
          ))}
        </ChartBoard>
      )}

      {/* how the set got to this size */}
      <div className="flex flex-col gap-4">
        <ChartBoard
          label="Validator Count · All Time"
          action={
            <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 bg-zinc-900/15 dark:bg-zinc-100/15" /> primary network
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#0061E2]" /> seats incl. L1s
              </span>
            </span>
          }
        >
          {countSeries.length ? <CountChart data={countSeries} /> : <ChartEmpty failed={metricsFailed} />}
        </ChartBoard>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          After the Etna upgrade (ACP-77), L1 validators no longer stake on the Primary Network. The blue line counts every validator seat across the
          ecosystem since then.
        </p>
      </div>
    </div>
  );
}
