"use client";

import Link from "next/link";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { BlockTape, BlockTapeSkeleton, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import { Board, SectionHeader, StatCell, StatDash, StatFigure } from "@/components/explorer-v2/ui";
import { formatNumber, timeAgo } from "@/components/explorer-v2/format";
import { formatGwei } from "./format";
import { EvmOverviewStats } from "./EvmOverviewStats";
import { CchainActivityChart, TxHistoryChart } from "./EvmActivity";
import { useEvmData, LIVE_REFRESH_MS, usePrice } from "./hooks";
import { useHeadStream, cadence, CONTINUOUS_EXECUTION_CHAINS } from "./useHeadStream";
import { LatestBlocksBoard, LatestTxsBoard, type BlockRow, type TxRow } from "./LiveBoards";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { StatsResponse, TxListResponse, BlockListResponse } from "@/lib/evm-explorer";
import { formatPrice, formatAvaxPrice } from "@/utils/formatPrice";
import { useTokenList, decodeErc20Call, formatTokenAmount } from "@/lib/token-list";
import { formatMarketCap } from "@/lib/utils/format-market-cap";

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
    </span>
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

  // The tip, read from the RPC header once a second. The indexer list
  // trails the chain by seconds and refreshes every five, so the tape and
  // the latest-blocks board ride the header instead: a block enters the
  // moment it is sealed, and receipts stream in as the executor writes
  // them. C-Chain only for now: Continuous Execution (ACP-194) is live
  // on the Primary Network, and the polling load (one head poll plus a
  // receipts batch per second) is not something to point at every L1's
  // RPC. Every other chain keeps the indexer path.
  const liveRpc = CONTINUOUS_EXECUTION_CHAINS.has(String(c.chainId)) ? c.rpcUrl : undefined;
  const head = useHeadStream(liveRpc);
  const heads = head.heads;
  const tip = head.tip;
  const pace = cadence(heads);

  // indexer fallback: span = newest − oldest second-precision timestamp
  const span =
    blockList.length >= 2 ? blockList[0].timestamp - blockList[blockList.length - 1].timestamp : 0;
  const recentTps = pace.tps ?? (span > 0 ? blockList.reduce((acc, b) => acc + b.txCount, 0) / span : null);
  const avgBlockTime =
    pace.intervalMs != null ? pace.intervalMs / 1000 : span > 0 ? span / (blockList.length - 1) : null;
  const cadenceBlocks = pace.n || blockList.length;

  const tapeBlocks: TapeBlock[] = heads.length
    ? heads.slice(0, 20).map((h) => ({
        key: String(h.number),
        number: formatNumber(h.number),
        txCount: h.txCount,
        ago: timeAgo(Math.floor(h.timestampMs / 1000)),
        fill: h.gasLimit > 0 ? Math.min(1, h.gasUsed / h.gasLimit) : 0,
        href: `${base}/block/${h.number}`,
      }))
    : blockList.map((b) => ({
        key: String(b.number),
        number: formatNumber(b.number),
        txCount: b.txCount,
        ago: timeAgo(b.timestamp),
        fill: b.gasLimit > 0 ? Math.min(1, b.gasUsed / b.gasLimit) : 0,
        href: `${base}/block/${b.number}`,
      }));

  // the latest-blocks board: same source order as the tape
  const latestRows: BlockRow[] = heads.length
    ? heads.slice(0, 11).map((h) => ({
        number: h.number,
        timestamp: Math.floor(h.timestampMs / 1000),
        timestampMs: h.timestampMs,
        txCount: h.txCount,
        gasUsed: h.gasUsed,
        gasLimit: h.gasLimit,
      }))
    : blockList.slice(0, 11).map((b) => ({
        number: b.number,
        timestamp: b.timestamp,
        txCount: b.txCount,
        gasUsed: b.gasUsed,
        gasLimit: b.gasLimit,
      }));

  // the transactions board: receipts as blocks settle (Continuous
  // Execution chains), else the indexer's recent window
  const tokens = useTokenList(c.chainId);
  const streaming = head.streamTxs.length > 0;
  const txRows: TxRow[] = streaming
    ? head.streamTxs.map((t) => {
        const tok = t.to ? tokens.get(t.to.toLowerCase()) : undefined;
        const call = tok ? decodeErc20Call(t.input) : null;
        return {
          hash: t.hash,
          blockNumber: t.blockNumber,
          from: t.from,
          to: t.to,
          value: t.value,
          methodId: t.methodId,
          success: t.success,
          feeWei: t.feeWei,
          tokenAmount: call && tok ? `${formatTokenAmount(call.amount, tok.decimals)} ${tok.symbol}` : null,
        };
      })
    : txList.map((t) => ({
        hash: t.hash,
        blockNumber: t.blockNumber,
        from: t.from,
        to: t.to,
        value: t.value,
        methodId: t.methodId ?? "",
        success: t.success,
        feeWei: null,
      }));

  // the header that committed a block's state root: the lowest head whose
  // settledHeight reaches it (heads are tip-first, so the last match)
  const rootBlockFor = (n: number): number | null => {
    for (let i = heads.length - 1; i >= 0; i--) {
      const h = heads[i];
      if (h.settledHeight !== null && h.settledHeight >= n) return h.number;
    }
    return null;
  };

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
              value={tip?.number ?? s.tipHeight}
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
            {blocks.loading && !blockList.length && !heads.length ? (
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
                        series: "price" as const,
                        value: formatPrice(price.price),
                        sub: (
                          <>
                            {price.priceInAvax && sym && sym !== "AVAX" ? `@ ${formatAvaxPrice(price.priceInAvax)} AVAX ` : ""}
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
                        series: "marketCap" as const,
                        value: price.marketCap ? formatMarketCap(price.marketCap) : "—",
                      },
                    ]
                  : []),
                {
                  label: "Avg Block Time",
                  live: true,
                  href: `${base}/blocks`,
                  value: avgBlockTime != null ? avgBlockTime.toFixed(2) : "—",
                  unit: avgBlockTime != null ? "s" : undefined,
                  sub: `last ${cadenceBlocks} blocks`,
                },
                {
                  label: "Throughput",
                  live: true,
                  href: `${base}/txs`,
                  value: recentTps != null ? recentTps.toFixed(1) : "—",
                  unit: recentTps != null ? "TPS" : undefined,
                  sub: `last ${cadenceBlocks} blocks`,
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

          {/* 2:3: the blocks board has five short columns, the transactions
              board carries hash, method, parties, value and fee */}
          <div className="grid gap-12 lg:grid-cols-[2fr_3fr]">
            <LatestBlocksBoard
              rows={latestRows}
              tip={tip}
              executedHeight={head.executedHeight}
              rootBlockFor={rootBlockFor}
              base={base}
              loading={blocks.loading && !heads.length}
            />
            <LatestTxsBoard
              txs={txRows}
              chainId={c.chainId}
              rpcUrl={c.rpcUrl}
              symbol={sym ?? "AVAX"}
              base={base}
              loading={txs.loading && !streaming}
              streaming={streaming}
            />
          </div>
        </div>
      )}
    </EvmShell>
  );
}
