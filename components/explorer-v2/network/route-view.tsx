"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import type { RouteHistory, Side } from "@/app/api/icm-route/route";
import type { PchainNetwork } from "@/lib/pchain-explorer";

/* An ICM route's own view, in the panel's grammar (the chain and P-Chain
   views in chain-view.tsx): the two chains it joins, its messages each way
   over a window the reader picks, its share of all ICM in that window, its
   newest messages, and both chains' explorers. The counts come from the
   Teleporter logs of whichever end the index holds (/api/icm-route), each
   way labelled as sent or as delivered; the share from the city's own flows
   (/api/icm-flow, both sides), counted the same way. Both are kept a while,
   and each says how old it is. */

/** one end of the route, as the app knows it */
export interface RouteEnd {
  id: string;
  name: string;
  logo: string;
  /** its explorer, when the explorer indexes it */
  explorer: string | null;
}

type Days = "1" | "7" | "30";
const WINDOW: Record<Days, string> = { "1": "24H", "7": "7D", "30": "30D" };
/* the Query visual's axis type and its two first tones: ink, then the brand's blue */
const MONO = { fontSize: 10, fontFamily: "var(--font-geist-mono)" };
const BLUE = "#0061E2";

interface Flow {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}
interface Share {
  pair: number;
  total: number;
  /** when the flows were read, ms */
  at: number;
}

/* a figure's age, said plainly */
const asOf = (ms: number) => {
  const m = Math.floor((Date.now() - ms) / 60_000);
  return m < 1 ? "just read" : m < 60 ? `as of ${m} min ago` : `as of ${Math.floor(m / 60)} h ago`;
};

function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/* a chain's logo, with its initial when it has none */
function EndLogo({ end, size = 36 }: { end: RouteEnd; size?: number }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size };
  if (!end.logo || broken) {
    return (
      <span style={box} className="flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 font-mono text-[13px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        {end.name.charAt(0)}
      </span>
    );
  }
  return <img src={end.logo} alt="" style={box} onError={() => setBroken(true)} className="shrink-0 rounded-full bg-white object-contain ring-2 ring-white dark:ring-zinc-950" />;
}

/* the route's history and share for a window: each fetch lets go of the last one's answer. The share is the city's
   own, from its flows both ways: each direction counted once, when sent or when delivered, as the counts here are. Both
   reads stay on the route's network */
function useRouteData(a: string, b: string, days: Days, network: PchainNetwork) {
  const [history, setHistory] = useState<RouteHistory | "failed" | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const net = network === "fuji" ? "&network=fuji" : "";
  useEffect(() => {
    const controller = new AbortController();
    setHistory(null);
    fetch(`/api/icm-route?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&days=${days}${net}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: RouteHistory | { error: string }) => setHistory("error" in d ? "failed" : d))
      .catch((e: Error) => e.name !== "AbortError" && setHistory("failed"));
    return () => controller.abort();
  }, [a, b, days, net]);
  useEffect(() => {
    const controller = new AbortController();
    setShare(null);
    fetch(`/api/icm-flow?days=${days}&sides=both${net}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { flows?: Flow[]; last_updated?: number }) => {
        const flows = d.flows ?? [];
        const pair = flows.filter((f) => (f.sourceChainId === a && f.targetChainId === b) || (f.sourceChainId === b && f.targetChainId === a)).reduce((t, f) => t + f.messageCount, 0);
        const total = flows.reduce((t, f) => t + f.messageCount, 0);
        const at = d.last_updated ? (d.last_updated > 1e12 ? d.last_updated : d.last_updated * 1000) : Date.now();
        setShare({ pair, total, at });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [a, b, days, net]);
  return { history, share };
}

export function RouteView({ a, b, network, onBack, backLabel, onChain }: { a: RouteEnd; b: RouteEnd; network: PchainNetwork; onBack: () => void; backLabel: string; onChain: (id: string) => void }) {
  const [days, setDays] = useState<Days>("1");
  const { history, share } = useRouteData(a.id, b.id, days, network);
  // the figures' ages move on while the panel stays open
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const h = history && history !== "failed" ? history : null;
  const w = WINDOW[days];
  const both = h ? h.totals.ab + h.totals.ba : null;
  const pct = share && share.total > 0 ? (share.pair / share.total) * 100 : null;
  const last = h?.latest[0] ?? null;
  const figure = (label: ReactNode, value: ReactNode, sub?: ReactNode) => (
    <div className="flex min-w-0 flex-col gap-0.5 bg-white px-3 py-2.5 dark:bg-zinc-950">
      <dt className="truncate font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="truncate font-mono text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
      {sub && <dd className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{sub}</dd>}
    </div>
  );
  const way = (d: "ab" | "ba") => (!h ? "…" : h.ways[d] ? h.totals[d].toLocaleString("en-US") : "n/a");
  // which end's logs a way is counted in: its sender's, or its receiver's
  const countedAs = (side: Side | null) => (side === "sent" ? "counted when sent" : side === "delivered" ? "counted when delivered" : "neither end indexed");
  const name = (e: RouteEnd) => (
    <button type="button" onClick={() => onChain(e.id)} title={`Open ${e.name}`} className="min-w-0 truncate transition-colors hover:text-[#0061E2] dark:hover:text-[#5f9dff]">
      {e.name}
    </button>
  );
  // hours in the reader's time; days are UTC days, as the index counts them
  const fmtT = (t: number) => (h?.bucket === "hour" ? new Date(t).toLocaleTimeString("en-US", { hour: "numeric" }) : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }));
  // the window's first bucket holds only its tail, so the chart starts at the first whole one
  const plotted = h ? h.series.slice(1) : [];
  return (
    <div className="px-4 pb-6 pt-3">
      <BackButton onClick={onBack}>{backLabel}</BackButton>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex shrink-0 items-center">
          <EndLogo end={a} />
          <span className="-ml-2">
            <EndLogo end={b} />
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-1.5 text-[18px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            {name(a)}
            <span aria-label="and" className="shrink-0 text-zinc-400">
              ⇄
            </span>
            {name(b)}
          </h2>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">ICM route</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Window</span>
        <ViewSwitch
          id="route-window"
          value={days}
          onChange={setDays}
          options={(Object.keys(WINDOW) as Days[]).map((v) => ({ v, label: WINDOW[v] }))}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        {figure(`Messages · ${w}`, both === null ? "…" : both.toLocaleString("en-US"), history === "failed" ? "unavailable" : "both ways")}
        {figure("Share of ICM", pct === null ? "…" : `${pct < 0.1 && pct > 0 ? "<0.1" : pct.toFixed(1)}%`, share ? `of ${fmtCompact(share.total)} messages` : undefined)}
        {figure(
          <>
            {a.name} → {b.name}
          </>,
          way("ab"),
          h ? countedAs(h.ways.ab) : undefined,
        )}
        {figure(
          <>
            {b.name} → {a.name}
          </>,
          way("ba"),
          h ? countedAs(h.ways.ba) : undefined,
        )}
      </dl>
      {/* each figure's source keeps its answer a while; the ages say how long */}
      {(h || share) && (
        <p className="mt-1.5 px-0.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
          {[h && `Counts ${asOf(h.asOf)}`, share && `share ${asOf(share.at)}`].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* the messages over the window, each way: per hour for a day, per day for a week or a month */}
      <div className="mt-3 rounded-xl border border-zinc-200 px-2 pb-2 pt-2.5 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            <span className="truncate">
              {a.name} → {b.name}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BLUE }} />
            <span className="truncate">
              {b.name} → {a.name}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-zinc-400 dark:text-zinc-500">per {h?.bucket ?? (days === "1" ? "hour" : "day")}</span>
        </div>
        <div className="mt-1 h-[132px] text-zinc-900 dark:text-zinc-100">
          {h ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={plotted} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(161,161,170,0.14)" />
                <XAxis dataKey="t" tickFormatter={fmtT} tick={MONO} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={MONO} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
                <RechartsTooltip
                  isAnimationActive={false}
                  cursor={{ stroke: "rgba(161,161,170,0.4)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const r = payload[0].payload as RouteHistory["series"][number];
                    return (
                      <TipPlate>
                        <p className="font-mono text-[10px] text-zinc-500">{h.bucket === "hour" ? new Date(r.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" }) : `${fmtT(r.t)}, UTC`}</p>
                        <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                          {r.ab.toLocaleString("en-US")} <span className="text-zinc-400">{a.name} → {b.name}</span>
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                          {r.ba.toLocaleString("en-US")} <span className="text-zinc-400">{b.name} → {a.name}</span>
                        </p>
                      </TipPlate>
                    );
                  }}
                />
                {h.ways.ab && <Area type="monotone" dataKey="ab" stroke="currentColor" fill="currentColor" fillOpacity={0.1} strokeWidth={1.5} isAnimationActive={false} />}
                {h.ways.ba && <Area type="monotone" dataKey="ba" stroke={BLUE} fill={BLUE} fillOpacity={0.14} strokeWidth={1.5} isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">{history === "failed" ? "The route's history is unavailable right now" : "Reading the route's history…"}</p>
          )}
        </div>
      </div>

      <dl className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-900">
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Last message</dt>
          <dd className="font-mono text-[11.5px] tabular-nums text-zinc-700 dark:text-zinc-300">{!h ? "…" : last ? `${ageShort(last.at / 1000)} ago` : "none in 30 days"}</dd>
        </div>
      </dl>

      {/* the newest messages, each opening its own page */}
      {h && h.latest.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Recent messages</p>
          <ul className="mt-1.5 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {h.latest.map((m) => (
              <li key={m.messageId}>
                <Link href={`/explorer/${network}/icm/${m.messageId}`} className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", m.dir === "ab" ? "bg-zinc-900 dark:bg-zinc-100" : "")} style={m.dir === "ba" ? { background: BLUE } : undefined} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{truncate(m.messageId, 8)}</span>
                  <span className="shrink-0 truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{m.dir === "ab" ? `${a.name} → ${b.name}` : `${b.name} → ${a.name}`}</span>
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-400">{ageShort(m.at / 1000)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {[a, b].map((e) =>
          e.explorer ? (
            <Link
              key={e.id}
              href={e.explorer}
              className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-[13px] font-semibold text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="truncate">{e.name}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ) : null,
        )}
      </div>
    </div>
  );
}
