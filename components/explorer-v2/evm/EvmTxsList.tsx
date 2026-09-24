"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, SectionHeader, idInk, fnInk, feeInk, RowDoor } from "@/components/explorer-v2/ui";
import { ChartEmpty } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { truncate } from "@/components/explorer-v2/format";
import { useEvmData, LIVE_REFRESH_MS, usePrice, usdOfWei } from "./hooks";
import { useHeadStream, CONTINUOUS_EXECUTION_CHAINS } from "./useHeadStream";
import { Belt, MotionRow, Party, RowSkeleton, ageShort, fmtAmount, useDrip, HEAD, ROW, INK, MUTED, type TxRow } from "./LiveBoards";
import { ChartSection, DualChart, OverlayKey, fmtCompact, metricSeries, weekFloor, useChainMetrics } from "./metric-charts";
import { prewarmContractNames, useVerifiedContracts } from "@/lib/sourcify-client";
import { useMethodNames } from "./bits";
import { decodeErc20Call, formatTokenAmount, useTokenList } from "@/lib/token-list";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { TxListResponse } from "@/lib/evm-explorer";

/* The Transactions tab: the receipts stream as a full-width ledger.
   On the C-Chain rows enter as the executor writes them (one at a time,
   the home board's belt at 25 rows), each with what it did, who to, what
   moved, what it cost, and how old it is. Other chains keep the indexer
   list. The charts beneath give the feed its shape on the page clock. */

const LIVE_ROWS = 25;
const PAGE = 25;
const MAX = 100;
const METRICS = ["txCount", "avgTps", "cumulativeTxCount"].join(",");

export function EvmTxsList({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  const [limit, setLimit] = useState(PAGE);

  const liveRpc = CONTINUOUS_EXECUTION_CHAINS.has(String(c.chainId)) ? c.rpcUrl : undefined;
  const head = useHeadStream(liveRpc, { keep: 40, seed: 8, keepTxs: 160 });
  const streaming = head.streamTxs.length > 0;

  const indexed = useEvmData<TxListResponse>(c.chainId, "txs", { limit }, { refreshMs: streaming ? 0 : LIVE_REFRESH_MS });
  const tokens = useTokenList(c.chainId);
  const { price } = usePrice(c.chainId);
  const usd = price?.price ?? null;

  const source: TxRow[] = streaming
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
          timestamp: t.timestamp,
        };
      })
    : (indexed.data?.transactions ?? []).map((t) => ({
        hash: t.hash,
        blockNumber: t.blockNumber,
        from: t.from,
        to: t.to,
        value: t.value,
        methodId: t.methodId ?? "",
        success: t.success,
        feeWei: null,
        timestamp: t.timestamp,
      }));

  const [hover, setHover] = useState(false);
  const rows = useDrip(
    source,
    streaming ? LIVE_ROWS + 1 : limit,
    streaming,
    (fresh) => {
      void prewarmContractNames(c.chainId, fresh.map((t) => t.to));
    },
    hover,
  );
  const contracts = useVerifiedContracts(c.chainId, rows.map((t) => t.to));
  const method = useMethodNames(c.chainId, rows);

  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const { metrics, failed } = useChainMetrics(c.chainId, range, METRICS);
  const m = metrics ?? {};

  // the parties take what the fixed columns leave: at 1400px and up that is
  // room for two whole addresses
  const cols = "md:grid-cols-[0.75rem_8rem_minmax(0,10rem)_minmax(0,1fr)_minmax(0,9rem)_7.5rem_3.5rem]";
  const loading = streaming ? rows.length === 0 : indexed.loading && rows.length === 0;

  return (
    <EvmShell network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader label="Transactions" />
        <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
            <span />
            <span>Hash</span>
            <span>Method</span>
            <span>From → To</span>
            <span className="text-right">Value</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Age</span>
          </div>
          {loading && <RowSkeleton n={12} />}
          {!loading && rows.length === 0 && (
            <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">no transactions</div>
          )}
          <Belt rows={streaming ? LIVE_ROWS : rows.length}>
            {rows.map((t, i) => {
              const mth = method(t);
              const value = Number(t.value);
              const tok = t.to ? tokens.get(t.to.toLowerCase()) : undefined;
              return (
                <MotionRow key={t.hash} animateIn={streaming} overflow={i >= LIVE_ROWS}>
                  <RowDoor href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
                    <span className="flex h-3 w-3 items-center justify-center">
                      {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
                    </span>
                    <Link href={`${base}/tx/${t.hash}`} className={cn(INK, idInk, "truncate hover:text-[#E6212F]")} onClick={(e) => e.stopPropagation()}>
                      {truncate(t.hash, 8)}
                    </Link>
                    <span
                      className={cn("truncate font-mono text-[12px]", mth.named ? fnInk : "text-zinc-400 dark:text-zinc-500")}
                      title={t.methodId || undefined}
                    >
                      <CellLabel>Method</CellLabel>
                      {mth.label}
                    </span>
                    <span className="col-span-2 flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 md:col-span-1 dark:text-zinc-400">
                      <CellLabel>From → To</CellLabel>
                      <Party addr={t.from} name={null} href={`${base}/address/${t.from}`} full />
                      <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                      {t.to ? (
                        <Party addr={t.to} name={contracts.get(t.to.toLowerCase())?.name} token={tok} chainId={c.chainId} href={`${base}/address/${t.to}`} full />
                      ) : (
                        <span className="truncate">contract creation</span>
                      )}
                    </span>
                    <span className="min-w-0 truncate font-mono text-[12.5px] tabular-nums md:text-right">
                      <CellLabel>Value</CellLabel>
                      {value > 0 ? (
                        <span className="text-zinc-900 dark:text-zinc-50">
                          {fmtAmount(value / 1e18)}{" "}
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{sym}</span>
                          {usdOfWei(t.value, usd) && !usdOfWei(t.value, usd)!.startsWith("<") && (
                            <span className="ml-2 text-[11px] text-zinc-400 dark:text-zinc-500">{usdOfWei(t.value, usd)}</span>
                          )}
                        </span>
                      ) : t.tokenAmount ? (
                        <span className="text-zinc-900 dark:text-zinc-50" title={t.tokenAmount}>
                          {t.tokenAmount}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                    <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", feeInk)}>
                      <CellLabel>Fee</CellLabel>
                      {t.feeWei !== null ? (
                        <>
                          {(t.feeWei / 1e18).toFixed(6)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{sym}</span>
                        </>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                    <span className={cn(MUTED, "text-right")}>
                      <CellLabel>Age</CellLabel>
                      {t.timestamp ? ageShort(t.timestamp) : ""}
                    </span>
                  </RowDoor>
                </MotionRow>
              );
            })}
          </Belt>
        </Board>
        {!streaming && !indexed.loading && rows.length >= limit && limit < MAX && (
          <button
            onClick={() => setLimit((l) => Math.min(l + PAGE, MAX))}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more
          </button>
        )}
        {streaming && (
          <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            live: receipts read from the RPC as they are written · the newest {LIVE_ROWS} on screen, older ones on the address and block pages
          </p>
        )}
      </section>

      {/* the shape of the feed over time */}
      <div className="mt-10 grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <ChartSection label={`Transactions${weekFloor(range)}`} action={<OverlayKey label="avg tps" dashed />}>
          {metricSeries(m, range, "txCount", "avgTps").length ? (
            <DualChart
              data={metricSeries(m, range, "txCount", "avgTps")}
              kind="bars"
              fmt={fmtCompact}
              aLabel="txs"
              bLabel="avg TPS"
              bFmt={(v) => v.toFixed(1)}
              bOwnAxis
            />
          ) : (
            <ChartEmpty failed={!!metrics || failed} />
          )}
        </ChartSection>

        <ChartSection label={`Total Transactions${weekFloor(range)}`}>
          {metricSeries(m, range, "cumulativeTxCount").length ? (
            <DualChart data={metricSeries(m, range, "cumulativeTxCount")} kind="area" fmt={fmtCompact} aLabel="txs all-time" />
          ) : (
            <ChartEmpty failed={!!metrics || failed} />
          )}
        </ChartSection>
      </div>
    </EvmShell>
  );
}
