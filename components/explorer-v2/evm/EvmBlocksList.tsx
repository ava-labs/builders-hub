"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, SectionHeader, StatCell, StatStrip } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime } from "@/components/explorer-v2/format";
import { useEvmData, refreshMsForChain } from "./hooks";
import { useHeadStream, cadence, CONTINUOUS_EXECUTION_CHAINS } from "./useHeadStream";
import { Belt, MotionRow, Height, GasBar, PhaseTrack, RowSkeleton, ageShort, phaseOf, useFreeze, HEAD, ROW, INK, MUTED } from "./LiveBoards";
import { FIG, UNIT } from "./AddressTables";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { BlockListResponse } from "@/lib/evm-explorer";

/* The Blocks tab: the chain's pace, then the chain itself. A strip of
   live cadence readings (block time, blocks per minute, TPS, gas per
   second, where the state root stands) over a belt of blocks that enter
   as they are sealed. On the C-Chain both read the RPC head stream; other
   chains keep the indexer list. Older history loads beneath the belt. */

const LIVE_ROWS = 25;
const PAGE = 25;
const MAX = 100;

export function EvmBlocksList({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const [older, setOlder] = useState(0);

  const liveRpc = CONTINUOUS_EXECUTION_CHAINS.has(String(c.chainId)) ? c.rpcUrl : undefined;
  const head = useHeadStream(liveRpc, { keep: 100, seed: LIVE_ROWS + 1, keepTxs: 0 });
  const live = head.heads.length > 0;
  const pace = cadence(head.heads, 60_000);
  const tip = head.tip;

  // the indexer: the whole list on chains without the live path, and the
  // history under the belt everywhere (fetched past the live window)
  const indexed = useEvmData<BlockListResponse>(
    c.chainId,
    "blocks",
    { limit: live ? (older > 0 ? older + LIVE_ROWS + 10 : 1) : PAGE + older },
    { refreshMs: live ? 0 : refreshMsForChain(c.chainId) },
  );
  const indexedBlocks = indexed.data?.blocks ?? [];
  const oldestLive = live ? (head.heads[Math.min(head.heads.length, LIVE_ROWS) - 1]?.number ?? 0) : 0;
  const history = live ? indexedBlocks.filter((b) => b.number < oldestLive).slice(0, older) : [];

  // gas per second over the cadence window: the heads inside it, minus
  // the one that opens the span
  const gasPerSec = (() => {
    if (!tip || !pace.spanMs || head.heads.length < 2) return null;
    const inWindow = head.heads.filter((h) => tip.timestampMs - h.timestampMs <= 60_000).slice(0, -1);
    const gas = inWindow.reduce((acc, h) => acc + h.gasUsed, 0);
    return (gas / pace.spanMs) * 1000;
  })();

  const rows = live
    ? head.heads.slice(0, LIVE_ROWS + 1).map((h) => ({
        number: h.number,
        timestampMs: h.timestampMs,
        txCount: h.txCount,
        gasUsed: h.gasUsed,
        gasLimit: h.gasLimit,
      }))
    : indexedBlocks.map((b) => ({
        number: b.number,
        timestampMs: b.timestamp * 1000,
        txCount: b.txCount,
        gasUsed: b.gasUsed,
        gasLimit: b.gasLimit,
      }));

  // the belt holds still under the pointer so a row can be clicked
  const [hover, setHover] = useState(false);
  const frozen = useFreeze({ rows, tip, executedHeight: head.executedHeight }, hover);
  const shownRows = frozen.rows;
  const showRoot = tip?.settledHeight != null;
  const cols = showRoot
    ? "md:grid-cols-[8rem_9rem_3.5rem_minmax(0,1fr)_9rem_3.5rem]"
    : "md:grid-cols-[8rem_9rem_3.5rem_minmax(0,1fr)_3.5rem]";

  const clock = (ms: number, withMs: boolean) => (
    <>
      {formatTime(Math.floor(ms / 1000)).slice(11, 19)}
      {withMs && <span className="text-zinc-400 dark:text-zinc-600">.{String(ms % 1000).padStart(3, "0")}</span>}
    </>
  );

  return (
    <EvmShell network={network}>
      <div className="flex flex-col gap-10">
        {live && (
          <section className="flex flex-col gap-4">
            <SectionHeader label="Cadence" />
            <StatStrip cols={5}>
              <StatCell label="Block Time" live sub="mean gap, last 60 s">
                <span className={FIG}>
                  {pace.intervalMs != null ? (pace.intervalMs / 1000).toFixed(2) : "…"} <span className={UNIT}>s</span>
                </span>
              </StatCell>
              <StatCell label="Blocks / min" live>
                <span className={FIG}>{pace.blocksPerMin != null ? pace.blocksPerMin.toFixed(0) : "…"}</span>
              </StatCell>
              <StatCell label="TPS" live sub="last 60 s">
                <span className={FIG}>{pace.tps != null ? pace.tps.toFixed(1) : "…"}</span>
              </StatCell>
              <StatCell label="Gas / s" live sub={tip ? `block limit ${formatNumber(tip.gasLimit)}` : undefined}>
                <span className={FIG}>
                  {gasPerSec != null ? (gasPerSec / 1e6).toFixed(2) : "…"} <span className={UNIT}>M</span>
                </span>
              </StatCell>
              <StatCell
                label="State Root"
                live
                href={tip?.settledHeight != null ? `${base}/block/${tip.settledHeight}` : undefined}
                sub={tip ? `tip #${formatNumber(tip.number)}` : undefined}
              >
                <span className={FIG}>{tip?.settledHeight != null ? `#${formatNumber(tip.settledHeight)}` : "…"}</span>
              </StatCell>
            </StatStrip>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeader label="Blocks" />
          <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
              <span>Height</span>
              <span>Time (UTC)</span>
              <span className="text-right">Txs</span>
              <span>Gas</span>
              {showRoot && (
                <span title="Every block here is final. Under Continuous Execution the state root is committed by a later block; this column shows whether that has happened yet.">
                  State Root
                </span>
              )}
              <span className="text-right">Age</span>
            </div>
            {rows.length === 0 &&
              (indexed.loading || (liveRpc && !head.live) ? (
                <RowSkeleton n={12} />
              ) : (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no blocks</div>
              ))}
            <Belt rows={live ? LIVE_ROWS : shownRows.length}>
              {shownRows.map((b, i) => (
                <MotionRow key={b.number} animateIn={live} overflow={i >= LIVE_ROWS}>
                  <Link href={`${base}/block/${b.number}`} className={cn(ROW, cols)}>
                    <Height value={b.number} />
                    <span className={cn(MUTED, "text-zinc-500 dark:text-zinc-400")}>
                      <CellLabel>Time</CellLabel>
                      {clock(b.timestampMs, live)}
                    </span>
                    <span className={cn(INK, "md:text-right")}>{b.txCount}</span>
                    <span className="col-span-2 md:col-span-1">
                      <GasBar used={b.gasUsed} limit={b.gasLimit} />
                    </span>
                    {showRoot && (
                      <PhaseTrack
                        phase={phaseOf(b.number, frozen.executedHeight, frozen.tip?.settledHeight ?? null)}
                        delayMs={(LIVE_ROWS - i) * 40}
                      />
                    )}
                    <span className={cn(MUTED, "text-right")}>{ageShort(Math.floor(b.timestampMs / 1000))}</span>
                  </Link>
                </MotionRow>
              ))}
            </Belt>
            {/* history under the belt: the indexer's older blocks, static */}
            {history.map((b) => (
              <Link
                key={`h-${b.number}`}
                href={`${base}/block/${b.number}`}
                className={cn(ROW, cols, "border-b border-zinc-200 dark:border-zinc-800")}
              >
                <Height value={b.number} />
                <span className={cn(MUTED, "text-zinc-500 dark:text-zinc-400")}>{clock(b.timestamp * 1000, false)}</span>
                <span className={cn(INK, "md:text-right")}>{b.txCount}</span>
                <span className="col-span-2 md:col-span-1">
                  <GasBar used={b.gasUsed} limit={b.gasLimit} />
                </span>
                {showRoot && <PhaseTrack phase="settled" />}
                <span className={cn(MUTED, "text-right")}>{ageShort(b.timestamp)}</span>
              </Link>
            ))}
          </Board>
          {older < MAX && rows.length > 0 && (
            <button
              onClick={() => setOlder((n) => Math.min(n + PAGE, MAX))}
              className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
            >
              {live ? "Load older" : "Load more"}
            </button>
          )}
          {live && (
            <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              live rows read from the RPC as blocks are sealed · older rows from the indexer
            </p>
          )}
        </section>
      </div>
    </EvmShell>
  );
}
