"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, CellLabel, HEAD, INK, MUTED, ROW, RowDoor, RowSkeleton, SectionHeader, TxTypePill, idInk } from "@/components/explorer-v2/ui";
import { ageShort, formatBytes, formatNumber, formatTime, truncate } from "@/components/explorer-v2/format";
import { Belt, Height, MotionRow, PHONE_ROWS, ROWS, ViewAll, useOpening } from "@/components/explorer-v2/evm/belt";
import { useTicker } from "@/components/explorer-v2/network/ticker";
import { blockTypeLabel, txTypeLabel, type BlockSummary, type TxSummary } from "@/lib/pchain-explorer";

/* The P-Chain's block and tx rows in the C-Chain's ledger grammar: one
   line a row, a header naming each column, ink for identity. The home's
   two live boards and the two list pages set the same rows; the lists
   add the clock time, the size and the renewal. */

const byHeight = (a: BlockSummary, b: BlockSummary) => b.blockNumber - a.blockNumber;
const byBlock = (a: TxSummary, b: TxSummary) => b.blockHeight - a.blockHeight;
const stop = (e: React.MouseEvent) => e.stopPropagation();
const RULE = "border-b border-zinc-200 dark:border-zinc-800";

/** a node inside a row: its own link, inside the row's door */
function NodeLink({ id, base }: { id?: string; base: string }) {
  if (!id) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  return (
    <Link href={`${base}/node/${id}`} className={cn(idInk, "hover:text-[#E6212F]")} title={id} onClick={stop}>
      {truncate(id, 13)}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Blocks: height · (time) · type · txs · (size) · proposer · age      */

export interface BlockLayout {
  cols: string;
  /** the indexer names proposers (mainnet); Fuji's rows drop the column */
  proposers: boolean;
  /** the list's extra cells: the block's clock time and its size */
  full: boolean;
}

export function blockLayout(rows: BlockSummary[], full: boolean): BlockLayout {
  const proposers = rows.some((b) => b.proposerNodeId);
  const cols = full
    ? proposers
      ? "md:grid-cols-[7rem_5.5rem_7rem_2.5rem_4.5rem_minmax(0,1fr)_3rem]"
      : "md:grid-cols-[7rem_5.5rem_minmax(0,1fr)_2.5rem_4.5rem_3rem]"
    : proposers
      ? "md:grid-cols-[6.5rem_6.5rem_2rem_minmax(0,1fr)_3rem]"
      : "md:grid-cols-[6.5rem_minmax(0,1fr)_2rem_3rem]";
  return { cols, proposers, full };
}

export function BlockHead({ cols, proposers, full }: BlockLayout) {
  return (
    <div className={cn(HEAD, cols, RULE)}>
      <span>Height</span>
      {full && <span>Time (UTC)</span>}
      <span>Type</span>
      <span className="text-right">Txs</span>
      {full && <span className="text-right">Size</span>}
      {proposers && <span>Proposer</span>}
      <span className="text-right">Age</span>
    </div>
  );
}

export function BlockLine({ b, base, layout: { cols, proposers, full } }: { b: BlockSummary; base: string; layout: BlockLayout }) {
  return (
    <RowDoor href={`${base}/block/${b.blockNumber}`} className={cn(ROW, cols)}>
      <Height value={b.blockNumber} />
      {full && <span className={cn(MUTED, "text-zinc-500 max-md:hidden dark:text-zinc-400")}>{formatTime(b.blockTimestamp).slice(11, 19)}</span>}
      {/* phones drop the header row: on a board the count rides the type,
          on the list each cell keeps its label */}
      <span className="flex min-w-0 items-center gap-2 whitespace-nowrap max-md:justify-end">
        <TxTypePill type={blockTypeLabel(b.blockType)} className="shrink-0" />
        {!full && <span className={cn(MUTED, "md:hidden")}>· {b.txCount} tx</span>}
      </span>
      <span className={cn(INK, full ? "md:text-right" : "text-right max-md:hidden")}>
        {full && <CellLabel>Txs</CellLabel>}
        {b.txCount}
      </span>
      {full && (
        <span className={cn(MUTED, "text-right")}>
          <CellLabel>Size</CellLabel>
          {formatBytes(b.blockSizeBytes)}
        </span>
      )}
      {proposers && (
        <span className="min-w-0 truncate font-mono text-[12px]">
          {full && <CellLabel>Proposer</CellLabel>}
          <NodeLink id={b.proposerNodeId} base={base} />
        </span>
      )}
      <span className={cn(MUTED, "text-right max-md:col-start-2")}>
        {full && <CellLabel>Age</CellLabel>}
        {ageShort(b.blockTimestamp)}
      </span>
    </RowDoor>
  );
}

/* ------------------------------------------------------------------ */
/* Transactions: hash · type · node (renewal) · block · age             */

export interface TxLayout {
  cols: string;
  /** a window of txs with no node (imports, transfers, L1 ops) drops the column */
  nodes: boolean;
  /** the list's extra: an auto-renewed stake's period and restake share */
  full: boolean;
  /** an Auto-Renew Config tx names no node, but its terms keep the column */
  renewals: boolean;
}

export function txLayout(rows: TxSummary[], full: boolean): TxLayout {
  const nodes = rows.some((t) => t.nodeId);
  const renewals = full && rows.some((t) => renewal(t) !== null);
  const cols = nodes || renewals ? "md:grid-cols-[7rem_minmax(0,12rem)_minmax(0,1fr)_6rem_3rem]" : "md:grid-cols-[7rem_minmax(0,1fr)_6rem_3rem]";
  return { cols, nodes, full, renewals };
}

export function TxHead({ cols, nodes, renewals }: TxLayout) {
  return (
    <div className={cn(HEAD, cols, RULE)}>
      <span>Hash</span>
      <span>Type</span>
      {(nodes || renewals) && <span>{nodes ? "Node" : "Renewal"}</span>}
      <span className="text-right">Block</span>
      <span className="text-right">Age</span>
    </div>
  );
}

/** an auto-renewed stake's terms as the list states them */
function renewal(t: TxSummary): string | null {
  if (t.period === undefined) return null;
  if (t.period === 0) return "stops renewing";
  const every = `renews every ${t.periodHuman ?? `${Math.round(t.period / 86_400)} days`}`;
  return t.autoCompoundPercent !== undefined ? `${every} · ${t.autoCompoundPercent}% restaked` : every;
}

export function TxLine({ t, base, layout: { cols, nodes, full, renewals } }: { t: TxSummary; base: string; layout: TxLayout }) {
  const terms = full ? renewal(t) : null;
  return (
    <RowDoor href={`${base}/tx/${t.txHash}`} className={cn(ROW, cols)}>
      <Link href={`${base}/tx/${t.txHash}`} className={cn(INK, idInk, "truncate hover:text-[#E6212F]")} onClick={stop}>
        {truncate(t.txHash, 6)}
      </Link>
      <span className="flex min-w-0 max-md:justify-end">
        <TxTypePill type={t.txType} label={txTypeLabel(t.txType)} />
      </span>
      {(nodes || renewals) && (
        <span className={cn("min-w-0 truncate font-mono text-[12px]", full && "max-md:col-span-2")}>
          {(t.nodeId || !terms) && <NodeLink id={t.nodeId} base={base} />}
          {terms && (
            <span className="text-zinc-400 dark:text-zinc-500">
              {t.nodeId ? " · " : ""}
              {terms}
            </span>
          )}
        </span>
      )}
      <span className={cn(MUTED, full ? "md:text-right" : "text-right max-md:hidden")}>
        {full && <CellLabel>Block</CellLabel>}
        <Link href={`${base}/block/${t.blockHeight}`} className="transition-colors hover:text-[#E6212F]" onClick={stop}>
          {formatNumber(t.blockHeight)}
        </Link>
      </span>
      <span className={cn(MUTED, "text-right max-md:col-start-2")}>
        {full && <CellLabel>Age</CellLabel>}
        {ageShort(t.blockTimestamp)}
      </span>
    </RowDoor>
  );
}

/* ------------------------------------------------------------------ */
/* The home's live boards: a poll lands in a batch, the ticker lets its
   rows in one at a time, each slides in at the top, and a board holds
   still under the pointer. */

export function LatestPchainBlocks({ blocks, base, loading }: { blocks: BlockSummary[]; base: string; loading: boolean }) {
  const [hover, setHover] = useState(false);
  const rows = useTicker(blocks, ROWS + 1, { key: (b) => String(b.blockNumber), newer: byHeight, paused: hover });
  const opening = useOpening(rows, (b) => String(b.blockNumber));
  const layout = blockLayout(rows, false);
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Blocks" action={<ViewAll href={`${base}/blocks`} />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <BlockHead {...layout} />
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
          {rows.map((b, i) => (
            <MotionRow key={b.blockNumber} animateIn={!opening.has(String(b.blockNumber))} overflow={i >= PHONE_ROWS}>
              <BlockLine b={b} base={base} layout={layout} />
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
  const layout = txLayout(rows, false);
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Transactions" action={<ViewAll href={`${base}/txs`} />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <TxHead {...layout} />
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
          {rows.map((t, i) => (
            <MotionRow key={t.txHash} animateIn={!opening.has(t.txHash)} overflow={i >= PHONE_ROWS}>
              <TxLine t={t} base={base} layout={layout} />
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}
