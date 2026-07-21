"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, CellLabel, SectionHeader, TxTypePill } from "@/components/explorer-v2/ui";
import { formatBytes, formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { pchainApiPath, type BlocksList, type BlockSummary } from "@/lib/pchain-explorer";

export function PchainBlocksList({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [nextBefore, setNextBefore] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      try {
        const res = await fetch(pchainApiPath(network, "blocks", { limit: 25, before }));
        const data: BlocksList = await res.json();
        setBlocks((prev) => (before ? [...prev, ...(data.blocks ?? [])] : data.blocks ?? []));
        setNextBefore(data.nextBefore);
        if (!data.nextBefore || (data.blocks ?? []).length === 0) setDone(true);
      } catch {
        setDone(true);
      } finally {
        setLoading(false);
      }
    },
    [network],
  );

  useEffect(() => {
    setBlocks([]);
    setDone(false);
    load();
  }, [network, load]);

  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Blocks" />
        <Board>
          <div className="hidden grid-cols-[1fr_1.2fr_0.6fr_0.8fr_1.4fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Height</span>
            <span>Type</span>
            <span className="text-right">Txns</span>
            <span className="text-right">Size</span>
            <span>Proposer</span>
            <span className="text-right">Age</span>
          </div>
          {blocks.map((b) => (
            <Link
              key={b.blockNumber}
              href={`${base}/block/${b.blockNumber}`}
              className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1fr_1.2fr_0.6fr_0.8fr_1.4fr_0.8fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
            >
              <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                #{formatNumber(b.blockNumber)}
              </span>
              <span className="justify-self-start">
                <TxTypePill type={b.blockType.replace(/Block$/, "")} />
              </span>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Txns</CellLabel>
                {b.txCount}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Size</CellLabel>
                {formatBytes(b.blockSizeBytes)}
              </div>
              <div className="min-w-0 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                <CellLabel>Proposer</CellLabel>
                {b.proposerNodeId ? truncate(b.proposerNodeId, 12) : "—"}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                {timeAgo(b.blockTimestamp)}
              </div>
            </Link>
          ))}
          {loading && <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>}
        </Board>
        {!done && !loading && (
          <button
            onClick={() => load(nextBefore)}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more
          </button>
        )}
      </section>
    </ExplorerShell>
  );
}
