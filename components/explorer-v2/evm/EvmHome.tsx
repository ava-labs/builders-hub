"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { BlockTape, BlockTapeSkeleton, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import { Board, SectionHeader, StatCell, StatDash, StatFigure } from "@/components/explorer-v2/ui";
import { formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatGwei } from "./format";
import { GasFill, MethodChip } from "./bits";
import { StatusPill } from "./EvmTx";
import { EvmOverviewStats } from "./EvmOverviewStats";
import { CchainActivityChart, TxHistoryChart } from "./EvmActivity";
import { useEvmData, LIVE_REFRESH_MS } from "./hooks";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { StatsResponse, TxListResponse, BlockListResponse } from "@/lib/evm-explorer";
import { formatPrice, formatAvaxPrice } from "@/utils/formatPrice";
import { formatMarketCap } from "@/lib/utils/format-market-cap";

/* Token market data — CoinGecko by way of the legacy explorer route's
 * priceOnly mode (server-side cached). Chain data stays on the EVM explorer
 * API; this is the one figure that isn't on-chain. */
interface PriceData {
  price: number;
  priceInAvax?: number;
  change24h: number;
  marketCap: number;
}

function usePrice(chainId: string | number | undefined): {
  price: PriceData | null;
  /** the fetch resolved — distinguishes "loading" from "token isn't listed",
   *  so USD-or-native cells can hold instead of flipping units */
  settled: boolean;
} {
  const [state, setState] = useState<{ price: PriceData | null; settled: boolean }>({
    price: null,
    settled: false,
  });
  useEffect(() => {
    if (chainId == null) return;
    let cancelled = false;
    setState({ price: null, settled: false });
    fetch(`/api/explorer/${chainId}?priceOnly=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { price?: PriceData } | null) => {
        if (!cancelled) setState({ price: data?.price ?? null, settled: true });
      })
      .catch(() => {
        if (!cancelled) setState({ price: null, settled: true });
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);
  return state;
}

/* wei (decimal string) → the tx list's value column, adaptive precision */
function fmtValue(wei: string): string {
  const v = Number(wei) / 1e18;
  if (!Number.isFinite(v) || v === 0) return "0";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.0001) return v.toFixed(4);
  return "<0.0001";
}

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
    </span>
  );
}

function RowSkeleton({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex h-11 items-center justify-between px-5 md:px-6">
          <div className="h-3 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-3 w-12 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </>
  );
}

export function EvmHome({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;
  const live = { refreshMs: LIVE_REFRESH_MS };

  const stats = useEvmData<StatsResponse>(c.chainId, "stats", undefined, { refreshMs: LIVE_REFRESH_MS * 2 });
  const txs = useEvmData<TxListResponse>(c.chainId, "txs", { limit: 8 }, live);
  const blocks = useEvmData<BlockListResponse>(c.chainId, "blocks", { limit: 20 }, live);

  const s = stats.data;
  const blockList = blocks.data?.blocks ?? [];
  const txList = txs.data?.transactions ?? [];
  const { price, settled: priceSettled } = usePrice(c.chainId);
  const isCchain = String(c.chainId) === "43114";

  // Cadence figures from the freshest slice of Ash's blocks feed: the list
  // arrives tip-first, so span = newest − oldest timestamp.
  const span =
    blockList.length >= 2 ? blockList[0].timestamp - blockList[blockList.length - 1].timestamp : 0;
  const recentTps =
    span > 0 ? blockList.reduce((acc, b) => acc + b.txCount, 0) / span : null;
  const avgBlockTime = span > 0 ? span / (blockList.length - 1) : null;

  const tapeBlocks: TapeBlock[] = blockList.map((b) => ({
    key: String(b.number),
    number: formatNumber(b.number),
    txCount: b.txCount,
    ago: timeAgo(b.timestamp),
    fill: b.gasLimit > 0 ? Math.min(1, b.gasUsed / b.gasLimit) : 0,
    href: `${base}/block/${b.number}`,
  }));

  const noData = !stats.loading && (stats.error === "not found" || (s != null && s.tipHeight === 0));

  return (
    <EvmShell
      network={network}
      aside={
        s && !noData ? (
          <Link href={`${base}/blocks`} className="group flex flex-col items-end gap-1.5">
            <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              <LiveDot />
              Chain Height
            </span>
            <StatFigure
              value={s.tipHeight}
              className="text-3xl transition-colors group-hover:text-[#E6212F] md:text-[2.5rem]"
            />
          </Link>
        ) : undefined
      }
    >
      {noData ? (
        <Board divide={false} className="px-6 py-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            No data indexed yet for this chain
          </p>
        </Board>
      ) : (
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            {blocks.loading && !blockList.length ? (
              <BlockTapeSkeleton />
            ) : (
              tapeBlocks.length > 0 && <BlockTape blocks={tapeBlocks} />
            )}

            {/* the ledger — live figures (EVM explorer API + CoinGecko)
                riding as the first rows of the Etherscan-grade readings
                board: totals, the last day with its day-over-day move,
                and what it cost. Every cell doors into its tab. */}
            <EvmOverviewStats
              chainId={c.chainId}
              base={base}
              symbol={sym}
              usdPrice={price?.price ?? null}
              usdSettled={priceSettled}
              liveCells={[
                ...(price
                  ? [
                      {
                        label: "Price",
                        live: true,
                        value: formatPrice(price.price),
                        sub: (
                          <>
                            {price.priceInAvax ? `@ ${formatAvaxPrice(price.priceInAvax)} AVAX ` : ""}
                            <span className={price.change24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]"}>
                              {price.change24h >= 0 ? "+" : ""}
                              {price.change24h.toFixed(2)}%
                            </span>
                          </>
                        ),
                      },
                      {
                        label: "Market Cap",
                        live: true,
                        value: price.marketCap ? formatMarketCap(price.marketCap) : "—",
                      },
                    ]
                  : []),
                {
                  label: "Avg Block Time",
                  live: true,
                  value: avgBlockTime != null ? `${avgBlockTime.toFixed(2)} s` : "—",
                  sub:
                    recentTps != null
                      ? `${recentTps.toFixed(1)} TPS · last ${blockList.length} blocks`
                      : undefined,
                },
                {
                  label: "Latest Block",
                  value: blockList[0] ? timeAgo(blockList[0].timestamp) : "—",
                  href: `${base}/blocks`,
                  live: true,
                },
              ]}
            />
          </div>

          {/* what the chain is FOR — the activity breakdown on the page
              clock: stacked behavior bands for the C-Chain, the accent
              area for everyone else. Both door into the Transactions tab. */}
          {isCchain ? (
            <CchainActivityChart href={`${base}/txs`} />
          ) : (
            <TxHistoryChart chainId={c.chainId} href={`${base}/txs`} />
          )}

          <div className="grid gap-12 lg:grid-cols-2">
            {/* Latest blocks */}
            <section className="flex flex-col gap-4">
              <SectionHeader
                label="Latest Blocks"
                action={
                  <Link
                    href={`${base}/blocks`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                  >
                    View all →
                  </Link>
                }
              />
              <Board>
                {blocks.loading && !blockList.length && <RowSkeleton n={8} />}
                {blockList.slice(0, 8).map((b) => (
                  <Link
                    key={b.number}
                    href={`${base}/block/${b.number}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-2 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    {/* the identity column: height over its age, like the tx rows */}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-mono text-[12px] tabular-nums text-[#0061E2] dark:text-[#5f9dff]">
                        #{formatNumber(b.number)}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                        {timeAgo(b.timestamp)}
                      </span>
                    </span>
                    <span className="justify-self-end">
                      <GasFill used={b.gasUsed} limit={b.gasLimit} />
                    </span>
                    <span className="text-right font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatNumber(b.txCount)} tx
                    </span>
                  </Link>
                ))}
              </Board>
            </section>

            {/* Latest transactions */}
            <section className="flex flex-col gap-4">
              <SectionHeader
                label="Latest Transactions"
                action={
                  <Link
                    href={`${base}/txs`}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                  >
                    View all →
                  </Link>
                }
              />
              <Board>
                {txs.loading && !txList.length && <RowSkeleton n={8} />}
                {txList.map((t) => (
                  <Link
                    key={t.hash}
                    href={`${base}/tx/${t.hash}`}
                    className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,6.5rem)_auto] items-center gap-3 px-5 py-2 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    {/* the identity column: hash over its age */}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-mono text-[12px] text-[#0061E2] dark:text-[#5f9dff]">
                        {truncate(t.hash, 10)}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                        {timeAgo(t.timestamp)}
                      </span>
                    </span>
                    {/* the parties, stacked */}
                    <span className="flex min-w-0 flex-col gap-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="truncate">
                        <span className="text-zinc-400 dark:text-zinc-500">from </span>
                        {truncate(t.from, 8)}
                      </span>
                      <span className="truncate">
                        <span className="text-zinc-400 dark:text-zinc-500">to </span>
                        {t.to ? truncate(t.to, 8) : "contract creation"}
                      </span>
                    </span>
                    {/* what it did — and whether it worked */}
                    <span className="flex min-w-0 flex-col items-start gap-1">
                      <MethodChip t={t} />
                      {!t.success && <StatusPill success={false} />}
                    </span>
                    <span className="text-right font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      {fmtValue(t.value)} {sym}
                    </span>
                  </Link>
                ))}
              </Board>
            </section>
          </div>
        </div>
      )}
    </EvmShell>
  );
}
