"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Board, HEAD, INK, MUTED, ROW, SectionHeader, TypeFilterRail } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { StackBlock, type StackCol, type StackLayer } from "@/components/explorer-v2/gas/instruments";
import { fadeUpStyle, riseStyle, useReveal, EASE_CSS } from "@/components/explorer-v2/motion";
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
   ETFs. The figures lead; then each holder stands as a tower on one
   plate, as tall as the AVAX it holds, one course per million; the
   monthly holdings follow as stacked columns, and the holders' ledger
   closes. A tower and its row light together. Static fields ship in
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
  logo: { src: string; srcDark?: string; tone?: "light" | "dark" | "color" };
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

/* front, top, side */
const HOLD_LAYERS: StackLayer[] = [
  { key: "dat", label: "Treasuries", faces: ["fill-zinc-600 dark:fill-zinc-300", "fill-zinc-400 dark:fill-zinc-100", "fill-zinc-800 dark:fill-zinc-500"], swatch: "bg-zinc-600 dark:bg-zinc-300" },
  { key: "etf", label: "ETFs", faces: ["fill-[#A2AFB2] dark:fill-[#6E7B7E]", "fill-[#DCE1E2] dark:fill-[#8C999C]", "fill-[#7E8C8F] dark:fill-[#556164]"], swatch: "bg-[#A2AFB2] dark:bg-[#6E7B7E]" },
];

/* ------------------------------------------------------------------ */
/* the plate: each holder a tower, one course per million AVAX          */

const PW = 1200;
const PH = 430;
const PG = 356;
const THW = 46;
const TILT = 0.42;
const TD = THW * TILT;
const T_MAX = 212;
const COURSE = 1_000_000;
/* top, left, right: full static class strings so Tailwind keeps them */
const TOWER: Record<Kind | "lit", [string, string, string]> = {
  dat: ["fill-zinc-500 dark:fill-zinc-200", "fill-zinc-700 dark:fill-zinc-300", "fill-zinc-800 dark:fill-zinc-400"],
  etf: ["fill-[#DCE1E2] dark:fill-[#8C999C]", "fill-[#A2AFB2] dark:fill-[#6E7B7E]", "fill-[#7E8C8F] dark:fill-[#556164]"],
  lit: ["fill-[#7FB0FF]", "fill-[#0061E2]", "fill-[#0049AB]"],
};

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/* every holder's logo is a wordmark: it is the flag's title, held to one height */
function Logo({ x, y, logo }: { x: number; y: number; logo: Holder["logo"] }) {
  const common = { x, y, width: 132, height: 20, preserveAspectRatio: "xMinYMid meet" };
  if (logo.srcDark)
    return (
      <>
        <image href={logo.src} {...common} className="dark:hidden" />
        <image href={logo.srcDark} {...common} className="hidden dark:inline" />
      </>
    );
  // a white logo inverts on paper, a black one on the dark sheet
  const cls = logo.tone === "light" ? "invert dark:invert-0" : logo.tone === "dark" ? "dark:invert" : undefined;
  return <image href={logo.src} {...common} className={cls} />;
}

function VaultPlate({ holders, hover, onHover }: { holders: Holder[]; hover: string | null; onHover: (id: string | null) => void }) {
  const [ref, shown] = useReveal<HTMLDivElement>();
  const max = Math.max(1, ...holders.map((h) => h.avax));
  const k = T_MAX / max;
  const step = holders.length > 1 ? Math.min(186, (PW - 250) / (holders.length - 1)) : 0;
  const x0 = 100;
  const xs = holders.map((_, i) => x0 + i * step);
  const xl = xs[0] ?? x0;
  const xr = xs[xs.length - 1] ?? x0;
  const R = THW + 34;
  const dR = R * TILT;

  return (
    <div ref={ref}>
      <Board divide={false} className="border">
        <svg viewBox={`0 0 ${PW} ${PH}`} className="block h-auto w-full" role="img" aria-label="AVAX held by each treasury and ETF, as towers to scale" onMouseLeave={() => onHover(null)}>
          {/* the plate: one long slab under every holder */}
          <g strokeWidth={1}>
            <polygon points={pts([[xl - R, PG], [xl, PG + dR], [xr, PG + dR], [xr + R, PG], [xr, PG - dR], [xl, PG - dR]])} className="fill-zinc-50 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700" />
            <polygon points={pts([[xl - R, PG], [xl, PG + dR], [xl, PG + dR + 12], [xl - R, PG + 12]])} className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-700" />
            <polygon points={pts([[xl, PG + dR], [xr, PG + dR], [xr, PG + dR + 12], [xl, PG + dR + 12]])} className="fill-zinc-200 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-700" />
            <polygon points={pts([[xr, PG + dR], [xr + R, PG], [xr + R, PG + 12], [xr, PG + dR + 12]])} className="fill-zinc-300 stroke-zinc-300 dark:fill-zinc-700 dark:stroke-zinc-700" />
          </g>

          {holders.map((h, i) => {
            const x = xs[i];
            const hi = Math.max(3, h.avax * k);
            const faces = hover === h.id ? TOWER.lit : TOWER[h.kind];
            const courses = Math.floor(h.avax / COURSE);
            const top = PG - hi;
            const fy = top - TD - 24;
            const dimmed = hover !== null && hover !== h.id;
            return (
              <g
                key={h.id}
                onMouseEnter={() => onHover(h.id)}
                onClick={() => h.url && window.open(h.url, "_blank", "noopener,noreferrer")}
                className={cn(h.url && "cursor-pointer")}
                style={{ opacity: dimmed ? 0.35 : 1, transform: hover === h.id ? "translateY(-6px)" : "translateY(0)", transition: `opacity 200ms, transform 300ms ${EASE_CSS}` }}
              >
                {/* the tower rises from the plate, one after another */}
                <g style={riseStyle(shown, i * 130, 820)} strokeLinejoin="round" strokeWidth={0.75} className="stroke-black/20 dark:stroke-black/40">
                  <polygon points={pts([[x - THW, PG], [x, PG + TD], [x, PG + TD - hi], [x - THW, PG - hi]])} className={faces[1]} />
                  <polygon points={pts([[x, PG + TD], [x + THW, PG], [x + THW, PG - hi], [x, PG + TD - hi]])} className={faces[2]} />
                  {courses > 1 && (
                    <path
                      d={Array.from({ length: courses }, (_, c) => {
                        const o = (c + 1) * COURSE * k;
                        return o >= hi - 0.5 ? "" : `M${x - THW},${(PG - o).toFixed(1)} L${x},${(PG + TD - o).toFixed(1)} L${x + THW},${(PG - o).toFixed(1)}`;
                      }).join(" ")}
                      fill="none"
                      className="stroke-black/15 dark:stroke-black/30"
                    />
                  )}
                  <polygon points={pts([[x, top - TD], [x + THW, top], [x, top + TD], [x - THW, top]])} className={faces[0]} />
                </g>
                {/* the flag: logo, name, the AVAX held, and what kind of holder */}
                <g style={fadeUpStyle(shown, i * 130 + 620)}>
                  <line x1={x} x2={x} y1={top - TD} y2={fy - 42} strokeWidth={1} className="stroke-zinc-300 dark:stroke-zinc-600" />
                  <title>{h.name}</title>
                  <Logo x={x + 8} y={fy - 50} logo={h.logo} />
                  <text x={x + 8} y={fy - 17} dominantBaseline="central" className="fill-zinc-900 font-mono text-[17px] tabular-nums dark:fill-zinc-50">
                    {fmtCompact(h.avax)}
                    <tspan className="fill-zinc-400 text-[10px] dark:fill-zinc-500"> AVAX</tspan>
                  </text>
                  <text x={x + 8} y={fy} dominantBaseline="central" className="fill-zinc-400 font-mono text-[10px] uppercase tracking-[0.1em] dark:fill-zinc-500">
                    {h.ticker} · {h.kind === "dat" ? "Treasury" : h.aum ? `ETF · $${fmtCompact(h.aum)}` : "ETF"}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-zinc-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-zinc-700 dark:bg-zinc-300" />
            Treasury
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#A2AFB2]" />
            ETF
          </span>
          <span>heights to scale · one course per 1M AVAX</span>
        </div>
      </Board>
    </div>
  );
}

const COLS = "md:grid-cols-[minmax(0,1fr)_6rem_minmax(0,10rem)_minmax(0,11rem)_6rem_minmax(0,8rem)_6rem]";

export function HoldersSection({ circulating }: { circulating: number }) {
  const { dats, etfs } = useDatEtf();
  const [kind, setKind] = useState<Kind | "">("");
  const [hover, setHover] = useState<string | null>(null);

  const totalDat = dats.reduce((s, d) => s + (d.avaxHoldings || 0), 0);
  const totalEtf = etfs.reduce((s, e) => s + (e.avaxHoldings || 0), 0);
  const etfAum = etfs.reduce((s, e) => s + (e.aum || 0), 0);
  const combined = totalDat + totalEtf;
  const months = useMemo(() => joinHistory(DAT_HISTORY, ETF_HISTORY, totalDat, totalEtf), [totalDat, totalEtf]);
  const cols = useMemo<StackCol[]>(() => months.map((m) => ({ key: m.date, long: m.date, tick: m.date.replace(/ 20(\d\d)$/, " '$1"), parts: { dat: m.dat, etf: m.etf } })), [months]);

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
          logo: { src: d.logoSrc, srcDark: d.logoSrcDark, tone: d.logoTone },
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
          logo: { src: e.logoSrc, srcDark: e.logoSrcDark, tone: e.logoTone },
        })),
      ].sort((a, b) => b.avax - a.avax),
    [dats, etfs],
  );
  const rows = kind ? holders.filter((h) => h.kind === kind) : holders;
  const last = months[months.length - 1];

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

      {/* desktops: every holder to scale; phones read the ledger */}
      <div className="hidden lg:block">
        <VaultPlate holders={holders} hover={hover} onHover={setHover} />
      </div>

      {cols.length > 1 && (
        <StackBlock
          label="AVAX Held · monthly"
          figure={fmtCompact(combined)}
          unit="AVAX"
          sub={`${months[0].date} to ${last.date}`}
          cols={cols}
          layers={HOLD_LAYERS}
          height={180}
          fmt={(v) => `${fmtCompact(v)} AVAX`}
          ticks={cols.map((_, i) => i)}
          tip={(c, i) => {
            const m = months[i];
            return (
              <>
                <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">
                  {m.date} · {fmtCompact(m.dat + m.etf)} AVAX
                </p>
                <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">Treasuries {fmtCompact(m.dat)}</p>
                <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">ETFs {fmtCompact(m.etf)}</p>
                {m.notes.map((n) => (
                  <p key={n} className="mt-1 max-w-56 font-mono text-[10px] text-zinc-400">
                    {n}
                  </p>
                ))}
              </>
            );
          }}
        />
      )}

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
        <Board divide={false} onMouseLeave={() => setHover(null)}>
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
                const cls = cn(ROW, COLS, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900", hover === h.id && "bg-[#0061E2]/[0.05] dark:bg-[#5b9bff]/[0.08]");
                return h.url ? (
                  <a key={h.id} href={h.url} target="_blank" rel="noopener noreferrer" className={cls} onMouseEnter={() => setHover(h.id)}>
                    {inner}
                  </a>
                ) : (
                  <div key={h.id} className={cls} onMouseEnter={() => setHover(h.id)}>
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
