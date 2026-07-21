"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { LiveTag, formatTimeAgo, useNowTick } from "@/components/explorer/L1ExplorerPage";
import { Board, CellLabel, SectionHeader } from "@/components/explorer-v2/ui";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { formatTokenValue } from "@/utils/formatTokenValue";
import { useContractNames, prewarmContractNames } from "@/lib/sourcify-client";

/* Full-width Blocks / Transactions list tabs for EVM chains, mirroring the
   P-Chain's. The feed is the explorer API's recent window (the same one
   the overview boards drink from), polled live. */

interface EvmBlock {
  number: string;
  timestamp: string;
  transactionCount: number;
  gasUsed: string;
  gasFee?: string;
}

interface EvmTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: string;
}

const POLL_MS = 15_000;

function useExplorerFeed<T>(
  chainId: string,
  pick: (data: Record<string, unknown>) => T,
  /** Resolve row decorations (e.g. Sourcify names) BEFORE the rows commit,
   *  so they paint decorated on their first frame. Must be internally
   *  time-capped — it sits between fetch and setState. */
  prewarm?: (items: T) => Promise<void>,
) {
  const { buildApiUrl } = useExplorer();
  const [items, setItems] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(buildApiUrl(`/api/explorer/${chainId}`, { initialLoad: "true" }));
        if (!res.ok) return;
        const data = await res.json();
        const picked = pick(data);
        if (prewarm) await prewarm(picked);
        if (!cancelled) setItems(picked);
      } catch {
        /* stale list stands */
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, buildApiUrl]);

  return items;
}

function ListSkeleton() {
  return (
    <Board>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-4 md:px-6">
          <div className="h-3 w-48 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-3 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </Board>
  );
}

export function EvmBlocksPage({
  chainId,
  chainSlug,
  tokenSymbol,
}: {
  chainId: string;
  chainSlug: string;
  tokenSymbol?: string;
}) {
  const blocks = useExplorerFeed<EvmBlock[]>(chainId, (d) => (d.blocks as EvmBlock[]) ?? []);
  const base = `/explorer/mainnet/${chainSlug}`;
  // keep relative ages flowing between polls
  useNowTick();

  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
      <section className="flex flex-col gap-4">
        <SectionHeader label="Blocks" action={<LiveTag />} />
        {blocks === null ? (
          <ListSkeleton />
        ) : (
          <Board>
            <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_1fr_0.6fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
              <span>Block</span>
              <span className="text-right">Txns</span>
              <span className="text-right">Gas Used</span>
              <span className="text-right">Fees Burned</span>
              <span className="text-right">Age</span>
            </div>
            {blocks.map((b) => (
              <Link
                key={b.number}
                href={buildBlockUrl(base, b.number)}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.2fr_0.8fr_1fr_1fr_0.6fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
              >
                <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                  #{Number(b.number).toLocaleString("en-US")}
                </span>
                <div className="font-mono text-[12px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                  <CellLabel>Txns</CellLabel>
                  {b.transactionCount}
                </div>
                <div className="min-w-0 truncate font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Gas Used</CellLabel>
                  {b.gasUsed}
                </div>
                <div className="min-w-0 truncate font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Fees Burned</CellLabel>
                  {b.gasFee && parseFloat(b.gasFee) > 0
                    ? `${formatTokenValue(b.gasFee)} ${tokenSymbol ?? ""}`
                    : "—"}
                </div>
                <div className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Age</CellLabel>
                  {formatTimeAgo(b.timestamp)}
                </div>
              </Link>
            ))}
          </Board>
        )}
      </section>
    </div>
  );
}

export function EvmTxsPage({
  chainId,
  chainSlug,
  tokenSymbol,
}: {
  chainId: string;
  chainSlug: string;
  tokenSymbol?: string;
}) {
  const router = useRouter();
  const txs = useExplorerFeed<EvmTx[]>(
    chainId,
    (d) => (d.transactions as EvmTx[]) ?? [],
    // names resolve before rows land — labelled rows paint labelled
    (items) => prewarmContractNames(chainId, items.map((t) => t.to)),
  );
  const base = `/explorer/mainnet/${chainSlug}`;
  // keep relative ages flowing between polls
  useNowTick();
  const toNames = useContractNames(chainId, (txs ?? []).map((t) => t.to));

  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
      <section className="flex flex-col gap-4">
        <SectionHeader label="Transactions" action={<LiveTag />} />
        {txs === null ? (
          <ListSkeleton />
        ) : (
          <Board>
            <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.8fr_0.6fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
              <span>Hash</span>
              <span>From</span>
              <span>To</span>
              <span className="text-right">Value</span>
              <span className="text-right">Age</span>
            </div>
            {txs.map((tx, i) => (
              <div
                key={`${tx.hash}-${i}`}
                onClick={() => router.push(buildTxUrl(base, tx.hash))}
                className="grid cursor-pointer grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.6fr_1fr_1fr_0.8fr_0.6fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
              >
                {/* full hash, width-aware: CSS truncation shows as many
                    chars as the column actually has room for */}
                <span className="truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                  {tx.hash}
                </span>
                <div className="min-w-0">
                  <CellLabel>From</CellLabel>
                  <Link
                    href={buildAddressUrl(base, tx.from)}
                    onClick={(e) => e.stopPropagation()}
                    className="block truncate font-mono text-[12px] text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                  >
                    {tx.from.slice(0, 18)}…{tx.from.slice(-8)}
                  </Link>
                </div>
                <div className="min-w-0">
                  <CellLabel>To</CellLabel>
                  {tx.to ? (
                    <Link
                      href={buildAddressUrl(base, tx.to)}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-mono text-[12px] text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                    >
                      {toNames.has(tx.to.toLowerCase()) ? (
                        <span className="font-medium animate-in fade-in duration-500">
                          {toNames.get(tx.to.toLowerCase())}
                        </span>
                      ) : (
                        <>{tx.to.slice(0, 18)}…{tx.to.slice(-8)}</>
                      )}
                    </Link>
                  ) : (
                    <span className="font-mono text-[12px] text-zinc-400">contract creation</span>
                  )}
                </div>
                <div className="min-w-0 truncate font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Value</CellLabel>
                  {formatTokenValue(tx.value)} {tokenSymbol ?? ""}
                </div>
                <div className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Age</CellLabel>
                  {formatTimeAgo(tx.timestamp)}
                </div>
              </div>
            ))}
          </Board>
        )}
      </section>
    </div>
  );
}
