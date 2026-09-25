"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Board, ChartBoard, HEAD, INK, MUTED, ROW, SectionHeader, TypeFilterRail } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import {
  DATS as STATIC_DATS,
  ETFS as STATIC_ETFS,
  DAT_HISTORY,
  ETF_HISTORY,
  type DatEntry,
  type EtfEntry,
  type HistoryPoint,
} from "@/constants/dat-etf";

/* The institutions holding AVAX: Digital Asset Treasuries and U.S.-listed
   ETFs. The figures lead, the monthly holdings follow as columns, and
   the holders' ledger closes; a legend key in the chart or a chip over
   the ledger narrows it to one kind. Static fields ship in
   constants/dat-etf; /api/avax-dat-etf overlays the live ones. */

type Kind = "dat" | "etf";

interface Holder {
  id: string;
  kind: Kind;
  name: string;
  ticker: string;
  venue: string;
  avax: number;
  aum: number | null;
  fee: string | null;
  staking: string | null;
  url?: string;
}

function useDatEtf() {
  const [dats, setDats] = useState<DatEntry[]>(STATIC_DATS);
  const [etfs, setEtfs] = useState<EtfEntry[]>(STATIC_ETFS);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/avax-dat-etf")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { dats?: DatEntry[]; etfs?: EtfEntry[] } | null) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.dats)) setDats(data.dats);
        if (Array.isArray(data.etfs)) setEtfs(data.etfs);
      })
      // the static set still says something true
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return { dats, etfs };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Sep 2025" as a sortable month index */
const monthIndex = (d: string) => {
  const [m, y] = d.split(" ");
  return Number(y) * 12 + MONTHS.indexOf(m);
};

interface MonthCol {
  date: string;
  dat: number;
  etf: number;
  notes: string[];
}

/** both histories on one month axis; a series holds its last value
 *  after its record ends, and the live totals land on the last month */
function joinHistory(dat: HistoryPoint[], etf: HistoryPoint[], liveDat: number, liveEtf: number): MonthCol[] {
  const all = [...new Set([...dat, ...etf].map((p) => p.date))].sort((a, b) => monthIndex(a) - monthIndex(b));
  let d = 0;
  let e = 0;
  const cols = all.map((date) => {
    const dp = dat.find((p) => p.date === date);
    const ep = etf.find((p) => p.date === date);
    if (dp) d = dp.avax;
    if (ep) e = ep.avax;
    return { date, dat: d, etf: e, notes: [dp?.label, ep?.label].filter((n): n is string => !!n) };
  });
  if (cols.length) {
    cols[cols.length - 1].dat = liveDat;
    cols[cols.length - 1].etf = liveEtf;
  }
  return cols;
}

const KINDS: { key: Kind; label: string; tone: string }[] = [
  { key: "dat", label: "Treasuries", tone: "bg-[#A2AFB2]" },
  { key: "etf", label: "ETFs", tone: "bg-[#A2AFB2]/40" },
];

const HOLD_PX = 200;

function HoldingsChart({ cols, kind, onKind }: { cols: MonthCol[]; kind: Kind | ""; onKind: (k: Kind | "") => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<Kind | null>(null);
  const lit = focus ?? (kind || null);
  const max = Math.max(1, ...cols.map((c) => c.dat + c.etf)) * 1.08;
  const hc = hover !== null ? cols[hover] : null;
  return (
    <ChartBoard
      label="AVAX Held · Monthly"
      action={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em]" onMouseLeave={() => setFocus(null)}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onMouseEnter={() => setFocus(k.key)}
              onClick={() => onKind(kind === k.key ? "" : k.key)}
              className={cn("flex items-center gap-1.5 transition-opacity", lit && lit !== k.key ? "opacity-40" : "opacity-100")}
            >
              <span className={cn("h-2 w-2", k.tone)} />
              <span className={kind === k.key ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}>{k.label}</span>
            </button>
          ))}
        </span>
      }
    >
      <div className="relative" style={{ height: HOLD_PX }} onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
          {cols.map((c, i) => (
            <div
              key={c.date}
              onMouseEnter={() => setHover(i)}
              className={cn("flex h-full min-w-0 flex-1 flex-col-reverse transition-opacity duration-150", hover !== null && hover !== i && "opacity-35")}
            >
              {KINDS.map((k, ki) => (
                <span
                  key={k.key}
                  className={cn(
                    "w-full shrink-0 transition-opacity",
                    k.tone,
                    ki === KINDS.length - 1 && c.dat + c.etf > 0 && "border-t border-zinc-700/70 dark:border-zinc-300/70",
                    lit && lit !== k.key && "opacity-15",
                  )}
                  style={{ height: (c[k.key] / max) * HOLD_PX }}
                />
              ))}
            </div>
          ))}
        </div>
        {hc && (
          <span
            className="pointer-events-none absolute top-0 z-20"
            style={hover! > (cols.length - 1) / 2 ? { right: `calc(${100 - (hover! / cols.length) * 100}% + 8px)` } : { left: `calc(${((hover! + 1) / cols.length) * 100}% + 8px)` }}
          >
            <TipPlate>
              <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">
                {hc.date} · {fmtCompact(hc.dat + hc.etf)} AVAX
              </p>
              {KINDS.map((k) => (
                <p key={k.key} className="flex items-center justify-between gap-4 whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5", k.tone)} />
                    {k.label}
                  </span>
                  <span>{fmtCompact(hc[k.key])}</span>
                </p>
              ))}
              {hc.notes.map((n) => (
                <p key={n} className="mt-1 max-w-56 font-mono text-[10px] text-zinc-400">
                  {n}
                </p>
              ))}
            </TipPlate>
          </span>
        )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        <span>{cols[0]?.date}</span>
        <span>{cols[cols.length - 1]?.date}</span>
      </div>
    </ChartBoard>
  );
}

const COLS = "md:grid-cols-[minmax(0,1fr)_6rem_minmax(0,10rem)_minmax(0,11rem)_6rem_minmax(0,8rem)_6rem]";

export function HoldersSection({ circulating }: { circulating: number }) {
  const { dats, etfs } = useDatEtf();
  const [kind, setKind] = useState<Kind | "">("");

  const totalDat = dats.reduce((s, d) => s + (d.avaxHoldings || 0), 0);
  const totalEtf = etfs.reduce((s, e) => s + (e.avaxHoldings || 0), 0);
  const etfAum = etfs.reduce((s, e) => s + (e.aum || 0), 0);
  const combined = totalDat + totalEtf;
  const cols = useMemo(() => joinHistory(DAT_HISTORY, ETF_HISTORY, totalDat, totalEtf), [totalDat, totalEtf]);

  const holders: Holder[] = useMemo(
    () =>
      [
        ...dats.map<Holder>((d) => ({
          id: d.id,
          kind: "dat",
          name: d.name,
          ticker: d.ticker,
          venue: d.exchange,
          avax: d.avaxHoldings || 0,
          aum: d.aum ?? null,
          fee: null,
          staking: null,
          url: d.webUrl ?? d.xUrl,
        })),
        ...etfs.map<Holder>((e) => ({
          id: e.id,
          kind: "etf",
          name: e.name,
          ticker: e.ticker,
          venue: e.sponsor,
          avax: e.avaxHoldings || 0,
          aum: e.aum || null,
          fee: e.sponsorFee === 0 && e.sponsorFeeAfterWaiver ? `0% then ${e.sponsorFeeAfterWaiver.toFixed(2)}%` : `${e.sponsorFee.toFixed(2)}%`,
          staking: e.stakingMax && e.stakingMax > 0 ? `up to ${e.stakingMax}%` : null,
          url: e.buyUrl,
        })),
      ].sort((a, b) => b.avax - a.avax),
    [dats, etfs],
  );
  const rows = kind ? holders.filter((h) => h.kind === kind) : holders;

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader label="Treasuries & ETFs" />
      <ReadoutRow cols={4}>
        <Readout label="Treasury Holdings" value={fmtCompact(totalDat)} unit="AVAX" sub={`${dats.length} treasuries`} />
        <Readout label="ETF Holdings" value={fmtCompact(totalEtf)} unit="AVAX" sub={`${etfs.length} funds`} />
        <Readout
          label="Combined"
          value={fmtCompact(combined)}
          unit="AVAX"
          sub={circulating > 0 ? `${((combined / circulating) * 100).toFixed(1)}% of circulating` : undefined}
        />
        <Readout label="ETF AUM" value={`$${fmtCompact(etfAum)}`} sub="U.S.-listed" />
      </ReadoutRow>

      <HoldingsChart cols={cols} kind={kind} onKind={setKind} />

      <div className="flex flex-col gap-4">
        <TypeFilterRail
          options={[
            { value: "", label: `All · ${holders.length}` },
            { value: "dat", label: `Treasuries · ${dats.length}` },
            { value: "etf", label: `ETFs · ${etfs.length}` },
          ]}
          value={kind}
          onChange={(v) => setKind(v as Kind | "")}
        />
        <Board divide={false}>
          <div className="overflow-x-auto">
            <div className="md:min-w-[52rem] xl:min-w-0">
              <div className={cn(HEAD, COLS, "border-b border-zinc-200 dark:border-zinc-800")}>
                <span>Holder</span>
                <span>Kind</span>
                <span>Venue</span>
                <span className="text-right">AVAX Held</span>
                <span className="text-right">AUM</span>
                <span className="text-right">Sponsor Fee</span>
                <span className="text-right">Staking</span>
              </div>
              {rows.map((h) => {
                const inner = (
                  <>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className={cn(INK, "truncate font-medium")}>{h.name}</span>
                      <span className={cn(MUTED, "shrink-0")}>{h.ticker}</span>
                    </span>
                    <span className={cn(INK, "text-right max-md:order-2 md:order-4")}>
                      {fmtCompact(h.avax)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">AVAX</span>
                    </span>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 max-md:order-3 md:order-2 dark:text-zinc-400">
                      {h.kind === "dat" ? "Treasury" : "ETF"}
                    </span>
                    <span className={cn(MUTED, "truncate max-md:order-4 max-md:text-right md:order-3")} title={h.venue}>
                      {h.venue}
                    </span>
                    <span className={cn(MUTED, "text-right max-md:hidden md:order-5")}>{h.aum ? `$${fmtCompact(h.aum)}` : "—"}</span>
                    <span className={cn(MUTED, "text-right max-md:hidden md:order-6")}>{h.fee ?? "—"}</span>
                    <span className={cn(MUTED, "text-right max-md:hidden md:order-7")}>{h.staking ?? "—"}</span>
                  </>
                );
                const cls = cn(ROW, COLS, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900");
                return h.url ? (
                  <a key={h.id} href={h.url} target="_blank" rel="noopener noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <div key={h.id} className={cls}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        </Board>
      </div>
    </section>
  );
}
