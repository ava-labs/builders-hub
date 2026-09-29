"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { compact, formatNumber } from "@/components/explorer-v2/format";
import { short } from "@/lib/explorer-query/values";
import type { MonitorItem, MonitorRead, MonitorSpec } from "@/lib/explorer-query/monitor";
import { CARD } from "./QueryVisual";

/* A Query monitor on the page (lib/explorer-query/monitor.ts): the chain's moves as each block is made. It asks
   the feed route every POLL_MS while the tab is shown and the reader has not paused it, keeps the moves of the
   last WINDOW_MS, and draws them three ways: the window's figures, a bar of moves per BUCKET_MS with the amount
   they carried as a line, and the newest moves, each a door to its transaction and addresses. */

const POLL_MS = 3_000;
const WINDOW_MS = 10 * 60_000;
const BUCKET_MS = 15_000;
const LIST = 40;
const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400";

const keyOf = (i: MonitorItem) => `${i.tx}:${i.index}`;
/** "14:05:30", UTC, as every time on the explorer */
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 19);

/** an amount beside its symbol: whole units from a thousand up, two places from one, four below */
function amountText(v: number): string {
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.0001) return v.toFixed(4);
  return v > 0 ? "<0.0001" : "0";
}

/** "4s", "3m": how long ago a move was made, in rounded seconds, then minutes, never hours (ageShort in format.ts floors and goes on to hours) */
function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

/** the new moves before the kept ones, each once, none older than the window */
function merge(fresh: MonitorItem[], kept: MonitorItem[]): MonitorItem[] {
  const seen = new Set<string>();
  const all = [...fresh, ...kept].filter((i) => {
    const k = keyOf(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const newest = all.reduce((m, i) => Math.max(m, i.at), 0);
  return all.filter((i) => i.at >= newest - WINDOW_MS);
}

/** a period's moves and what they carried; null for a period before the first block read, which is not quiet */
interface Bucket {
  t: number;
  n: number | null;
  v: number | null;
}

function BucketTip({ active, payload, sym, noun }: { active?: boolean; payload?: { payload: Bucket }[]; sym: string | null; noun: [string, string] }) {
  if (!active || !payload?.[0]) return null;
  const b = payload[0].payload;
  return (
    <div className="rounded-lg bg-white px-3 py-2 font-mono text-[11px] tabular-nums shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <p className="text-zinc-500 dark:text-zinc-400">
        {clock(b.t)} to {clock(b.t + BUCKET_MS)} UTC
      </p>
      {b.n === null ? (
        <p className="text-zinc-500 dark:text-zinc-400">before the first block read</p>
      ) : (
        <>
          <p className="text-zinc-900 dark:text-zinc-50">{formatNumber(b.n)} {b.n === 1 ? noun[0] : noun[1]}</p>
          {sym && <p className="text-[#0061E2] dark:text-[#5b9bff]">{amountText(b.v ?? 0)} {sym}</p>}
        </>
      )}
    </div>
  );
}

export function QueryMonitor({ spec, base }: { spec: MonitorSpec; base: string }) {
  const [items, setItems] = useState<MonitorItem[]>([]);
  const [head, setHead] = useState<{ block: number; at: number } | null>(null);
  // the time of the first block the feed read: the chart draws nothing before it
  const [covered, setCovered] = useState<number | null>(null);
  const [state, setState] = useState<"opening" | "live" | "failed">("opening");
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [atLeast, setAtLeast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const specKey = JSON.stringify(spec);

  // the feed: a first read of the last few minutes, then each read from the block after the last one
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let from: number | null = null;
    setItems([]);
    setHead(null);
    setCovered(null);
    setState("opening");
    const read = async () => {
      if (!alive) return;
      if (from === null || (!pausedRef.current && document.visibilityState === "visible")) {
        try {
          const res = await fetch("/api/explorer/monitor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, from }) });
          const out = (await res.json()) as MonitorRead & { error?: string };
          if (!res.ok || out.error) throw new Error(out.error ?? `HTTP ${res.status}`);
          if (!alive) return;
          // a read after a gap starts the window again: the chart never draws blocks it did not read as quiet
          const fresh = from === null || out.gap;
          setItems((kept) => merge(out.items, fresh ? [] : kept));
          if (fresh && out.fromAt) setCovered(out.fromAt);
          from = out.head + 1;
          if (out.headAt) setHead({ block: out.head, at: out.headAt });
          setState("live");
          setError(null);
        } catch (e) {
          if (!alive) return;
          setError(e instanceof Error ? e.message : "The feed did not answer.");
          if (from === null) setState("failed");
        }
      }
      timer = setTimeout(read, POLL_MS);
    };
    void read();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // the spec's own words decide the feed; a new object with the same words is the same monitor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  // ages move on between reads
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sym = spec.kind === "native" ? (spec.coin ?? null) : spec.kind === "events" ? (spec.unit ?? null) : (spec.token?.symbol ?? null);
  // an events monitor counts events, of one kind or several; the others count moves
  const events = spec.kind === "events";
  const several = events && (spec.events?.length ?? 0) > 1;
  const noun = useMemo<[string, string]>(() => (events ? ["event", "events"] : ["move", "moves"]), [events]);
  const Noun = events ? "Events" : "Moves";
  const least = Number(atLeast.replace(/,/g, ""));
  const shown = useMemo(() => (least > 0 ? items.filter((i) => i.amount !== null && i.amount >= least) : items), [items, least]);

  // the chain's clock, not the reader's: the window ends at the newest block read
  const end = head?.at ?? now;
  const buckets = useMemo<Bucket[]>(() => {
    const last = Math.floor(end / BUCKET_MS) * BUCKET_MS;
    const out: Bucket[] = Array.from({ length: WINDOW_MS / BUCKET_MS }, (_, i) => ({ t: last - (WINDOW_MS / BUCKET_MS - 1 - i) * BUCKET_MS, n: 0, v: 0 }));
    const first = out[0].t;
    for (const i of shown) {
      const k = Math.floor((i.at - first) / BUCKET_MS);
      if (k < 0 || k >= out.length) continue;
      out[k].n = (out[k].n ?? 0) + 1;
      out[k].v = (out[k].v ?? 0) + (i.amount ?? 0);
    }
    // a period that ended before the first block read was not read, so it is no bar at all
    return covered === null ? out : out.map((b) => (b.t + BUCKET_MS <= covered ? { ...b, n: null, v: null } : b));
  }, [shown, end, covered]);

  const figures = useMemo(() => {
    const inWindow = shown.filter((i) => i.at >= end - WINDOW_MS);
    const volume = inWindow.reduce((t, i) => t + (i.amount ?? 0), 0);
    const largest = inWindow.reduce<MonitorItem | null>((m, i) => (i.amount !== null && (!m || i.amount > (m.amount ?? 0)) ? i : m), null);
    // the rate over the minutes the feed read, not from the oldest move: two moves in ten quiet minutes are 0.2 a minute
    const oldest = inWindow.reduce((m, i) => Math.min(m, i.at), end);
    const since = covered === null ? oldest : Math.max(covered, end - WINDOW_MS);
    const minutes = Math.max(1 / 6, (end - since) / 60_000);
    return {
      count: inWindow.length,
      volume,
      largest,
      perMinute: inWindow.length / minutes,
      tokens: new Set(inWindow.map((i) => i.token)).size,
      accounts: new Set(inWindow.map((i) => i.from).filter(Boolean)).size,
      contracts: new Set(inWindow.map((i) => i.to)).size,
    };
  }, [shown, end, covered]);
  // what the figures cover: the whole window, or the minutes read so far while the feed has read less (a native
  // monitor opens on about three minutes of blocks)
  const whole = WINDOW_MS / 60_000;
  const span = `${covered === null || end - covered >= WINDOW_MS ? whole : Math.min(whole - 1, Math.max(1, Math.round((end - covered) / 60_000)))} min`;

  const chart = useMemo(
    () => (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={buckets} margin={{ top: 8, right: sym ? 0 : 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="t" tickFormatter={clock} tick={{ fontSize: 10, fontFamily: "monospace", fill: "currentColor" }} stroke="currentColor" strokeOpacity={0.2} interval="preserveStartEnd" minTickGap={48} />
          <YAxis yAxisId="n" allowDecimals={false} width={36} tick={{ fontSize: 10, fontFamily: "monospace", fill: "currentColor" }} stroke="currentColor" strokeOpacity={0.2} />
          {sym && <YAxis yAxisId="v" orientation="right" width={52} tickFormatter={compact} tick={{ fontSize: 10, fontFamily: "monospace", fill: "#0061E2" }} stroke="#0061E2" strokeOpacity={0.3} />}
          {/* filterNull off: a period before the first block read still says so on hover */}
          <RechartsTooltip content={<BucketTip sym={sym} noun={noun} />} filterNull={false} cursor={{ fill: "rgba(161,161,170,0.14)" }} isAnimationActive={false} />
          <Bar yAxisId="n" dataKey="n" fill="currentColor" fillOpacity={0.78} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {sym && <Line yAxisId="v" dataKey="v" stroke="#0061E2" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    ),
    [buckets, sym, noun],
  );

  const live = state === "live" && !paused;
  // an events monitor whose events carry no amount (a swap's are its pool's) shows no Amount column
  const amounts = !events || items.some((i) => i.amount !== null || i.symbol);
  const cols = amounts ? "grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3rem_6.5rem_minmax(0,1fr)_auto_6rem]" : "grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[3rem_6.5rem_minmax(0,1fr)_6rem]";
  const unit = sym ?? "";

  return (
    <div className={cn(CARD, "flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5")}>
      {/* the feed's state, and the reader's two controls */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400" aria-live="polite">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", live ? "animate-pulse bg-emerald-500" : state === "failed" ? "bg-[#E6212F]" : "bg-zinc-300 dark:bg-zinc-700")} />
          {state === "opening"
            ? "Reading the last few minutes…"
            : state === "failed"
              ? (error ?? "The feed did not answer.")
              : `${paused ? "Paused" : "Live"} · block ${formatNumber(head?.block ?? 0)}${head ? ` · ${ago(head.at, now)} ago` : ""}${error ? " · retrying" : ""}`}
        </span>
        <span className="flex items-center gap-2">
          {sym && (
            <label className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              At least
              <input
                value={atLeast}
                onChange={(e) => setAtLeast(e.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Show moves of at least this many ${unit}`}
                className="w-20 rounded-md bg-zinc-100 px-2 py-1 text-right tabular-nums text-zinc-900 outline-none ring-[#0061E2]/40 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-50"
              />
              {unit}
            </label>
          )}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={state !== "live"}
            aria-pressed={paused}
            className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 font-mono text-[11px] text-zinc-700 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 disabled:opacity-40 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused ? "Resume" : "Pause"}
          </button>
        </span>
      </div>

      {/* the window at a glance */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <dt className={LABEL}>
            {Noun} · {span}
          </dt>
          <dd className="font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">{state === "opening" ? "…" : formatNumber(figures.count)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <dt className={LABEL}>Per minute</dt>
          <dd className="font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">{state === "opening" ? "…" : figures.perMinute.toFixed(figures.perMinute >= 10 ? 0 : 1)}</dd>
        </div>
        {sym ? (
          <>
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className={LABEL}>Moved · {span}</dt>
              <dd className="truncate font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                {state === "opening" ? "…" : compact(figures.volume)} <span className="text-[12px] text-zinc-400">{unit}</span>
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className={LABEL}>Largest</dt>
              <dd className="truncate font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                {figures.largest && figures.largest.amount !== null ? (
                  <Link href={`${base}/tx/${figures.largest.tx}`} className="hover:text-[#0061E2]">
                    {compact(figures.largest.amount)} <span className="text-[12px] text-zinc-400">{unit}</span>
                  </Link>
                ) : (
                  "…"
                )}
              </dd>
            </div>
          </>
        ) : events ? (
          <>
            {/* events in many tokens, or none (a swap's are its pool's): who and where, not a sum */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className={LABEL}>Accounts</dt>
              <dd className="font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">{state === "opening" ? "…" : formatNumber(figures.accounts)}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className={LABEL}>Contracts</dt>
              <dd className="font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">{state === "opening" ? "…" : formatNumber(figures.contracts)}</dd>
            </div>
          </>
        ) : (
          <div className="flex min-w-0 flex-col gap-1.5">
            <dt className={LABEL}>Tokens</dt>
            <dd className="font-mono text-[22px] leading-none tabular-nums text-zinc-900 dark:text-zinc-50">{state === "opening" ? "…" : formatNumber(figures.tokens)}</dd>
          </div>
        )}
      </dl>

      {/* moves per 15 seconds, and what they carried */}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>
          {Noun} per 15 s{sym ? <span className="text-[#0061E2] dark:text-[#5b9bff]"> · {unit} moved</span> : null}
        </span>
        <div className="h-48 text-zinc-900 sm:h-56 dark:text-zinc-100">{chart}</div>
      </div>

      {/* the newest moves */}
      <div className="flex flex-col">
        <div className={cn("grid gap-x-3 border-b border-zinc-200 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500", cols)}>
          <span>Age</span>
          <span className="hidden sm:block">Block</span>
          <span>{events ? (several ? "Event · Account" : "Account") : "From → To"}</span>
          {amounts && <span className="text-right">Amount</span>}
          <span className="hidden text-right sm:block">Tx</span>
        </div>
        {state === "opening" &&
          Array.from({ length: 6 }, (_, i) => <span key={i} className="my-2 h-4 animate-pulse rounded-sm bg-zinc-100 dark:bg-zinc-900" />)}
        {state !== "opening" && shown.length === 0 && (
          <p className="py-6 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">No {noun[1]} in the blocks read yet. New blocks come in every few seconds.</p>
        )}
        {shown.slice(0, LIST).map((i) => (
          <div
            key={keyOf(i)}
            className={cn("grid items-center gap-x-3 border-b border-zinc-100 py-2 font-mono text-[12px] tabular-nums last:border-b-0 dark:border-zinc-900", cols)}
          >
            <span className="text-zinc-400 dark:text-zinc-500">{ago(i.at, now)}</span>
            <Link href={`${base}/block/${i.block}`} className="hidden truncate text-zinc-500 hover:text-[#0061E2] sm:block dark:text-zinc-400">
              {formatNumber(i.block)}
            </Link>
            {events ? (
              // what happened, when the monitor reads several kinds, and whom it is about (else the contract)
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                {several && i.event && <span className="truncate text-zinc-500 dark:text-zinc-400">{i.event}</span>}
                <Link href={`${base}/address/${i.from || i.to}`} className="shrink-0 text-[#0061E2] hover:underline dark:text-[#5b9bff]">
                  {short(i.from || i.to)}
                </Link>
              </span>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <Link href={`${base}/address/${i.from}`} className="truncate text-[#0061E2] hover:underline dark:text-[#5b9bff]">
                  {short(i.from)}
                </Link>
                <span className="text-zinc-300 dark:text-zinc-600">→</span>
                <Link href={`${base}/address/${i.to}`} className="truncate text-[#0061E2] hover:underline dark:text-[#5b9bff]">
                  {short(i.to)}
                </Link>
              </span>
            )}
            {/* a move of nothing is real, and often spam that plants a lookalike address: it stays, quiet */}
            {amounts && (
              <span className={cn("text-right", i.amount === 0 ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-50")}>
                {/* "?" is a token whose decimals the list lacks; an event with no amount of its own (a swap) shows none */}
                {i.amount === null ? (events && !i.token ? "" : "?") : amountText(i.amount)}{" "}
                <span className="text-zinc-400 dark:text-zinc-500">{i.symbol ?? (i.token ? short(i.token) : unit)}</span>
              </span>
            )}
            <Link href={`${base}/tx/${i.tx}`} className="hidden truncate text-right text-zinc-500 hover:text-[#0061E2] sm:block dark:text-zinc-400">
              {i.tx.slice(0, 8)}…
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
