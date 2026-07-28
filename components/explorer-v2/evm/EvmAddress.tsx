"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, DetailSkeleton, HashChip, SectionHeader, SpecPlate, SpecRow, idInk } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { FeedDown, MethodChip } from "./bits";
import { StatusPill } from "./EvmTx";
import { useEvmData } from "./hooks";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { AddressSummary, TxListResponse, TransferListResponse } from "@/lib/evm-explorer";

type Tab = "txs" | "transfers";

function TransferStandardPill({ standard }: { standard: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#0061E2]/35 bg-[#0061E2]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#0052bd] dark:border-[#0061E2]/50 dark:text-[#5f9dff]">
      <span className="size-1 shrink-0 bg-current opacity-80" aria-hidden />
      {standard}
    </span>
  );
}

export function EvmAddress({ network, addr }: { network: string; addr: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;
  const [tab, setTab] = useState<Tab>("txs");

  const { data: s, loading, error, retry } = useEvmData<AddressSummary>(c.chainId, `address/${addr}`, undefined, {
    retry404Ms: 15_000,
  });
  const txs = useEvmData<TxListResponse>(c.chainId, `address/${addr}/txs`, { limit: 50 });
  const transfers = useEvmData<TransferListResponse>(c.chainId, `address/${addr}/transfers`, { limit: 50 });

  const txList = txs.data?.transactions ?? [];
  const xferList = transfers.data?.transfers ?? [];

  return (
    <EvmShell network={network}>
      {loading && <DetailSkeleton label="Address" />}
      {/* a 404 means the address is unknown; anything else means the
          indexer died on us — say so instead of pretending */}
      {error === "not found" && !s && (
        <Board divide={false} className="px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            Address not found
          </p>
          <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{addr}</p>
        </Board>
      )}
      {error && error !== "not found" && !s && <FeedDown onRetry={retry} />}
      {s && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Address" />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                <SpecRow label="Address">
                  <HashChip value={s.address} len={42} />
                </SpecRow>
                <SpecRow label="Transactions">{formatNumber(s.txCount)}</SpecRow>
                {s.firstSeen ? (
                  <SpecRow label="First Seen">
                    {formatTime(s.firstSeen)} · {timeAgo(s.firstSeen)}
                  </SpecRow>
                ) : null}
                {s.lastSeen ? (
                  <SpecRow label="Last Seen">
                    {formatTime(s.lastSeen)} · {timeAgo(s.lastSeen)}
                  </SpecRow>
                ) : null}
              </SpecPlate>
            </Board>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              {(["txs", "transfers"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cn(
                    "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                    tab === t
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:text-zinc-100",
                  )}
                >
                  {t === "txs" ? "Transactions" : "Token Transfers"}
                </button>
              ))}
            </div>

            {tab === "txs" ? (
              <Board>
                {txList.length === 0 &&
                  (txs.error && !txs.loading ? (
                    <FeedDown compact onRetry={txs.retry} />
                  ) : (
                    <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                      {txs.loading ? "Loading…" : "no transactions"}
                    </div>
                  ))}
                {txList.map((t) => {
                  const outgoing = t.from.toLowerCase() === addr.toLowerCase();
                  return (
                    <Link
                      key={t.hash}
                      href={`${base}/tx/${t.hash}`}
                      className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.4fr_0.9fr_0.6fr_1.3fr_0.8fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                    >
                      <span className={`truncate font-mono text-[12px] ${idInk}`}>
                        {truncate(t.hash, 18)}
                      </span>
                      <span className="min-w-0 justify-self-start">
                        <CellLabel>Method</CellLabel>
                        <MethodChip t={t} />
                      </span>
                      <span className="justify-self-start">
                        <span
                          className={cn(
                            "border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                            outgoing
                              ? "border-[#C7911B]/40 text-[#9c7112] dark:text-[#e2b953]"
                              : "border-[#4e9a52]/40 text-[#3f7d43] dark:text-[#77c47b]",
                          )}
                        >
                          {outgoing ? "OUT" : "IN"}
                        </span>
                      </span>
                      <span className="min-w-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <CellLabel>Counterparty</CellLabel>
                        {outgoing ? "→ " : "← "}
                        {outgoing ? (t.to ? truncate(t.to, 12) : "contract") : truncate(t.from, 12)}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                        <CellLabel>Value</CellLabel>
                        {formatEther(t.value, { symbol: sym })}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                        <CellLabel>Age</CellLabel>
                        {timeAgo(t.timestamp)}
                      </span>
                    </Link>
                  );
                })}
              </Board>
            ) : (
              <Board>
                {xferList.length === 0 &&
                  (transfers.error && !transfers.loading ? (
                    <FeedDown compact onRetry={transfers.retry} />
                  ) : (
                    <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                      {transfers.loading ? "Loading…" : "no token transfers"}
                    </div>
                  ))}
                {xferList.map((x, i) => {
                  const outgoing = x.from.toLowerCase() === addr.toLowerCase();
                  return (
                    <Link
                      key={`${x.txHash}-${i}`}
                      href={`${base}/tx/${x.txHash}`}
                      className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[0.7fr_1.3fr_1.3fr_0.9fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                    >
                      <span className="justify-self-start">
                        <TransferStandardPill standard={x.standard} />
                      </span>
                      <span className="min-w-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <CellLabel>Token</CellLabel>
                        {truncate(x.token, 12)}
                      </span>
                      <span className="min-w-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <CellLabel>Counterparty</CellLabel>
                        {outgoing ? "→ " : "← "}
                        {truncate(outgoing ? x.to : x.from, 12)}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                        <CellLabel>Amount</CellLabel>
                        {x.tokenId ? `#${x.tokenId}` : x.amount}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                        <CellLabel>Age</CellLabel>
                        {timeAgo(x.timestamp)}
                      </span>
                    </Link>
                  );
                })}
              </Board>
            )}
          </section>
        </div>
      )}
    </EvmShell>
  );
}
