"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, DetailSkeleton, HashChip, SectionHeader, SpecLine, SpecSheet, StatCell, StatStrip, SubjectHeadline, HEAD, ROW, FIG, UNIT, idInk, fnInk, RowDoor } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther, formatNano } from "./format";
import { FeedDown, useMethodNames } from "./bits";
import { useEvmData, usePrice, usdOfWei } from "./hooks";
import { NotFound } from "./EvmTx";
import { PhaseTrack } from "./LiveBoards";
import { useBlockLifecycle } from "./useBlockLifecycle";
import { useRpcBlock } from "./useRpcBlock";
import { CONTINUOUS_EXECUTION_CHAINS } from "./useHeadStream";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { knownAddress, type BlockDetail } from "@/lib/evm-explorer";
import { useTokenList } from "@/lib/token-list";
import { TokenMark } from "./TokenMark";

/* One block. The readings a block is judged by sit in a strip (how many
   txs, how full, what it cost, where it stands in Continuous Execution);
   its identifiers sit in a compact sheet beneath, label and value side
   by side; its transactions in a headed table. Previous and next live in
   the section header, where a reader's hand already is. */


export function EvmBlock({ network, id }: { network: string; id: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  const indexed = useEvmData<BlockDetail>(c.chainId, `block/${id}`, undefined, { retry404Ms: 20_000 });

  // C-Chain: the RPC is the primary source. The indexer trails the chain
  // (seconds to a minute) and the live boards link to blocks the moment
  // they are sealed, so the indexer alone would 404 on every fresh block.
  const liveRpc = CONTINUOUS_EXECUTION_CHAINS.has(String(c.chainId)) ? c.rpcUrl : undefined;
  const fromRpc = useRpcBlock(liveRpc, id);
  const b = fromRpc.data ?? indexed.data;
  const loading = !b && (indexed.loading || fromRpc.loading);
  const error = b || loading ? null : indexed.error ?? (liveRpc ? "not found" : null);
  const retry = indexed.retry;

  // Continuous Execution lifecycle, from the RPC, C-Chain only
  const life = useBlockLifecycle(liveRpc, b?.number ?? null);
  // hidden for blocks sealed before Helicon; they carry no settledHeight
  const showLife = !!liveRpc && life.supported;

  const tokens = useTokenList(c.chainId);
  const method = useMethodNames(c.chainId, b?.transactions ?? []);
  const burn = b ? knownAddress(b.miner) : undefined;
  const gasPct = b && b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0;

  // what the block cost, in the token and in dollars. Receipts give the
  // exact sum (RPC path); the indexer path only knows gas × base fee,
  // which on the C-Chain is the burn floor, so it is marked as such.
  const { price } = usePrice(c.chainId);
  const usd = price?.price ?? null;
  const exactFees = b && b.transactions.length > 0 && b.transactions.every((t) => t.feeWei);
  const feesWei = b
    ? exactFees
      ? b.transactions.reduce((acc, t) => acc + BigInt(t.feeWei!), 0n)
      : BigInt(b.gasUsed) * BigInt(b.baseFeePerGas || "0")
    : 0n;

  return (
    <EvmShell network={network}>
      {loading && <DetailSkeleton label="Block" />}
      {/* only a real 404 is "not found"; an indexer outage says so */}
      {error === "not found" && !b && <NotFound label="Block not found" id={id} />}
      {error && error !== "not found" && !b && <FeedDown onRetry={retry} />}
      {b && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader
              label="Block"
              action={
                <span className="flex shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {b.number > 0 && (
                    <Link href={`${base}/block/${b.number - 1}`} className="transition-colors hover:text-[#E6212F]">
                      ← #{formatNumber(b.number - 1)}
                    </Link>
                  )}
                  <Link href={`${base}/block/${b.number + 1}`} className="transition-colors hover:text-[#E6212F]">
                    #{formatNumber(b.number + 1)} →
                  </Link>
                </span>
              }
            />

            {/* the subject, and when it happened, on one baseline */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
              <SubjectHeadline value={String(b.number)} display={`#${formatNumber(b.number)}`} copyLabel="Copy block number" />
              <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatTime(b.timestamp)}
                <span className="text-zinc-400 dark:text-zinc-500"> · {timeAgo(b.timestamp)}</span>
              </span>
            </div>

            {/* the readings */}
            <StatStrip cols={5}>
              <StatCell label="Transactions" href={b.txCount > 0 ? "#transactions" : undefined}>
                <span className={FIG}>{formatNumber(b.txCount)}</span>
              </StatCell>
              <StatCell
                label="Gas Used"
                sub={
                  <span className="flex items-center gap-2">
                    <span className="h-1 w-24 bg-zinc-100 dark:bg-zinc-900">
                      <span
                        className={cn("block h-full", gasPct >= 90 ? "bg-[#E6212F]" : "bg-[#A2AFB2] dark:bg-zinc-600")}
                        style={{ width: `${Math.max(gasPct > 0 ? 1.5 : 0, Math.min(100, gasPct)).toFixed(1)}%` }}
                      />
                    </span>
                    of {formatNumber(b.gasLimit)}
                  </span>
                }
              >
                <span className={FIG}>
                  {gasPct.toFixed(1)}
                  <span className={UNIT}>%</span>
                </span>
              </StatCell>
              <StatCell label="Base Fee" href={`${base}/gas/base-fee`}>
                <span className={FIG}>{b.baseFeePerGas && b.baseFeePerGas !== "0" ? formatNano(b.baseFeePerGas, sym) : "—"}</span>
              </StatCell>
              <StatCell
                label={String(c.chainId) === "43114" || String(c.chainId) === "43113" ? "Fees Burned" : "Fees Paid"}
                href={`${base}/gas`}
                sub={
                  feesWei > 0n ? (
                    <>
                      {usdOfWei(feesWei, usd) ?? ""}
                      {!exactFees && b.transactions.length > 0 && (
                        <span title="gas used × base fee; priority fees not included">{usd ? " · " : ""}at base fee</span>
                      )}
                    </>
                  ) : undefined
                }
              >
                <span className={FIG}>
                  {formatEther(feesWei.toString(), { decimals: feesWei >= 10n ** 18n ? 3 : 5 })}{" "}
                  <span className={UNIT}>{sym}</span>
                </span>
              </StatCell>
              {showLife ? (
                <StatCell
                  label="State Root"
                  live={life.phase !== "settled"}
                  href={life.settledBy ? `${base}/block/${life.settledBy}` : undefined}
                  sub={
                    life.ready ? (
                      <span className="flex items-center gap-2">
                        <PhaseTrack phase={life.phase} label={false} />
                        {life.settledBy ? `in #${formatNumber(life.settledBy)} · ` : ""}block is final
                      </span>
                    ) : undefined
                  }
                >
                  <span className={FIG}>{life.settledBy ? "Committed" : life.ready ? "Executing" : "…"}</span>
                </StatCell>
              ) : (
                <StatCell label="Age">
                  <span className={FIG}>{timeAgo(b.timestamp)}</span>
                </StatCell>
              )}
            </StatStrip>

            {/* the identifiers */}
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label="Hash">
                  <HashChip value={b.hash} len={66} />
                </SpecLine>
                <SpecLine label="Parent">
                  <HashChip value={b.parentHash} href={`${base}/block/${b.number - 1}`} len={66} />
                </SpecLine>
                <SpecLine label="Gas Limit">{formatNumber(b.gasLimit)}</SpecLine>
                {b.miner && (
                  <SpecLine label="Fee Recipient">
                    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
                      {burn && <span title={burn.note}>{burn.label}</span>}
                      <HashChip
                        value={b.miner}
                        href={`${base}/address/${b.miner}`}
                        len={66}
                        className={burn ? "text-zinc-400 dark:text-zinc-500" : undefined}
                      />
                    </span>
                  </SpecLine>
                )}
              </SpecSheet>
            </Board>
          </section>

          <section id="transactions" className="flex flex-col gap-4">
            <SectionHeader label={`Transactions · ${b.transactions.length}`} />
            <Board>
              {b.transactions.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no transactions
                </div>
              )}
              {b.transactions.length > 0 && (
                <div className={cn(HEAD, "grid-cols-[0.75rem_minmax(0,1.4fr)_minmax(0,9rem)_minmax(0,1.6fr)_7rem_minmax(0,9rem)_6rem]")}>
                  <span />
                  <span>Hash</span>
                  <span>Method</span>
                  <span>From → To</span>
                  <span className="text-right">Gas Used</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">USD</span>
                </div>
              )}
              {b.transactions.map((t) => {
                const m = method(t);
                const value = Number(t.value);
                return (
                  <RowDoor key={t.hash} href={`${base}/tx/${t.hash}`} className={cn(ROW, "md:grid-cols-[0.75rem_minmax(0,1.4fr)_minmax(0,9rem)_minmax(0,1.6fr)_7rem_minmax(0,9rem)_6rem]")}>
                    <span className="flex h-3 w-3 items-center justify-center">
                      {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
                    </span>
                    <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{truncate(t.hash, 6)}</span>
                    <span className="min-w-0">
                      <CellLabel>Method</CellLabel>
                      <span
                        className={cn("block truncate font-mono text-[12px]", m.named ? fnInk : "text-zinc-400 dark:text-zinc-500")}
                        title={t.methodId || undefined}
                      >
                        {m.label}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                      <CellLabel>From → To</CellLabel>
                      <span className="truncate">{truncate(t.from, 8)}</span>
                      <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                      {t.to && tokens.get(t.to.toLowerCase()) ? (
                        <TokenMark address={t.to} chainId={c.chainId} token={tokens.get(t.to.toLowerCase())!} size={14} />
                      ) : (
                        <span className="truncate">{t.to ? truncate(t.to, 8) : "contract creation"}</span>
                      )}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                      <CellLabel>Gas Used</CellLabel>
                      {formatNumber(t.gasUsed)}
                    </span>
                    <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", value > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600")}>
                      <CellLabel>Value</CellLabel>
                      {value > 0 ? (
                        <>
                          {formatEther(t.value, { decimals: 4 })} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{sym}</span>
                        </>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
                      {(value > 0 && usdOfWei(t.value, usd)) || ""}
                    </span>
                  </RowDoor>
                );
              })}
            </Board>
          </section>
        </div>
      )}
    </EvmShell>
  );
}
