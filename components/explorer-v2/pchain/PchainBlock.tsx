"use client";

import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, HashChip, SectionHeader, SpecPlate, SpecRow, TxTypePill } from "@/components/explorer-v2/ui";
import { formatBytes, formatNumber, formatTime, timeAgo } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { Block } from "@/lib/pchain-explorer";

export function PchainBlock({ chain, network, id }: { chain: string; network: string; id: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: b, loading, error } = usePchainData<Block>(network, `block/${id}`);

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
      {error && <NotFound label="Block not found" id={id} />}
      {b && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Block" action={<TxTypePill type={b.blockType.replace(/Block$/, "")} />} />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                <SpecRow label="Height">#{formatNumber(Number(b.blockNumber))}</SpecRow>
                <SpecRow label="Hash">
                  <HashChip value={b.blockHash} len={64} />
                </SpecRow>
                <SpecRow label="Parent">
                  <HashChip value={b.parentHash} href={`${base}/block/${b.parentHash}`} len={24} />
                </SpecRow>
                <SpecRow label="Type">{b.blockType}</SpecRow>
                <SpecRow label="Timestamp">
                  {formatTime(b.timestamp)} · {timeAgo(b.timestamp)}
                </SpecRow>
                <SpecRow label="Transactions">{b.txCount}</SpecRow>
                <SpecRow label="Size">{formatBytes(b.blockSizeBytes)}</SpecRow>
                {b.proposerNodeId && (
                  <SpecRow label="Proposer">
                    <HashChip value={b.proposerNodeId} href={`${base}/node/${b.proposerNodeId}`} len={24} />
                  </SpecRow>
                )}
                {b.proposerPChainHeight !== undefined && b.proposerPChainHeight > 0 && (
                  <SpecRow label="P-Chain Height">{formatNumber(b.proposerPChainHeight)}</SpecRow>
                )}
              </SpecPlate>
            </Board>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader label={`Transactions · ${b.transactions.length}`} />
            <Board>
              {b.transactions.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 md:px-6">
                  — no transactions —
                </div>
              )}
              {b.transactions.map((t) => (
                <Link
                  key={t.txHash}
                  href={`${base}/tx/${t.txHash}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{t.txHash}</span>
                  <TxTypePill type={t.txType.replace(/Tx$/, "")} />
                </Link>
              ))}
            </Board>
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}
