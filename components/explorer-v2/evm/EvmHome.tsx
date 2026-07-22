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

function usePrice(chainId: string | number | undefined): PriceData | null {
  const [price, setPrice] = useState<PriceData | null>(null);
  useEffect(() => {
    if (chainId == null) return;
    let cancelled = false;
    fetch(`/api/explorer/${chainId}?priceOnly=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { price?: PriceData } | null) => {
        if (!cancelled && data?.price) setPrice(data.price);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chainId]);
  return price;
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
  const price = usePrice(c.chainId);
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

            {/* the ledger — chain figures from the EVM explorer API, market
                figures (price, cap) from CoinGecko when the token is listed.
                Two 3-up rows when market data exists, one 4-up row when not. */}
            <Board>
              {price && (
                <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
                  <StatCell
                    label="PRICE"
                    sub={
                      <>
                        {price.priceInAvax ? `@ ${formatAvaxPrice(price.priceInAvax)} AVAX ` : ""}
                        <span className={price.change24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]"}>
                          {price.change24h >= 0 ? "+" : ""}
                          {price.change24h.toFixed(2)}%
                        </span>
                      </>
                    }
                  >
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {formatPrice(price.price)}
                    </span>
                  </StatCell>
                  <StatCell label="MARKET CAP">
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {price.marketCap ? formatMarketCap(price.marketCap) : "—"}
                    </span>
                  </StatCell>
                  <StatCell
                    label="AVG BLOCK TIME"
                    sub={avgBlockTime != null ? `last ${blockList.length} blocks` : undefined}
                  >
                    {avgBlockTime != null ? (
                      <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                        {avgBlockTime.toFixed(2)} s
                      </span>
                    ) : (
                      <StatDash />
                    )}
                  </StatCell>
                </div>
              )}
              <div
                className={`grid grid-cols-1 divide-y divide-zinc-200 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 ${
                  price ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
                }`}
              >
                <StatCell
                  label="TRANSACTIONS · 24H"
                  live
                  href={`${base}/txs`}
                  sub={recentTps != null ? `${recentTps.toFixed(1)} TPS · last ${blockList.length} blocks` : undefined}
                >
                  {s ? <StatFigure value={s.txCount24h} /> : <StatDash />}
                </StatCell>
                <StatCell label="GAS PRICE" href={`${base}/gas`} sub="gas market →">
                  {s ? (
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {formatGwei(s.gasPriceWei)}
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
                <StatCell label="LATEST BLOCK" href={`${base}/blocks`}>
                  {blockList[0] ? (
                    <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {timeAgo(blockList[0].timestamp)}
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
                {!price && (
                  <StatCell
                    label="AVG BLOCK TIME"
                    sub={avgBlockTime != null ? `last ${blockList.length} blocks` : undefined}
                  >
                    {avgBlockTime != null ? (
                      <span className="whitespace-nowrap font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                        {avgBlockTime.toFixed(2)} s
                      </span>
                    ) : (
                      <StatDash />
                    )}
                  </StatCell>
                )}
              </div>
            </Board>
          </div>

          {/* what the chain is FOR — the activity breakdown the pre-EvmHome
              overview carried: stacked behavior bands for the C-Chain, the
              accent-colored tx line for everyone else. */}
          {isCchain ? <CchainActivityChart /> : <TxHistoryChart chainId={c.chainId} />}

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
                    className="grid h-11 grid-cols-[minmax(0,1fr)_3.5rem_5.5rem_3.5rem] items-center gap-3 px-5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      #{formatNumber(b.number)}
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatNumber(b.txCount)} tx
                    </span>
                    <span className="justify-self-end">
                      <GasFill used={b.gasUsed} limit={b.gasLimit} />
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {timeAgo(b.timestamp)}
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
                    className="grid h-11 grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 px-5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {/* failures are rare enough that the pill only appears
                          when it has something to say */}
                      {!t.success && <StatusPill success={false} />}
                      <MethodChip t={t} />
                    </span>
                    <span className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {truncate(t.from, 8)} → {t.to ? truncate(t.to, 8) : "contract"}
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {timeAgo(t.timestamp)}
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
