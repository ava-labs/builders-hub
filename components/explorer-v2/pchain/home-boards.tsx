"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, HEAD, INK, MUTED, ROW, RowDoor, RowSkeleton, SectionHeader, TxTypePill, idInk } from "@/components/explorer-v2/ui";
import { ageShort, formatNumber, truncate } from "@/components/explorer-v2/format";
import { Belt, Height, MotionRow, PHONE_ROWS, ROWS, ViewAll, useOpening } from "@/components/explorer-v2/evm/LiveBoards";
import { useTicker } from "@/components/explorer-v2/network/ticker";
import { blockTypeLabel, txTypeLabel, type BlockSummary, type TxSummary } from "@/lib/pchain-explorer";

/* The P-Chain home's two live boards, in the C-Chain's grammar: one line
   a row, a header naming each column, ink for identity. A poll lands in
   a batch; the ticker lets its rows in one at a time, each one slides in
   at the top, and a board holds still under the pointer. */

const byHeight = (a: BlockSummary, b: BlockSummary) => b.blockNumber - a.blockNumber;
const byBlock = (a: TxSummary, b: TxSummary) => b.blockHeight - a.blockHeight;
const stop = (e: React.MouseEvent) => e.stopPropagation();

/** a node inside a row: its own link, inside the row's door */
function NodeLink({ id, base }: { id?: string; base: string }) {
  if (!id) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  return (
    <Link href={`${base}/node/${id}`} className={cn(idInk, "hover:text-[#E6212F]")} title={id} onClick={stop}>
      {truncate(id, 13)}
    </Link>
  );
}

export function LatestPchainBlocks({ blocks, base, loading }: { blocks: BlockSummary[]; base: string; loading: boolean }) {
  const [hover, setHover] = useState(false);
  const rows = useTicker(blocks, ROWS + 1, { key: (b) => String(b.blockNumber), newer: byHeight, paused: hover });
  const opening = useOpening(rows, (b) => String(b.blockNumber));
  // a network whose indexer names no proposers (Fuji) drops the column
  const proposers = rows.some((b) => b.proposerNodeId);
  const cols = proposers ? "md:grid-cols-[6.5rem_6.5rem_2rem_minmax(0,1fr)_3rem]" : "md:grid-cols-[6.5rem_minmax(0,1fr)_2rem_3rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Blocks" action={<ViewAll href={`${base}/blocks`} />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>Height</span>
          <span>Type</span>
          <span className="text-right">Txs</span>
          {proposers && <span>Proposer</span>}
          <span className="text-right">Age</span>
        </div>
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
          {rows.map((b, i) => (
            <MotionRow key={b.blockNumber} animateIn={!opening.has(String(b.blockNumber))} overflow={i >= PHONE_ROWS}>
              <RowDoor href={`${base}/block/${b.blockNumber}`} className={cn(ROW, cols)}>
                <Height value={b.blockNumber} />
                {/* phones drop the header row, so the count rides the type there */}
                <span className="flex min-w-0 items-center gap-2 max-md:justify-end">
                  <TxTypePill type={blockTypeLabel(b.blockType)} />
                  <span className={cn(MUTED, "md:hidden")}>· {b.txCount} tx</span>
                </span>
                <span className={cn(INK, "text-right max-md:hidden")}>{b.txCount}</span>
                {proposers && (
                  <span className="min-w-0 truncate font-mono text-[12px]">
                    <NodeLink id={b.proposerNodeId} base={base} />
                  </span>
                )}
                <span className={cn(MUTED, "text-right max-md:col-start-2")}>{ageShort(b.blockTimestamp)}</span>
              </RowDoor>
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}

export function LatestPchainTxs({ txs, base, loading }: { txs: TxSummary[]; base: string; loading: boolean }) {
  const [hover, setHover] = useState(false);
  const rows = useTicker(txs, ROWS + 1, { key: (t) => t.txHash, newer: byBlock, paused: hover });
  const opening = useOpening(rows, (t) => t.txHash);
  // a window of txs without a node (imports, transfers, L1 ops) drops the column
  const nodes = rows.some((t) => t.nodeId);
  const cols = nodes ? "md:grid-cols-[7rem_minmax(0,12rem)_minmax(0,1fr)_6rem_3rem]" : "md:grid-cols-[7rem_minmax(0,1fr)_6rem_3rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Transactions" action={<ViewAll href={`${base}/txs`} />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>Hash</span>
          <span>Type</span>
          {nodes && <span>Node</span>}
          <span className="text-right">Block</span>
          <span className="text-right">Age</span>
        </div>
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
          {rows.map((t, i) => (
            <MotionRow key={t.txHash} animateIn={!opening.has(t.txHash)} overflow={i >= PHONE_ROWS}>
              <RowDoor href={`${base}/tx/${t.txHash}`} className={cn(ROW, cols)}>
                <Link href={`${base}/tx/${t.txHash}`} className={cn(INK, idInk, "truncate hover:text-[#E6212F]")} onClick={stop}>
                  {truncate(t.txHash, 6)}
                </Link>
                <span className="flex min-w-0 max-md:justify-end">
                  <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />
                </span>
                {nodes && (
                  <span className="min-w-0 truncate font-mono text-[12px]">
                    <NodeLink id={t.nodeId} base={base} />
                  </span>
                )}
                <Link href={`${base}/block/${t.blockHeight}`} className={cn(MUTED, "text-right transition-colors hover:text-[#E6212F] max-md:hidden")} onClick={stop}>
                  {formatNumber(t.blockHeight)}
                </Link>
                <span className={cn(MUTED, "text-right max-md:col-start-2")}>{ageShort(t.blockTimestamp)}</span>
              </RowDoor>
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}
