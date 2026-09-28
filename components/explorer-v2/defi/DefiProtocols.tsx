"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { DefiSwitch } from "@/components/explorer-v2/network/defi-switch";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { Board, EmptyRow, SectionHeader } from "@/components/explorer-v2/ui";
import { LayerBlock, SharePanel, type BlockDay, type SharePart } from "@/components/explorer-v2/network/icm-parts";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { deltaOf, type DefiOverview, type DefiProtocol } from "@/lib/defi/llama";
import {
  PRESETS,
  applyFilter,
  cutTo,
  facetCounts,
  isFiltering,
  presetActive,
  readState,
  sortRows,
  toCsv,
  toggleOption,
  writeState,
  type FacetKey,
  type Preset,
  type Selection,
  type Sort,
  type SortKey,
} from "@/lib/defi/protocol-filters";
import { GROUPS, type GroupKey } from "@/lib/defi/taxonomy";
import { COUNTED_TONE, DEFI_SCOPE, DEFI_STYLE, groupTone, signedUsd, usd } from "./palette";
import { SPAN_LABEL, spanOf, useDefiOverview, useDefiYields } from "./data";
import { ProtocolMap } from "./ProtocolMap";
import { Movers } from "./Movers";
import { ProtocolFilters } from "./ProtocolFilters";
import { ProtocolTable } from "./ProtocolTable";
import { YieldBoard } from "./YieldBoard";

/* The C-Chain's DeFi tab. It leads with the figures, then shows where
   the money sits: the value in Avalanche protocols by category, and the
   same value split the way DefiLlama counts it, which is why its
   Avalanche TVL is a third of the gross sum. Then how it moved: capital
   over time, DEX volume and who takes it, a map of every protocol, and
   the biggest movers. The protocol table filters all of the map and the
   movers, and the whole view rides in the URL. Yields close the page.
   Every change reads over the page clock. */

const PAGE = 50;
const DAY = 86_400;

function dayOf(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

/** the sum of the last n daily points, and of the n before them */
function windowSums(chart: [number, number][], n: number): { now: number; before: number | null; spark: number[] } {
  const last = chart.slice(-n);
  const prev = chart.slice(-2 * n, -n);
  return {
    now: last.reduce((s, [, v]) => s + v, 0),
    before: prev.length === n ? prev.reduce((s, [, v]) => s + v, 0) : null,
    spark: chart.slice(-Math.max(n, 30)).map(([, v]) => v),
  };
}

const pctOf = (now: number, before: number | null) => (before && before > 0 ? ((now - before) / before) * 100 : null);

export function DefiProtocols() {
  return (
    <EvmShell network="mainnet">
      <div className="mb-8">
        <DefiSwitch on="apps" />
      </div>
      {/* the table's filter rides in the URL, so the view renders under a Suspense boundary */}
      <Suspense fallback={<DefiLoading />}>
        <DefiView />
      </Suspense>
    </EvmShell>
  );
}

function DefiView() {
  const params = useSearchParams();
  const [initial] = useState(() => {
    const p = new URLSearchParams(params.toString());
    return { ...readState(p), open: p.get("open") };
  });
  const [query, setQuery] = useState(initial.q);
  const [selection, setSelection] = useState<Selection>(initial.selection);
  const [sort, setSort] = useState<Sort>(initial.sort);
  const [openSlug, setOpenSlug] = useState<string | null>(initial.open);
  const [shown, setShown] = useState(PAGE);
  const [copied, setCopied] = useState(false);
  const mapRef = useRef<HTMLElement>(null);

  const range = useExplorerTimeRange();
  const span = spanOf(range);
  const days = Math.max(7, RANGE_DAYS[range]);
  const { data, failed, retry } = useDefiOverview();
  const { data: pools, failed: poolsFailed } = useDefiYields();
  const now = data?.asOf ?? Math.floor(Date.now() / 1000);

  /* ---------------------------------------------------------------- */
  /* the table's cut, which the map and the movers read too           */
  /* ---------------------------------------------------------------- */

  const all = data?.protocols ?? null;
  const filtering = isFiltering(selection, query);
  const cut = useMemo(() => (all ? applyFilter(all, selection, query, span, now) : null), [all, selection, query, span, now]);
  const sorted = useMemo(() => (cut ? sortRows(cut, sort, span) : null), [cut, sort, span]);
  const counts = useMemo(() => (all ? facetCounts(all, selection, query, span, now) : null), [all, selection, query, span, now]);
  const presetCounts = useMemo(
    () => Object.fromEntries(PRESETS.map((p) => [p.id, all ? applyFilter(all, p.selection, query, span, now).length : 0])),
    [all, query, span, now],
  );
  const open = useMemo(() => (openSlug && all ? all.find((p) => p.slug === openSlug)?.id ?? null : null), [openSlug, all]);

  // the view rides in the URL once typing pauses (Safari caps history updates at 100 per 10 s)
  const viewUrl = () => {
    const url = new URL(window.location.href);
    const next = writeState(url.searchParams, { q: query, selection, sort });
    if (openSlug) next.set("open", openSlug);
    else next.delete("open");
    const s = next.toString();
    return `${url.pathname}${s ? `?${s}` : ""}${url.hash}`;
  };
  useEffect(() => {
    const t = setTimeout(() => {
      const next = viewUrl();
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      try {
        window.history.replaceState(null, "", next);
      } catch {
        /* a browser that refuses the update keeps the old URL */
      }
    }, 300);
    return () => clearTimeout(t);
    // viewUrl reads the same four values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selection, sort, openSlug]);

  // a shared link that names a protocol opens its row once the list is in
  const scrolled = useRef(false);
  useEffect(() => {
    if (!open || scrolled.current || !sorted) return;
    scrolled.current = true;
    const i = sorted.findIndex((p) => p.id === open);
    if (i >= shown) setShown(i + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`defi-row-${open}`)?.scrollIntoView({ behavior: "smooth", block: "center" })));
  }, [open, sorted, shown]);

  const reveal = () => requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const onToggle = (key: FacetKey, id: string) => {
    setSelection((s) => toggleOption(s, key, id));
    setShown(PAGE);
  };
  const onCutGroup = (key: GroupKey) => {
    const next = cutTo(selection, "group", [key]);
    setSelection(next);
    setShown(PAGE);
    if (next.group) reveal();
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
  const onSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: key === "name" ? 1 : -1 }));
    setShown(PAGE);
  };
  /** open one protocol's row from anywhere on the page, clearing a cut that hides it */
  const openProtocol = (id: string | null) => {
    if (id === null) {
      setOpenSlug(null);
      return;
    }
    const p = all?.find((x) => x.id === id);
    if (!p) return;
    const inCut = cut?.some((x) => x.id === id);
    if (!inCut) {
      setSelection({});
      setQuery("");
    }
    setOpenSlug(p.slug);
    scrolled.current = false;
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(viewUrl(), window.location.origin).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the address bar holds the same link */
    }
  };
  const downloadCsv = () => {
    if (!sorted) return;
    const href = URL.createObjectURL(new Blob([toCsv(sorted, span)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = `avalanche-defi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  };

  if (failed && !data) {
    return (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <p className="max-w-md font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">DefiLlama data is unavailable</p>
        <button
          type="button"
          onClick={retry}
          className="border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data || !all || !sorted) return <DefiLoading />;

  const sum = sorted.reduce((s, p) => s + p.tvl, 0);
  const moved = sorted.reduce((s, p) => s + (deltaOf(p, span) ?? 0), 0);

  return (
    <div className={`${DEFI_SCOPE} flex flex-col gap-12`}>
      <style>{DEFI_STYLE}</style>
      <Figures data={data} days={days} range={range} />
      <MoneySits data={data} picked={selection.group?.length === 1 ? selection.group[0] : null} onPick={onCutGroup} />
      <History data={data} days={days} range={range} />
      <Volume data={data} days={days} range={range} span={span} onOpen={openProtocol} />

      <section ref={mapRef} className="grid scroll-mt-24 grid-cols-1 items-stretch gap-8 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <ProtocolMap rows={sorted} span={span} onOpen={openProtocol} />
        <Movers rows={sorted} span={span} onOpen={openProtocol} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Protocols"
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {filtering ? `${sorted.length} / ${all.length}` : `${all.length} protocols`}
            </span>
          }
        />
        <ProtocolFilters
          query={query}
          onQuery={(q) => {
            setQuery(q);
            setShown(PAGE);
          }}
          selection={selection}
          counts={counts}
          presetCounts={presetCounts}
          onToggle={onToggle}
          onPreset={onPreset}
          onClearFacet={clearFacet}
          onClearAll={clearAll}
          copied={copied}
          onCopyLink={copyLink}
          onCsv={downloadCsv}
          shown={sorted.length}
        />
        <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          <span className="text-zinc-900 dark:text-zinc-100">{sorted.length}</span> protocol{sorted.length === 1 ? "" : "s"} ·{" "}
          <span className="text-zinc-900 dark:text-zinc-100">{usd(sum)}</span> on Avalanche · {signedUsd(moved)} over {SPAN_LABEL[span]}
          {range === "quarter" || range === "year" || range === "all" ? " (the longest window DefiLlama keeps per protocol)" : ""}
        </p>
        <ProtocolTable
          rows={sorted}
          loading={false}
          span={span}
          sort={sort}
          onSort={onSort}
          open={open}
          onOpen={openProtocol}
          shown={shown}
          onMore={() => setShown((s) => s + PAGE)}
          now={now}
        />
      </section>

      <YieldBoard pools={pools} failed={poolsFailed} protocols={all} />

      <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        TVL, volume, fees and yields from DefiLlama, refreshed every 15 to 30 minutes. Exchanges hold reserves on Avalanche too; DefiLlama tracks them apart, and they
        are not DeFi.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the figures                                                         */
/* ------------------------------------------------------------------ */

function Figures({ data, days, range }: { data: DefiOverview; days: number; range: ReturnType<typeof useExplorerTimeRange> }) {
  const h = data.history;
  const at = (n: number) => h[Math.max(0, h.length - 1 - n)];
  const last = h[h.length - 1];
  const tvlDelta = last && at(RANGE_DAYS[range]) ? pctOf(last.counted, at(RANGE_DAYS[range]).counted) : null;
  const borrowedNow = last?.borrowed ?? data.layers.borrowed;
  const borrowedThen = at(RANGE_DAYS[range])?.borrowed ?? null;
  const lendingTvl = data.protocols.filter((p) => p.borrowed !== null).reduce((s, p) => s + p.tvl + (p.borrowed ?? 0), 0);
  const n = range === "day" ? 1 : RANGE_DAYS[range];
  const vol = data.dex ? windowSums(data.dex.chart, n) : null;
  const fee = data.fees ? windowSums(data.fees.chart, n) : null;
  const spark = h.slice(-Math.max(days, 30)).map((p) => p.counted);
  return (
    <ReadoutRow cols={4}>
      <Readout label="DeFi TVL" value={usd(data.layers.counted)} sub={rangeWindowLabel(range)} delta={tvlDelta} spark={spark} />
      <Readout label="DEX Volume" value={vol ? usd(vol.now) : "n/a"} sub={rangeWindowLabel(range)} delta={vol ? pctOf(vol.now, vol.before) : null} spark={vol?.spark} />
      <Readout label="Fees" value={fee ? usd(fee.now) : "n/a"} sub={rangeWindowLabel(range)} delta={fee ? pctOf(fee.now, fee.before) : null} spark={fee?.spark} />
      <Readout
        label="Borrowed"
        value={usd(borrowedNow)}
        sub={lendingTvl > 0 ? `${((data.layers.borrowed / lendingTvl) * 100).toFixed(0)}% of supply` : "against deposits"}
        delta={borrowedThen ? pctOf(borrowedNow, borrowedThen) : null}
        spark={h.slice(-Math.max(days, 30)).map((p) => p.borrowed ?? 0)}
      />
    </ReadoutRow>
  );
}

/* ------------------------------------------------------------------ */
/* where the money sits                                                */
/* ------------------------------------------------------------------ */

function Lead({ label, note }: { label: string; note: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{label}</span>
      <span className="truncate font-mono text-[10px] font-normal text-zinc-400 dark:text-zinc-500">{note}</span>
    </span>
  );
}

function MoneySits({ data, picked, onPick }: { data: DefiOverview; picked: string | null; onPick: (g: GroupKey) => void }) {
  const L = data.layers;
  const byGroup = useMemo(() => {
    const m = new Map<GroupKey, { tvl: number; n: number }>();
    for (const p of data.protocols) {
      if (p.group === "cex") continue;
      const c = m.get(p.group) ?? { tvl: 0, n: 0 };
      m.set(p.group, { tvl: c.tvl + p.tvl, n: c.n + 1 });
    }
    return GROUPS.filter((g) => m.has(g.key)).map((g) => ({ g, ...m.get(g.key)! }));
  }, [data.protocols]);

  const categories: SharePart[] = byGroup
    .sort((a, b) => b.tvl - a.tvl)
    .map(({ g, tvl, n }) => ({ key: g.key, label: g.label, value: tvl, tone: groupTone(g.key), lead: <Lead label={g.label} note={`${n} protocol${n === 1 ? "" : "s"} · ${g.blurb}`} /> }));

  const layers: (SharePart & { group?: GroupKey })[] = ([
    { key: "counted", label: "DeFi TVL", value: L.counted, tone: COUNTED_TONE, lead: <Lead label="DeFi TVL" note="Counted once. This is DefiLlama's Avalanche TVL." /> },
    { key: "vaults", group: "vaults", label: "Redeposits", value: L.doubleCounted, tone: groupTone("vaults"), lead: <Lead label="Redeposits" note="Vaults and yield strategies deposit into other protocols, so a plain sum counts it twice." /> },
    { key: "lst", group: "lst", label: "Liquid staking", value: L.liquidStaking, tone: groupTone("lst"), lead: <Lead label="Liquid staking" note="Staked AVAX that stays liquid. DefiLlama shows it apart." /> },
    { key: "rwa", group: "rwa", label: "Real-world assets", value: L.rwa, tone: groupTone("rwa"), lead: <Lead label="Real-world assets" note="Tokenized funds and credit. DefiLlama tracks them apart." /> },
    { key: "bridge", group: "bridge", label: "Bridges", value: L.bridges, tone: groupTone("bridge"), lead: <Lead label="Bridges" note="Assets locked for use on other chains." /> },
  ] satisfies (SharePart & { group?: GroupKey })[]).filter((p) => p.value > 0);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Where the Money Sits"
        action={
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {usd(L.gross)} in {data.protocols.filter((p) => p.group !== "cex").length} protocols
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SharePanel label="By Category" parts={categories} total={L.gross} fmt={usd} picked={picked} onPick={(k) => onPick(k as GroupKey)} />
        <SharePanel
          label="As DefiLlama Counts It"
          parts={layers}
          total={L.gross}
          fmt={usd}
          picked={picked ? layers.find((l) => l.group === picked)?.key ?? null : null}
          onPick={(k) => {
            const g = layers.find((l) => l.key === k)?.group;
            if (g) onPick(g);
          }}
        />
      </div>
      <p className="font-mono text-[10.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {usd(L.counted)} of the {usd(L.gross)} counts as DeFi TVL. The rest is staked AVAX, capital that vaults redeposit, tokenized real-world assets, and bridged
        assets. A click on a category or a layer cuts the map and the table to it.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* capital over time                                                   */
/* ------------------------------------------------------------------ */

function History({ data, days, range }: { data: DefiOverview; days: number; range: ReturnType<typeof useExplorerTimeRange> }) {
  const series: BlockDay[] = useMemo(
    () =>
      data.history.slice(-days).map((p) => ({
        date: dayOf(p.t),
        v: { counted: p.counted, lst: p.liquidStaking, vaults: p.doubleCounted },
      })),
    [data.history, days],
  );
  if (!series.length) {
    return (
      <Board divide={false} className="border">
        <EmptyRow>No TVL history</EmptyRow>
      </Board>
    );
  }
  return (
    <LayerBlock
      label="Capital on Avalanche"
      note={RANGE_DAYS[range] < 7 ? "7 days" : rangeWindowLabel(range)}
      days={series}
      layers={[
        { key: "counted", label: "DeFi TVL", tone: COUNTED_TONE, what: "Counted once, as DefiLlama counts it" },
        { key: "lst", label: "Liquid staking", tone: groupTone("lst"), what: "Staked AVAX that stays liquid" },
        { key: "vaults", label: "Redeposits", tone: groupTone("vaults"), what: "Capital vaults and yield strategies deposit into other protocols" },
      ]}
      fmt={usd}
      headline="last"
    />
  );
}

/* ------------------------------------------------------------------ */
/* DEX volume and who takes it                                         */
/* ------------------------------------------------------------------ */

function Volume({
  data,
  days,
  range,
  span,
  onOpen,
}: {
  data: DefiOverview;
  days: number;
  range: ReturnType<typeof useExplorerTimeRange>;
  span: ReturnType<typeof spanOf>;
  onOpen: (id: string) => void;
}) {
  const series: BlockDay[] = useMemo(
    () => (data.dex?.chart ?? []).slice(-days).map(([t, v]) => ({ date: dayOf(t), v: { dex: v } })),
    [data.dex, days],
  );
  const feeSeries: BlockDay[] = useMemo(
    () => (data.fees?.chart ?? []).slice(-days).map(([t, v]) => ({ date: dayOf(t), v: { fees: v } })),
    [data.fees, days],
  );
  const volumeOf = (p: DefiProtocol) => (span === "1d" ? p.volume24h : span === "7d" ? p.volume7d : p.volume30d) ?? 0;
  const dexes = useMemo(() => data.protocols.filter((p) => volumeOf(p) > 0).sort((a, b) => volumeOf(b) - volumeOf(a)), [data.protocols, span]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = dexes.reduce((s, p) => s + volumeOf(p), 0);
  const top = dexes.slice(0, 8);
  const rest = total - top.reduce((s, p) => s + volumeOf(p), 0);
  const parts: SharePart[] = [
    ...top.map((p) => ({ key: p.id, label: p.name, value: volumeOf(p) })),
    ...(rest > 0 ? [{ key: "rest", label: `${dexes.length - top.length} more`, value: rest }] : []),
  ];
  return (
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-8">
        {series.length ? (
          <LayerBlock
            label="DEX Volume"
            note={RANGE_DAYS[range] < 7 ? "7 days" : rangeWindowLabel(range)}
            days={series}
            layers={[{ key: "dex", label: "Spot DEX volume", tone: groupTone("dex") }]}
            fmt={usd}
            headline="sum"
          />
        ) : (
          <Board divide={false} className="border">
            <EmptyRow>No volume history</EmptyRow>
          </Board>
        )}
        {feeSeries.length > 0 && (
          <LayerBlock
            label="Fees"
            note={RANGE_DAYS[range] < 7 ? "7 days" : rangeWindowLabel(range)}
            days={feeSeries}
            layers={[{ key: "fees", label: "Fees paid by users", tone: groupTone("yield") }]}
            fmt={usd}
            headline="sum"
          />
        )}
      </div>
      <SharePanel
        label={`DEX Share · ${span}`}
        parts={parts}
        total={total}
        fmt={usd}
        onPick={(k) => k !== "rest" && onOpen(k)}
        empty="No DEX volume"
      />
    </section>
  );
}

function DefiLoading() {
  return (
    <div className="flex flex-col gap-12" role="status" aria-label="Loading DeFi">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="h-96 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-96 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

