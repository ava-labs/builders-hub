"use client";

import { cn } from "@/lib/utils";
import { CellLabel, HEAD, INK, MUTED, feeInk } from "@/components/explorer-v2/ui";
import { ageShort, formatTime } from "@/components/explorer-v2/format";
import { Height } from "./belt";
import { GasBar } from "./LiveBoards";
import { formatEther } from "./format";
import type { BurnState } from "./useBlockBurns";

/* The EVM block table's columns: height, time, txs, (burn), gas, (state
   root), age. The Blocks tab sets them over its live belt and its history;
   a validator's page sets them over the blocks it proposed. */

export interface EvmBlockRow {
  number: number;
  timestampMs: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
}

export function evmBlockCols({ root, burn }: { root: boolean; burn: boolean }): string {
  return root
    ? burn
      ? "md:grid-cols-[8rem_9rem_3.5rem_7rem_minmax(0,1fr)_9rem_3.5rem]"
      : "md:grid-cols-[8rem_9rem_3.5rem_minmax(0,1fr)_9rem_3.5rem]"
    : burn
      ? "md:grid-cols-[8rem_9rem_3.5rem_7rem_minmax(0,1fr)_3.5rem]"
      : "md:grid-cols-[8rem_9rem_3.5rem_minmax(0,1fr)_3.5rem]";
}

export function EvmBlockHead({ cols, root, burn }: { cols: string; root: boolean; burn: boolean }) {
  return (
    <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
      <span>Height</span>
      <span>Time (UTC)</span>
      <span className="text-right">Txs</span>
      {burn && (
        <span className="text-right" title="Every fee in the block, tips included: the sum of gas used × effective gas price over its receipts. The C-Chain burns all of it.">
          Burn
        </span>
      )}
      <span>Gas</span>
      {root && (
        <span title="Every block here is final. Under Continuous Execution the state root is committed by a later block; this column shows whether that has happened yet.">
          State Root
        </span>
      )}
      <span className="text-right">Age</span>
    </div>
  );
}

/** the block's burn: "…" until the true sum arrives, so no row shows a
    wrong number; a failed request leaves the cell empty */
export function BurnCell({ wei, sym }: { wei: BurnState | undefined; sym: string }) {
  return (
    <span className={cn("font-mono text-[12.5px] tabular-nums text-right", feeInk)}>
      {wei === "loading" && <span className="text-zinc-400 dark:text-zinc-500">…</span>}
      {typeof wei === "bigint" && (
        <>
          {formatEther(wei.toString(), { decimals: 6 })} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{sym}</span>
        </>
      )}
    </span>
  );
}

export function BlockClock({ ms, withMs }: { ms: number; withMs: boolean }) {
  return (
    <>
      {formatTime(Math.floor(ms / 1000)).slice(11, 19)}
      {withMs && <span className="text-zinc-400 dark:text-zinc-600">.{String(ms % 1000).padStart(3, "0")}</span>}
    </>
  );
}

/** one row's cells; the caller sets the row (a link, a belt row) and the state root */
export function EvmBlockCells({
  b,
  withMs = false,
  burn,
  root,
}: {
  b: EvmBlockRow;
  withMs?: boolean;
  burn?: React.ReactNode;
  root?: React.ReactNode;
}) {
  return (
    <>
      <Height value={b.number} />
      <span className={cn(MUTED, "text-zinc-500 dark:text-zinc-400")}>
        <CellLabel>Time</CellLabel>
        <BlockClock ms={b.timestampMs} withMs={withMs} />
      </span>
      <span className={cn(INK, "md:text-right")}>{b.txCount}</span>
      {burn}
      <span className="col-span-2 md:col-span-1">
        <GasBar used={b.gasUsed} limit={b.gasLimit} />
      </span>
      {root}
      <span className={cn(MUTED, "text-right")}>{ageShort(Math.floor(b.timestampMs / 1000))}</span>
    </>
  );
}
