"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";
import { LiveTag, formatTimeAgo, useNowTick } from "@/components/explorer/L1ExplorerPage";
import { Board, CellLabel, SectionHeader } from "@/components/explorer-v2/ui";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { formatTokenValue } from "@/utils/formatTokenValue";
import { useVerifiedContracts, functionNameFromAbi, prewarmContractNames } from "@/lib/sourcify-client";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";

/* Full-width Blocks / Transactions list tabs for EVM chains, mirroring the
   P-Chain's. The feed is the explorer API's recent window (the same one
   the overview boards drink from), polled live. */

interface EvmBlock {
  number: string;
  timestamp: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  gasFee?: string;
}

interface EvmTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: string;
  /** 4-byte function selector from the feed ("0x" for plain transfers) */
  input?: string;
}

const POLL_MS = 15_000;

/* Gas capacity, toned like a gauge: quiet grey while there's headroom,
   green as the block carries real load, amber when it's working, brand
   red when it's slammed. */
function gasCapacity(gasUsed: string, gasLimit: string): { pct: number; tone: string } | null {
  const used = Number(gasUsed.replace(/,/g, ""));
  const limit = Number(gasLimit?.replace(/,/g, "") ?? "");
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  const pct = (used / limit) * 100;
  const tone =
    pct >= 80 ? "#E6212F" : pct >= 50 ? "#f59e0b" : pct >= 25 ? "#10b981" : "#a1a1aa";
  return { pct, tone };
}

function CapacityGauge({ gasUsed, gasLimit }: { gasUsed: string; gasLimit: string }) {
  const cap = gasCapacity(gasUsed, gasLimit);
  if (!cap) return null;
  return (
    <span className="inline-flex items-center gap-1.5" title={`${gasUsed} / ${gasLimit} gas`}>
      <span className="h-1 w-10 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <span
          className="block h-full"
          style={{ width: `${Math.min(100, Math.max(2, cap.pct))}%`, background: cap.tone }}
        />
      </span>
      <span className="w-9 text-right font-mono text-[11px] tabular-nums" style={{ color: cap.tone }}>
        {cap.pct < 1 ? "<1" : Math.round(cap.pct)}%
      </span>
    </span>
  );
}

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
  const network = useExplorerNetwork();
  const blocks = useExplorerFeed<EvmBlock[]>(chainId, (d) => (d.blocks as EvmBlock[]) ?? []);
  const base = `/explorer/${network}/${chainSlug}`;
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
                <div className="min-w-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  <CellLabel>Gas Used</CellLabel>
                  <span className="flex items-center gap-2.5 md:justify-end">
                    <span className="truncate">{b.gasUsed}</span>
                    <CapacityGauge gasUsed={b.gasUsed} gasLimit={b.gasLimit} />
                  </span>
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
  const network = useExplorerNetwork();
  const txs = useExplorerFeed<EvmTx[]>(
    chainId,
    (d) => (d.transactions as EvmTx[]) ?? [],
    // names resolve before rows land — labelled rows paint labelled
    (items) => prewarmContractNames(chainId, items.map((t) => t.to)),
  );
  const base = `/explorer/${network}/${chainSlug}`;
  // keep relative ages flowing between polls
  useNowTick();
  // full verified records: names label the To column, ABIs name method
  // selectors the local generated registry doesn't know
  const toContracts = useVerifiedContracts(chainId, (txs ?? []).map((t) => t.to));

  // Method label from the 4-byte selector: local registry first, then the
  // verified ABI of the called contract, then the raw selector.
  const methodLabel = (tx: EvmTx): string => {
    if (!tx.input || tx.input === "0x") return "Transfer";
    const selector = tx.input.slice(0, 10).toLowerCase();
    return (
      getFunctionBySelector(selector)?.name ??
      functionNameFromAbi(tx.to ? toContracts.get(tx.to.toLowerCase())?.abi : null, selector) ??
      selector
    );
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
      <section className="flex flex-col gap-4">
        <SectionHeader label="Transactions" action={<LiveTag />} />
        {txs === null ? (
          <ListSkeleton />
        ) : (
          <Board>
            <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_1fr_0.8fr_0.6fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
              <span>Hash</span>
              <span>Method</span>
              <span>From</span>
              <span>To</span>
              <span className="text-right">Value</span>
              <span className="text-right">Age</span>
            </div>
            {txs.map((tx, i) => (
              <div
                key={`${tx.hash}-${i}`}
                onClick={() => router.push(buildTxUrl(base, tx.hash))}
                className="grid cursor-pointer grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.4fr_0.8fr_1fr_1fr_0.8fr_0.6fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
              >
                {/* full hash, width-aware: CSS truncation shows as many
                    chars as the column actually has room for */}
                <span className="truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                  {tx.hash}
                </span>
                <div className="min-w-0">
                  <CellLabel>Method</CellLabel>
                  <span
                    className="inline-block max-w-full truncate border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 align-middle font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    title={tx.input && tx.input !== "0x" ? tx.input.slice(0, 10) : undefined}
                  >
                    {methodLabel(tx)}
                  </span>
                </div>
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
                      {toContracts.get(tx.to.toLowerCase())?.name ? (
                        <span className="font-medium animate-in fade-in duration-500">
                          {toContracts.get(tx.to.toLowerCase())!.name}
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
