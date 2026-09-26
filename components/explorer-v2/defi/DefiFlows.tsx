"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { DefiSwitch } from "@/components/explorer-v2/network/defi-switch";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { Board, ChartBoard, EmptyRow, HEAD, LoadMore, ROW, RowSkeleton, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import type { FlowsResponse, Move, ProtocolFlow } from "@/lib/defi/flows";
import { DEFI_SCOPE, DEFI_STYLE, groupTone, signedUsd, usd } from "./palette";
import { actionOf, flowGroup, flowLabel } from "./flow-labels";
import { FlowRiver } from "./FlowRiver";

/* The DeFi tab's flows view: where money moved on the C-Chain over the
   last 24 hours or 7 days. The river shows what wallets sent into each
   category of protocol and what came back out; the protocol board shows
   the same for each protocol; the feed lists the largest single moves,
   each one a link to its transaction. MEV bots move most of the dollars
   and would drown everything else, so the view leaves them out and says
   how much that was. */

function useFlows(hours: number) {
  const [data, setData] = useState<FlowsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(`/api/defi/flows?hours=${hours}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: FlowsResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hours]);
  // a window's answer stands until the next one arrives, so the switch never flashes empty
  return { data, stale: !!data && data.hours !== hours, failed };
}

function ago(time: string, now: number): string {
  const t = Date.parse(`${time.replace(" ", "T").replace(/\.\d+$/, "")}Z`);
  if (!Number.isFinite(t)) return time;
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function DefiFlows() {
  const range = useExplorerTimeRange();
  const hours = range === "day" ? 24 : 168;
  const { data, stale, failed } = useFlows(hours);
  const s = data?.summary;
  const totals = useMemo(() => {
    if (!s) return null;
    const inflow = s.categories.reduce((a, c) => a + c.inflow, 0);
    const outflow = s.categories.reduce((a, c) => a + c.outflow, 0);
    return { inflow, outflow, net: inflow - outflow, mevShare: s.gross > 0 ? (s.mev / s.gross) * 100 : null };
  }, [s]);
  const label = hours === 24 ? "Last 24 hours" : range === "week" ? "Last 7 days" : "Last 7 days, the longest window here";

  return (
    <EvmShell network="mainnet">
      <div className="mb-8">
        <DefiSwitch on="flows" />
      </div>
      <div className={`${DEFI_SCOPE} flex flex-col gap-12`}>
        <style>{DEFI_STYLE}</style>
        {failed && !data ? (
          <p className="py-24 text-center font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            On-chain flows are unavailable right now
          </p>
        ) : (
          <>
            <ReadoutRow cols={4}>
              <Readout label="Into DeFi" value={totals ? usd(totals.inflow) : null} sub={label} />
              <Readout label="Out of DeFi" value={totals ? usd(totals.outflow) : null} sub={label} />
              <Readout label="Net" value={totals ? signedUsd(totals.net) : null} sub={totals ? (totals.net >= 0 ? "more came in than left" : "more left than came in") : undefined} />
              <Readout
                label="MEV Bots"
                value={s ? usd(s.mev) : null}
                sub={totals && totals.mevShare !== null ? `${totals.mevShare.toFixed(0)}% of labeled flow · left out` : undefined}
              />
            </ReadoutRow>

            <ChartBoard
              label="Where the Money Moved"
              action={<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</span>}
              className={cn("transition-opacity", stale && "opacity-60")}
            >
              {s ? <FlowRiver categories={s.categories} hours={hours} /> : <div className="h-80 animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
            </ChartBoard>

            <section className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              <ProtocolFlows rows={s?.protocols ?? null} label={label} />
              <MovesFeed moves={data?.moves ?? null} asOf={data?.asOf ?? null} hours={hours} />
            </section>

            <p className="font-mono text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              ERC-20 transfers of 14 major tokens (9 dollar stablecoins, WAVAX, sAVAX, BTC.b, WBTC.e, WETH.e), priced each hour from on-chain pools, where one side
              is a contract in the Builder Hub registry. MEV bots and moves inside one protocol are left out, and smart-wallet and relay contracts count as
              wallets. Routers pass tokens through, so a DEX&apos;s inflow and outflow are close; read its net. Native AVAX is not counted. Refreshed every 10
              minutes.
            </p>
          </>
        )}
      </div>
    </EvmShell>
  );
}

/** each protocol's inflow and outflow, drawn out from a shared zero, with the net */
function ProtocolFlows({ rows, label }: { rows: ProtocolFlow[] | null; label: string }) {
  const top = (rows ?? []).slice(0, 12);
  const max = Math.max(1, ...top.map((p) => Math.max(p.inflow, p.outflow)));
  return (
    <ChartBoard label="By Protocol" action={<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</span>}>
      {!rows ? (
        <RowSkeleton n={8} />
      ) : top.length === 0 ? (
        <EmptyRow>No protocol flows in this window</EmptyRow>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] gap-x-2 pb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)_5rem] dark:text-zinc-500">
            <span />
            <span className="text-right">out</span>
            <span>in</span>
            <span className="text-right">net</span>
          </div>
          {top.map((p) => {
            const tone = groupTone(flowGroup(p.category));
            return (
              <div
                key={p.name}
                title={`${p.name}: ${usd(p.inflow)} in, ${usd(p.outflow)} out`}
                className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-x-2 py-1 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)_5rem]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: tone }} />
                  <span className="truncate font-mono text-[11.5px] text-zinc-900 dark:text-zinc-100">{p.name}</span>
                </span>
                <span className="flex h-3 justify-end">
                  <span className="h-full rounded-l-[2px] opacity-55" style={{ width: `${(p.outflow / max) * 100}%`, background: tone }} />
                </span>
                <span className="flex h-3">
                  <span className="h-full rounded-r-[2px]" style={{ width: `${(p.inflow / max) * 100}%`, background: tone }} />
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">{signedUsd(p.net)}</span>
              </div>
            );
          })}
        </div>
      )}
    </ChartBoard>
  );
}

const MOVE_GRID = "md:grid-cols-[4.5rem_8.5rem_6.5rem_minmax(0,1fr)_1.25rem]";

/** the window's largest single moves, one per transaction */
function MovesFeed({ moves, asOf, hours }: { moves: Move[] | null; asOf: number | null; hours: number }) {
  const [only, setOnly] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const now = (asOf ?? Math.floor(Date.now() / 1000)) * 1000;
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of moves ?? []) {
      const c = mv.to.category ?? mv.from.category ?? "other";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [moves]);
  const cut = (moves ?? []).filter((mv) => !only || (mv.to.category ?? mv.from.category) === only);
  const shown = all ? cut : cut.slice(0, 12);

  const Party = ({ p }: { p: Move["from"] }) =>
    p.name ? (
      <Link href={`/explorer/mainnet/c-chain/address/${p.address}`} className="inline-flex min-w-0 items-center gap-1 truncate text-zinc-900 hover:underline dark:text-zinc-100">
        <span className="h-1.5 w-1.5 shrink-0 rounded-[1px]" style={{ background: groupTone(flowGroup(p.category ?? "other")) }} />
        <span className="truncate">{p.name}</span>
      </Link>
    ) : (
      <Link href={`/explorer/mainnet/c-chain/address/${p.address}`} className={cn("truncate hover:underline", idInk)}>
        {short(p.address)}
      </Link>
    );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        label={`Largest Moves · ${hours === 24 ? "24h" : "7d"}`}
        action={
          <div className="flex flex-wrap justify-end gap-1">
            {[null, ...cats.map(([c]) => c)].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                aria-pressed={only === c}
                onClick={() => {
                  setOnly(c);
                  setAll(false);
                }}
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                  only === c
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100",
                )}
              >
                {c ? flowLabel(c) : "All"}
              </button>
            ))}
          </div>
        }
      />
      <Board divide={false}>
        <div className={cn(HEAD, MOVE_GRID, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>When</span>
          <span>What</span>
          <span className="text-right">Amount</span>
          <span>From → to</span>
          <span />
        </div>
        {!moves && <RowSkeleton n={8} />}
        {moves && cut.length === 0 && <EmptyRow>No moves in this cut</EmptyRow>}
        {shown.map((mv) => (
          <div key={mv.tx} className={cn(ROW, MOVE_GRID, "border-b border-zinc-100 font-mono text-[11.5px] last:border-b-0 dark:border-zinc-900")}>
            <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{ago(mv.time, now)}</span>
            <span className="truncate text-zinc-600 dark:text-zinc-300">{actionOf(mv.to.category ?? mv.from.category, mv.direction)}</span>
            <span className="tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
              {usd(mv.usd)} <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{mv.token}</span>
            </span>
            <span className="col-span-2 flex min-w-0 items-center gap-1.5 md:col-span-1">
              <Party p={mv.from} />
              <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
              <Party p={mv.to} />
            </span>
            <Link href={`/explorer/mainnet/c-chain/tx/${mv.tx}`} aria-label="Open the transaction" className="hidden justify-self-end text-zinc-300 hover:text-zinc-900 md:block dark:text-zinc-600 dark:hover:text-zinc-100">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </Board>
      {cut.length > shown.length && <LoadMore onClick={() => setAll(true)} label={`Show all ${cut.length}`} />}
    </div>
  );
}
