"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import {
  Board,
  CellLabel,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  SubjectHeadline,
} from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther, formatGwei } from "./format";
import { FeedDown } from "./bits";
import { useEvmData } from "./hooks";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { TxDetail } from "@/lib/evm-explorer";

/* Shared 404 panel for the EVM detail pages (tx / block / address). */
export function NotFound({ label, id }: { label: string; id?: string }) {
  return (
    <Board divide={false} className="px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</p>
      {id && <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{id}</p>}
    </Board>
  );
}

export function StatusPill({ success }: { success: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        success
          ? "border-[#4e9a52]/40 bg-[#4e9a52]/10 text-[#3f7d43] dark:border-[#4e9a52]/45 dark:text-[#77c47b]"
          : "border-[#E6212F]/40 bg-[#E6212F]/10 text-[#c11824] dark:border-[#E6212F]/50 dark:text-[#ff6b73]",
      )}
    >
      <span className="size-1 shrink-0 bg-current opacity-80" aria-hidden />
      {success ? "Success" : "Failed"}
    </span>
  );
}

function txFeeWei(gasUsed: number, gasPriceWei: string): string {
  try {
    return (BigInt(gasUsed) * BigInt(gasPriceWei)).toString();
  } catch {
    return "0";
  }
}

export function EvmTx({ network, txHash }: { network: string; txHash: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;
  // fresh txs exist on-chain seconds before the indexer ingests them — retry a
  // 404 for a short window before giving up (mirrors the pchain detail pages)
  const { data: t, loading, error, retry } = useEvmData<TxDetail>(c.chainId, `tx/${txHash}`, undefined, {
    retry404Ms: 20_000,
  });

  return (
    <EvmShell network={network}>
      {loading && <DetailSkeleton label="Transaction" />}
      {/* only a real 404 is "not found" — an indexer outage says so */}
      {error === "not found" && !t && <NotFound label="Transaction not found" id={txHash} />}
      {error && error !== "not found" && !t && <FeedDown onRetry={retry} />}
      {t && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Transaction" action={<StatusPill success={t.success} />} />
            <SubjectHeadline value={t.hash} copyLabel="Copy transaction hash" />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                <SpecRow label="Block">
                  <HashChip value={`#${formatNumber(t.blockNumber)}`} href={`${base}/block/${t.blockNumber}`} mono={false} />
                </SpecRow>
                <SpecRow label="Timestamp">
                  {formatTime(t.timestamp)} · {timeAgo(t.timestamp)}
                </SpecRow>
                <SpecRow label="From">
                  <HashChip value={t.from} href={`${base}/address/${t.from}`} len={42} />
                </SpecRow>
                {t.to ? (
                  <SpecRow label="To">
                    <HashChip value={t.to} href={`${base}/address/${t.to}`} len={42} />
                  </SpecRow>
                ) : t.contractAddress ? (
                  <SpecRow label="Contract Created">
                    <HashChip value={t.contractAddress} href={`${base}/address/${t.contractAddress}`} len={42} />
                  </SpecRow>
                ) : (
                  <SpecRow label="To">Contract Creation</SpecRow>
                )}
                <SpecRow label="Value">{formatEther(t.value, { symbol: sym })}</SpecRow>
                <SpecRow label="Transaction Fee">
                  {formatEther(txFeeWei(t.gasUsed, t.gasPrice), { symbol: sym })}
                </SpecRow>
                <SpecRow label="Gas Price">{formatGwei(t.gasPrice)}</SpecRow>
                <SpecRow label="Gas Used">{formatNumber(t.gasUsed)}</SpecRow>
                <SpecRow label="Nonce">{formatNumber(t.nonce)}</SpecRow>
                <SpecRow label="Type">{t.type}</SpecRow>
                {t.input && t.input !== "0x" && (
                  <SpecRow label="Input" align="start">
                    <span className="block max-w-full break-all font-mono text-[12px] text-zinc-600 dark:text-zinc-400">
                      {truncate(t.input, 60)}
                    </span>
                  </SpecRow>
                )}
              </SpecPlate>
            </Board>
          </section>

          {t.internalTxns.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Internal Transactions · ${t.internalTxns.length}`} />
              <Board>
                <div className="hidden grid-cols-[1fr_1fr_0.8fr_0.6fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                  <span>From</span>
                  <span>To</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Type</span>
                </div>
                {t.internalTxns.map((it, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[1fr_1fr_0.8fr_0.6fr] md:items-center md:px-6"
                  >
                    <span className="min-w-0">
                      <CellLabel>From</CellLabel>
                      <HashChip value={it.from} href={`${base}/address/${it.from}`} len={16} />
                    </span>
                    <span className="min-w-0">
                      <CellLabel>To</CellLabel>
                      {it.to ? <HashChip value={it.to} href={`${base}/address/${it.to}`} len={16} /> : "—"}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                      <CellLabel>Value</CellLabel>
                      {formatEther(it.value, { symbol: sym })}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-400 md:text-right dark:text-zinc-500">
                      <CellLabel>Type</CellLabel>
                      {it.callType || "call"}
                    </span>
                  </div>
                ))}
              </Board>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <SectionHeader label={`Event Logs · ${t.logs.length}`} />
            <Board>
              {t.logs.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no logs emitted
                </div>
              )}
              {t.logs.map((log) => (
                <div key={log.logIndex} className="flex flex-col gap-2 px-5 py-4 md:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <HashChip value={log.address} href={`${base}/address/${log.address}`} len={42} />
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      #{log.logIndex}
                    </span>
                  </div>
                  {log.topics.map((topic, ti) => (
                    <p key={ti} className="break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="text-zinc-400 dark:text-zinc-600">[{ti}] </span>
                      {topic}
                    </p>
                  ))}
                  {log.data && log.data !== "0x" && (
                    <p className="break-all font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                      {truncate(log.data, 80)}
                    </p>
                  )}
                </div>
              ))}
            </Board>
          </section>
        </div>
      )}
    </EvmShell>
  );
}
