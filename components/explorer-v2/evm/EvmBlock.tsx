"use client";

import Link from "next/link";
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
  idInk,
} from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther, formatGwei, gasUsedPct } from "./format";
import { FeedDown, MethodChip } from "./bits";
import { useEvmData } from "./hooks";
import { NotFound, StatusPill } from "./EvmTx";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { BlockDetail } from "@/lib/evm-explorer";

export function EvmBlock({ network, id }: { network: string; id: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;
  const { data: b, loading, error, retry } = useEvmData<BlockDetail>(c.chainId, `block/${id}`, undefined, {
    retry404Ms: 20_000,
  });

  return (
    <EvmShell network={network}>
      {loading && <DetailSkeleton label="Block" />}
      {/* only a real 404 is "not found" — an indexer outage says so */}
      {error === "not found" && !b && <NotFound label="Block not found" id={id} />}
      {error && error !== "not found" && !b && <FeedDown onRetry={retry} />}
      {b && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Block" />
            <SubjectHeadline
              prefix="Height"
              value={String(b.number)}
              display={`#${formatNumber(b.number)}`}
              copyLabel="Copy block number"
            />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                <SpecRow label="Hash">
                  <HashChip value={b.hash} len={64} />
                </SpecRow>
                <SpecRow label="Parent">
                  <HashChip value={b.parentHash} href={`${base}/block/${b.number - 1}`} len={24} />
                </SpecRow>
                <SpecRow label="Timestamp">
                  {formatTime(b.timestamp)} · {timeAgo(b.timestamp)}
                </SpecRow>
                <SpecRow label="Transactions">{formatNumber(b.txCount)}</SpecRow>
                <SpecRow label="Gas Used">
                  {formatNumber(b.gasUsed)} · {gasUsedPct(b.gasUsed, b.gasLimit)}
                </SpecRow>
                <SpecRow label="Gas Limit">{formatNumber(b.gasLimit)}</SpecRow>
                {b.baseFeePerGas && b.baseFeePerGas !== "0" && (
                  <SpecRow label="Base Fee">{formatGwei(b.baseFeePerGas)}</SpecRow>
                )}
                {b.miner && (
                  <SpecRow label="Fee Recipient">
                    <HashChip value={b.miner} href={`${base}/address/${b.miner}`} len={42} />
                  </SpecRow>
                )}
              </SpecPlate>
            </Board>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader label={`Transactions · ${b.transactions.length}`} />
            <Board>
              {b.transactions.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no transactions
                </div>
              )}
              {b.transactions.map((t) => (
                <Link
                  key={t.hash}
                  href={`${base}/tx/${t.hash}`}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.5fr_8rem_1.4fr_0.9fr_5rem] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className={`min-w-0 truncate font-mono text-[12px] ${idInk}`}>
                    {truncate(t.hash, 20)}
                  </span>
                  <span className="min-w-0">
                    <CellLabel>Method</CellLabel>
                    <MethodChip t={t} />
                  </span>
                  <span className="min-w-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    <CellLabel>From → To</CellLabel>
                    {truncate(t.from, 8)} → {t.to ? truncate(t.to, 8) : "contract"}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    <CellLabel>Value</CellLabel>
                    {formatEther(t.value, { symbol: sym })}
                  </span>
                  <span className="md:text-right">
                    <StatusPill success={t.success} />
                  </span>
                </Link>
              ))}
            </Board>
          </section>
        </div>
      )}
    </EvmShell>
  );
}
