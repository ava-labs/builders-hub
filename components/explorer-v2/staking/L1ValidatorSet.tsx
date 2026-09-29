"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, Link2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, ChartBoard, EmptyRow, HEAD, LoadMore, ROW, RowSkeleton, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { StatSlab } from "@/components/explorer-v2/StatSlab";
import { useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { isPrivateChain } from "@/components/explorer-v2/network/private";
import { hasRealChainLogo } from "@/lib/pchain-explorer";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import {
  NO_VERSION,
  cutTo,
  defaultTarget,
  filterRows,
  isFiltering,
  linkable,
  missingIds,
  optionCounts,
  parseQuery,
  presetActive,
  requiredRelease,
  targetOptions,
  toggleOption,
  withStatus,
  type FacetOption,
  type Preset,
  type Selection,
  type Sort,
} from "@/lib/validator-triage";
import {
  L1_PRESETS,
  PRICE_FACETS,
  RUNWAY_OPTIONS,
  SEEN_OPTIONS,
  buildL1Rows,
  l1Finder,
  l1FacetsFor,
  readL1State,
  seenText,
  sortL1Rows,
  summarizeL1Rows,
  summarizeL1s,
  toL1Csv,
  writeL1State,
  type L1FacetKey,
  type L1Info,
  type L1SortKey,
  type L1StatusRow,
} from "@/lib/l1-validator-triage";
import { BEHIND_SWATCH, UNKNOWN, releaseShares } from "./UpgradeReadiness";
import { L1Board, L1Readiness } from "./L1Readiness";
import { ActiveChips, FacetRail, NA, PresetRow, RosterSearch, STATUS_INK, ToolButton, daysLeftTone, type Pending } from "./TriageFilters";
import { BucketBars, QUIET_BAR } from "./BucketBars";
import { ChartEmpty } from "./bits";
import { NANO, fmtCompact, toSeries, useAvalancheGoReleases, useEcosystemSeats, useL1Validators } from "./data";

/* Every L1's validator set, beside the Primary Network's on the P-Chain
   validators tab, built for the same question: who has not upgraded.
   The same triage grammar as the Primary Network roster (PrimaryValidators):
   figures that cut the roster, the readiness board against the target
   release, presets, a facet rail, a search that takes a pasted NodeID
   list, and a filter that rides in the URL. What an L1 validator has to
   show differs: a weight on its own L1, the balance that pays the
   continuous fee, and the crawler's last handshake, which dates its
   version. One row per validation: a node can hold seats on several L1s. */

const PAGE = 50;
const GRID = "md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,9rem)_6.5rem_4.5rem_6rem_5rem_6.5rem]";
const AMBER_BAR = "#d97706";
// every L1 in the rail would bury the facets below it: the rail shows the 8 that leave the most validators
const RAIL_FOLD: Partial<Record<L1FacetKey, number>> = { l1: 8 };

const catalogBySubnet = new Map((l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true && c.subnetId).map((c) => [String(c.subnetId), c]));

/** a balance in AVAX: two decimals while it is small */
function fmtBalance(avax: number): string {
  if (avax >= 1000) return fmtCompact(avax);
  return avax.toFixed(avax >= 10 ? 1 : 2);
}

/** the crawler's last handshake: amber once it is a week old */
function seenTone(days: number): string {
  return days < 7 ? "text-zinc-700 dark:text-zinc-300" : "text-amber-600 dark:text-amber-400";
}

export function L1ValidatorSetContent() {
  return (
    // the roster's filter rides in the URL, so the view renders under a Suspense boundary
    <Suspense
      fallback={
        <Board divide={false} className="border">
          <RowSkeleton n={8} />
        </Board>
      }
    >
      <L1ValidatorSetView />
    </Suspense>
  );
}

function L1ValidatorSetView() {
  const params = useSearchParams();
  const [initial] = useState(() => readL1State(new URLSearchParams(params.toString())));
  const [targetPick, setTargetPick] = useState<string | null>(initial.target);
  const [query, setQuery] = useState(initial.q);
  const [selection, setSelection] = useState<Selection<L1FacetKey>>(initial.selection);
  const [sort, setSort] = useState<Sort<L1SortKey>>(initial.sort);
  const [shown, setShown] = useState(PAGE);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const rosterRef = useRef<HTMLElement>(null);

  const { data: feed, failed } = useL1Validators();
  const { data: releases } = useAvalancheGoReleases();
  const { data: seats } = useEcosystemSeats();
  const { subnets } = useValidatorStats();
  const price = feed?.price ?? null;

  /* ---------------------------------------------------------------- */
  /* the set, measured against the target                             */
  /* ---------------------------------------------------------------- */

  // an L1's name: the catalog's, else the stats feed's, else its subnet ID
  const infoOf = useMemo(() => {
    const stats = new Map((subnets ?? []).map((s) => [s.id, s]));
    return (subnetId: string): L1Info => {
      const c = catalogBySubnet.get(subnetId);
      if (c) return { name: c.chainName, logo: hasRealChainLogo(c.chainLogoURI) ? c.chainLogoURI : undefined, slug: c.slug, isPrivate: isPrivateChain(c) };
      const s = stats.get(subnetId);
      return { name: s?.name || `Subnet ${subnetId.slice(0, 8)}…`, logo: hasRealChainLogo(s?.chainLogoURI) ? s?.chainLogoURI : undefined };
    };
  }, [subnets]);

  const base = useMemo(() => (feed ? buildL1Rows(feed.validators, infoOf, price) : null), [feed, infoOf, price]);
  const required = useMemo(() => requiredRelease(releases), [releases]);
  const latest = releases?.[0] ?? null;
  const target = targetPick ?? (base ? defaultTarget(base, releases) : null);
  // no target only when no node reports a version and GitHub is unreachable: the roster still lists
  const rows = useMemo<L1StatusRow[] | null>(() => (base ? withStatus(base, target ?? "0.0.0") : null), [base, target]);
  const targets = useMemo(() => (base ? targetOptions(base, releases, target) : []), [base, releases, target]);
  const shares = useMemo(() => (rows && target ? releaseShares(rows, target) : []), [rows, target]);
  const summaries = useMemo(() => (rows ? summarizeL1s(rows) : []), [rows]);

  /* ---------------------------------------------------------------- */
  /* the roster's filter                                              */
  /* ---------------------------------------------------------------- */

  const facets = useMemo(() => l1FacetsFor(rows ?? []), [rows]);
  const q = useMemo(() => parseQuery(query), [query]);
  const found = useMemo(() => l1Finder(q), [q]);
  const filtering = isFiltering(selection, q);
  const filtered = useMemo(() => (rows ? sortL1Rows(filterRows(rows, facets, selection, found), sort) : []), [rows, facets, selection, found, sort]);
  const counts = useMemo(() => (rows ? optionCounts(rows, facets, selection, found) : null), [rows, facets, selection, found]);
  const visible = useMemo(() => (filtering ? new Set(filtered.map((r) => r.validationId)) : null), [filtering, filtered]);
  const missing = useMemo(() => (rows ? missingIds(rows, q) : []), [rows, q]);
  // a preset counts inside the search, so a pasted list reads its own triage
  const presetCounts = useMemo(
    () => Object.fromEntries(L1_PRESETS.map((p) => [p.id, rows ? filterRows(rows, facets, p.selection, found).length : 0])),
    [rows, facets, found],
  );
  const activeFacets = Object.values(selection).filter((v) => v?.length).length;
  const canLink = linkable(query);
  const nodeIds = useMemo(() => [...new Set(filtered.map((r) => r.nodeId))], [filtered]);

  /* how long a balance lasts needs the fee price: until the feed brings
     one, those counts read as waiting, not as zero */
  const pending: Pending<L1FacetKey> | null =
    price !== null
      ? null
      : feed
        ? { keys: PRICE_FACETS, label: "n/a", title: "The P-Chain did not answer with the fee price, so the days a balance lasts cannot filter" }
        : { keys: PRICE_FACETS, label: "…", title: "Waiting for the fee price" };

  /* The filter rides in the URL, so a triage view can be shared as a link.
     The write waits for typing to pause: Safari refuses more than 100
     history updates in 10 seconds, and Next adds one of its own to each. */
  const viewUrl = () => {
    const url = new URL(window.location.href);
    const next = writeL1State(url.searchParams, { target: targetPick, q: query, selection, sort }).toString();
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
  const onToggle = (key: L1FacetKey, id: string) => {
    setSelection((s) => toggleOption(s, key, id));
    setShown(PAGE);
  };
  /** a figure above the roster cuts it to one facet's options, and brings it into view */
  const onCut = (key: L1FacetKey, ids: string[]) => {
    const next = cutTo(selection, key, ids);
    setSelection(next);
    setShown(PAGE);
    if (next[key]) reveal();
  };
  const onPreset = (p: Preset<L1FacetKey>) => {
    setSelection(presetActive(p, selection) ? {} : p.selection);
    setShown(PAGE);
  };
  const clearFacet = (key: L1FacetKey) => {
    setSelection((s) => ({ ...s, [key]: undefined }));
    setShown(PAGE);
  };
  const clearAll = () => {
    setSelection({});
    setQuery("");
    setShown(PAGE);
  };
  const toggleSort = (key: L1SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: -1 }));
    setShown(PAGE);
  };
  const cutIs = (key: L1FacetKey, ids: string[]) => {
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
    const href = URL.createObjectURL(new Blob([toL1Csv(filtered, target)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = `avalanche-l1-validators-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  };

  /* the swatches tie the rail's options to the colors on the board */
  const paintOf = useMemo(() => new Map(shares.map((s) => [s.version, s.paint])), [shares]);
  const swatch = (key: L1FacetKey, id: string): CSSProperties | undefined => {
    if (key === "version") return { background: paintOf.get(id) ?? UNKNOWN };
    if (key === "status") return { background: id === "current" ? "#16a34a" : id === "behind" ? BEHIND_SWATCH : UNKNOWN };
    return undefined;
  };

  const SortHeader = ({ label, k }: { label: string; k: L1SortKey }) => {
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

  const behindL1s = useMemo(() => summaries.filter((s) => s.behind > 0).length, [summaries]);
  const total = useMemo(() => summarizeL1Rows(rows ?? []), [rows]);
  const sum = useMemo(() => summarizeL1Rows(filtered), [filtered]);
  // the whole set's daily burn at the current fee
  const burn = price !== null && rows ? (price * 86_400 * rows.length) / NANO : null;
  const ending = useMemo(() => {
    if (price === null || !rows) return null;
    const days = rows.map((r) => r.daysLeft).filter((d): d is number => d !== null);
    return { within30: days.filter((d) => d < 30).length, within7: days.filter((d) => d < 7).length };
  }, [rows, price]);

  /* the first slab's strip: the last 60 days of L1 seats */
  const seatSpark = useMemo(() => toSeries(seats?.l1).slice(-60).map((p) => p.value), [seats]);
  const seatDelta = seatSpark.length > 30 ? seatSpark[seatSpark.length - 1] - seatSpark[seatSpark.length - 31] : null;

  // the health charts draw their buckets over the whole set, whatever the cut
  const [runwayBuckets, seenBuckets] = useMemo(() => {
    const all = rows ?? [];
    const bucket = (options: FacetOption<L1StatusRow>[], pool: L1StatusRow[]) =>
      pool.length ? options.map((o) => ({ id: o.id, label: o.label, count: pool.filter(o.test).length })) : [];
    return [bucket(RUNWAY_OPTIONS, all.filter((r) => r.daysLeft !== null)), bucket(SEEN_OPTIONS, all)];
  }, [rows]);
  const single = (key: L1FacetKey) => (selection[key]?.length === 1 ? selection[key]?.[0] : undefined);

  // a node can hold seats on several L1s: the link names the one this row is
  const rowHref = (r: L1StatusRow) => `/explorer/mainnet/p-chain/node/${encodeURIComponent(r.nodeId)}?subnet=${r.subnetId}`;

  return (
    <div className="flex flex-col gap-10">
      {/* the set at a glance: each figure a solid; the ones that can cut
          the roster do, and wear the selection blue while they do */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4 lg:gap-x-4">
          <StatSlab
            label="L1 Validators"
            value={rows ? rows.length : null}
            format={(n) => n.toLocaleString("en-US")}
            sub={seatDelta !== null ? `${seatDelta >= 0 ? "+" : ""}${Math.round(seatDelta)} in 30 days` : undefined}
            spark={seatSpark}
            active={false}
            onClick={filtering ? clearAll : undefined}
            title={filtering ? "Show every L1 validator" : undefined}
          />
          <StatSlab
            label="L1s"
            value={rows ? summaries.length : null}
            format={(n) => n.toLocaleString("en-US")}
            sub={rows ? behindL1s > 0 ? <span className="text-[#E6212F]">{behindL1s} with a validator behind</span> : "every L1 on target" : undefined}
            alert={behindL1s > 0 && cutIs("status", ["behind"])}
            active={cutIs("status", ["behind"])}
            onClick={behindL1s > 0 ? () => onCut("status", ["behind"]) : undefined}
            title={target ? `List the validators behind ${target}` : undefined}
          />
          <StatSlab
            label="Prepaid Balance"
            value={rows ? total.balance : null}
            format={fmtCompact}
            unit="AVAX"
            sub={burn !== null ? `burns ${burn.toFixed(1)} AVAX a day` : "pays the continuous fee"}
            href="/explorer/mainnet/p-chain/l1s"
            title="The L1 validator economy"
          />
          <StatSlab
            label="Runs Out · 30d"
            value={ending ? ending.within30 : null}
            format={(n) => n.toLocaleString("en-US")}
            alert={!!ending && ending.within7 > 0}
            sub={ending ? ending.within7 > 0 ? <span className="text-[#E6212F]">{ending.within7} inside a week</span> : "none inside a week" : undefined}
            active={cutIs("runway", ["lt7", "7-30"])}
            onClick={ending?.within30 ? () => onCut("runway", ["lt7", "7-30"]) : undefined}
            title="List the validators whose balance pays the fee for less than 30 more days. At zero a validator goes inactive."
          />
        </div>
      </section>

      {/* how far the L1s are from the target release */}
      <section>
        {rows && target ? (
          <L1Readiness
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
            rowHref={rowHref}
          />
        ) : (
          <Board divide={false} className="border">
            {failed ? (
              <EmptyRow>
                <span className="text-[#E6212F]">L1 validator feed unavailable</span>
              </EmptyRow>
            ) : rows ? (
              <EmptyRow>no L1 validator reports a version</EmptyRow>
            ) : (
              <RowSkeleton n={6} />
            )}
          </Board>
        )}
      </section>

      {/* the L1s one by one: a row cuts the roster to its L1 */}
      {rows && target && summaries.length > 0 && (
        <section>
          <L1Board summaries={summaries} paintOf={paintOf} target={target} picked={single("l1") ?? null} onPick={(id) => onCut("l1", [id])} />
        </section>
      )}

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
        <PresetRow presets={L1_PRESETS} counts={presetCounts} selection={selection} onPreset={onPreset} pending={pending} />

        <div className="grid items-start gap-6 xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-8">
          {/* the rail: every part of the filter, each option with the count it would leave */}
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 [scrollbar-width:thin] xl:block">
            <FacetRail facets={facets} counts={counts} selection={selection} onToggle={onToggle} onClearFacet={clearFacet} swatch={swatch} pending={pending} fold={RAIL_FOLD} />
          </aside>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <RosterSearch
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setShown(PAGE);
                }}
                placeholder="NodeID, L1, version, IP, or a list of NodeIDs"
              />
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
                  onClick={() => copy("ids", nodeIds.join("\n"))}
                  disabled={!nodeIds.length}
                  title="Copy the NodeIDs of every validator in this list, one per line"
                >
                  {copied === "ids" ? "Copied" : `Copy ${nodeIds.length.toLocaleString("en-US")} IDs`}
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
                  fold={RAIL_FOLD}
                />
              </div>
            )}

            <ActiveChips facets={facets} selection={selection} onClearFacet={clearFacet} onClearAll={clearAll} />

            {q.ids && rows && (
              <p className="font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {(q.ids.length - missing.length).toLocaleString("en-US")} of {q.ids.length.toLocaleString("en-US")} pasted NodeIDs validate an L1.
                {missing.length > 0 && (
                  <>
                    {" "}
                    <span className="text-[#E6212F]">
                      {missing.length.toLocaleString("en-US")} {missing.length === 1 ? "does" : "do"} not validate an L1 now.
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
                on <span className="text-zinc-900 dark:text-zinc-100">{sum.l1s.toLocaleString("en-US")}</span> L1{sum.l1s === 1 ? "" : "s"}
                {" · "}
                <span className="text-zinc-900 dark:text-zinc-100">{fmtBalance(sum.balance)}</span> AVAX prepaid
                {filtering && total.balance > 0 && ` · ${((sum.balance / total.balance) * 100).toFixed(1)}% of the balance`}
              </p>
            )}

            <Board divide={false}>
              {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
              <div className="overflow-x-auto">
                <div className="md:min-w-[60rem]">
                  <div className={cn(HEAD, GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
                    <span>#</span>
                    <span>Node</span>
                    <span>
                      <SortHeader label="L1" k="l1" />
                    </span>
                    <span>
                      <SortHeader label="Version" k="version" />
                    </span>
                    <span className="text-right" title="The validator's share of its L1's weight">
                      <SortHeader label="Share" k="share" />
                    </span>
                    <span className="text-right">
                      <SortHeader label="Balance" k="balance" />
                    </span>
                    <span className="whitespace-nowrap text-right" title="The days the balance pays at the current fee">
                      Days Left
                    </span>
                    <span className="whitespace-nowrap text-right" title="When the network crawler last completed a handshake with the node">
                      <SortHeader label="Handshake" k="seen" />
                    </span>
                  </div>
                  {!rows && !failed && <RowSkeleton n={12} />}
                  {rows &&
                    filtered.slice(0, shown).map((r, i) => (
                      <Link
                        key={r.validationId}
                        href={rowHref(r)}
                        title={r.ip ? `${r.nodeId} · ${r.ip}` : r.nodeId}
                        className={cn(ROW, "grid-cols-4 gap-x-3 md:gap-x-4", GRID, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}
                      >
                        <span className="hidden font-mono text-[12px] tabular-nums text-zinc-400 md:block dark:text-zinc-500">{i + 1}</span>
                        <span className={cn("col-span-4 flex min-w-0 font-mono text-[12px] md:col-span-1", idInk)}>
                          <span className="truncate">{r.nodeId.slice(0, -6)}</span>
                          <span className="shrink-0">{r.nodeId.slice(-6)}</span>
                        </span>
                        <span className="col-span-2 flex min-w-0 items-center gap-1.5 md:col-span-1">
                          {r.logo ? (
                            <img src={r.logo} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-contain" />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                          )}
                          <span className="truncate text-[12.5px] text-zinc-900 dark:text-zinc-100">{r.l1}</span>
                        </span>
                        <span className="min-w-0">
                          <CellLabel>Version</CellLabel>
                          <span className="flex items-center gap-1.5 font-mono text-[12px]">
                            <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: paintOf.get(r.version ?? NO_VERSION) ?? UNKNOWN }} />
                            <span className={cn("truncate", STATUS_INK[r.status])}>{r.version ?? "unknown"}</span>
                          </span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Share</CellLabel>
                          <span className="font-mono text-[12px] tabular-nums text-zinc-700 dark:text-zinc-300">{r.share >= 10 ? r.share.toFixed(0) : r.share.toFixed(1)}%</span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Balance</CellLabel>
                          <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">
                            {fmtBalance(r.balance)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                          </span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Days left</CellLabel>
                          <span className={cn("font-mono text-[12px] tabular-nums", r.daysLeft !== null && daysLeftTone(r.daysLeft))}>{r.daysLeft !== null ? Math.floor(r.daysLeft) : NA}</span>
                        </span>
                        <span className="md:text-right">
                          <CellLabel>Handshake</CellLabel>
                          <span className={cn("font-mono text-[12px] tabular-nums", r.seenDays !== null && seenTone(r.seenDays))}>{r.seenDays !== null ? seenText(r.seenDays) : NA}</span>
                        </span>
                      </Link>
                    ))}
                  {rows && filtered.length === 0 && (
                    <EmptyRow>
                      {filtering ? (
                        <>
                          no validators match.{" "}
                          <button type="button" onClick={clearAll} className="text-[#0061E2] hover:underline dark:text-[#5f9dff]">
                            Clear the filter
                          </button>
                        </>
                      ) : (
                        "no L1 validators found"
                      )}
                    </EmptyRow>
                  )}
                  {failed && !rows && (
                    <EmptyRow>
                      <span className="text-[#E6212F]">L1 validator feed unavailable</span>
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

      {/* how the set is holding up */}
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartBoard label="Balance Lasts · current fee">
          {runwayBuckets.length ? (
            <BucketBars
              data={runwayBuckets}
              picked={single("runway")}
              onPick={(id) => onCut("runway", [id])}
              tint={(b) => (b.id === "lt7" ? "#E6212F" : b.id === "7-30" ? AMBER_BAR : QUIET_BAR)}
            />
          ) : (
            <ChartEmpty failed={!!feed && price === null} />
          )}
        </ChartBoard>

        <ChartBoard label="Last Handshake · crawler">
          {seenBuckets.length ? (
            <BucketBars
              data={seenBuckets}
              picked={single("seen")}
              onPick={(id) => onCut("seen", [id])}
              tint={(b) => (b.id === "never" ? UNKNOWN : b.id === "7-30" || b.id === "30" ? AMBER_BAR : QUIET_BAR)}
            />
          ) : (
            <ChartEmpty failed={failed} />
          )}
        </ChartBoard>
      </div>
    </div>
  );
}
