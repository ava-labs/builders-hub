"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { rangeWindowLabel, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { IcmNetworkMap } from "@/components/explorer-v2/network/icm-map";
import { Board, EmptyRow, HEAD, HashChip, INK, LoadMore, MUTED, ROW, RowSkeleton, SectionHeader } from "@/components/explorer-v2/ui";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { thin } from "@/components/explorer-v2/staking/data";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import {
  BLOCK_GRAY,
  CutChips,
  LayerBlock,
  PICK_BLUE,
  SharePanel,
  type BlockDay,
  type BlockLayer,
  type CutChip,
  type SharePart,
} from "@/components/explorer-v2/network/icm-parts";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import type { ICTTStats } from "@/app/(home)/stats/interchain-messaging/_components/types";
import type { Transfer } from "@/components/stats/ICTTDashboard";
import { useIcmStats } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcmStats";
import { useIcttStats } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcttStats";
import { useIcmFlows } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcmFlows";

/* The network-scope ICM facet in the C-Chain home's voice: readouts with
   the message series poured into them, the daily messages as one large
   block, then share panels for chains, routes and tokens. Every panel
   cuts the transfers table below; the cut shows as chips over it. A chain
   pick also lights that chain's share of the messages block. The message
   figures follow the page clock; the flow feed is a fixed 30 days and the
   ICTT feed is all-time, and each panel says so. Data feeds are unchanged. */

/* The fetch window the /api/icm-stats route understands, one per clock tick. */
const ICM_TIME_RANGE: Record<ExplorerRange, string> = {
  day: "1d",
  week: "7d",
  month: "30d",
  quarter: "90d",
  year: "1y",
  // the route's widest window (730 days) predates the first ICM message,
  // so this tick really is all-time here
  all: "all",
};

/* the /api/ictt-stats payload carries fields the shared types never declared */
type IcttTransfer = Transfer & { tokenSymbol?: string; volumeUsd?: number };
type IcttPayload = Omit<ICTTStats, "transfers"> & { transfers: IcttTransfer[]; totalCount?: number; hasMore?: boolean };

/* mainnet catalog by display name: the ICM feeds key chains by name */
const catalogByName = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [c.chainName, c]),
);

function chainIcmHref(chainName: string): string | null {
  const c = catalogByName.get(chainName);
  if (!c) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}/txs/icm` : `/explorer/mainnet/${c.slug}/accounts`;
}

/* logo with a monogram fallback, the chain directory's rule */
function ChainLogo({ uri, name }: { uri?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[8px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {name.charAt(0)}
      </span>
    );
  }
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-4 w-4 shrink-0 rounded-full object-contain" />;
}

/* the quiet mono qualifier in a board header: a window, a count */
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{children}</span>;
}

function RetryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
    >
      {children}
    </button>
  );
}

/* a token's name when the feed knows it; otherwise its short address */
function tokenLabel(name: string, symbol?: string): string {
  return symbol && symbol !== "UNKNOWN" ? symbol : name;
}

/* the feed sends raw base units and no decimals, so an amount only reads
   in USD when the token is priced; the raw sum stays in a title */
function rawTitle(v: number): string {
  return `${v.toExponential(2)} base units (decimals unknown)`;
}

const route = (from: string, to: string) => `${from} → ${to}`;

interface Cut {
  chain?: string;
  route?: string;
  token?: string;
}

/* the table's columns at md and up; phones stack two per line. Volume
   only shows once a loaded row is priced */
const COLS = "md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_8.5rem_5.5rem]";
const COLS_PRICED = "md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_8.5rem_5.5rem_5.5rem]";

export function NetworkIcm() {
  // the page clock drives the message window; the flow feed is a fixed
  // 30-day window upstream and the ICTT feed is all-time
  const range = useExplorerTimeRange();

  const { data: metrics, loading: icmLoading, error: icmError, retry: retryIcm } = useIcmStats(ICM_TIME_RANGE[range]);
  const { data: icttRaw, loadingMore: loadingMoreTransfers, error: icttError, retry: retryIctt, loadMore: loadMoreTransfers } = useIcttStats();
  const { data: flowData, loading: flowLoading, error: flowError, retry: retryFlow } = useIcmFlows();
  const icttData = icttRaw as IcttPayload | null;

  const [cut, setCut] = useState<Cut>({});
  const cutBy = (key: keyof Cut, value: string) => setCut((c) => ({ ...c, [key]: c[key] === value ? undefined : value }));

  /* ---- the message series ---- */

  // newest-first from the API, oldest-first for the block, stride-sampled
  const volume = useMemo(() => {
    if (!metrics?.aggregatedData) return [];
    return thin(
      metrics.aggregatedData.map((p) => ({ date: p.date, value: p.totalMessageCount, breakdown: p.chainBreakdown })).reverse(),
      200,
    );
  }, [metrics]);

  const totalICM = useMemo(() => metrics?.aggregatedData?.reduce((s, p) => s + p.totalMessageCount, 0) ?? 0, [metrics]);
  // complete UTC days only: today's partial count would read as a collapse
  const today = new Date().toISOString().slice(0, 10);
  const whole = (metrics?.aggregatedData ?? []).filter((p) => String(p.date).slice(0, 10) < today);
  const latestDay = whole[0]?.totalMessageCount ?? 0;
  const priorDay = whole[1]?.totalMessageCount;
  const dayDelta = priorDay ? ((latestDay - priorDay) / priorDay) * 100 : null;
  // divide by the days the feed returned, not the clock's nominal span
  const avgDaily = totalICM / Math.max(1, metrics?.aggregatedData?.length ?? 1);

  // a picked chain pours in the selection blue under the rest of the traffic
  const blockLayers: BlockLayer[] = cut.chain
    ? [
        { key: "pick", label: cut.chain, tone: PICK_BLUE },
        { key: "rest", label: "Other chains", tone: BLOCK_GRAY },
      ]
    : [{ key: "all", label: "Messages", tone: BLOCK_GRAY }];
  const blockDays = useMemo<BlockDay[]>(
    () =>
      volume.map((p): BlockDay => {
        if (!cut.chain) return { date: p.date, v: { all: p.value } };
        const pick = Math.min(p.value, p.breakdown[cut.chain] ?? 0);
        return { date: p.date, v: { pick, rest: Math.max(0, p.value - pick) } };
      }),
    [volume, cut.chain],
  );

  /* ---- the share panels ---- */

  const chainParts = useMemo<SharePart[]>(() => {
    if (!metrics?.aggregatedData) return [];
    const totals = new Map<string, number>();
    for (const point of metrics.aggregatedData) {
      for (const [name, count] of Object.entries(point.chainBreakdown)) totals.set(name, (totals.get(name) ?? 0) + count);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        key: name,
        label: name,
        value: count,
        href: chainIcmHref(name),
        lead: (
          <>
            <ChainLogo uri={catalogByName.get(name)?.chainLogoURI} name={name} />
            <span className="truncate">{name}</span>
          </>
        ),
      }));
  }, [metrics]);

  const flowParts = useMemo<SharePart[]>(() => {
    if (!flowData?.flows) return [];
    return [...flowData.flows]
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 8)
      .map((f) => ({
        key: route(f.sourceChain, f.targetChain),
        label: route(f.sourceChain, f.targetChain),
        value: f.messageCount,
        lead: <RouteLead from={f.sourceChain} to={f.targetChain} fromLogo={f.sourceLogo} toLogo={f.targetLogo} />,
      }));
  }, [flowData]);

  const tokenParts = useMemo<SharePart[]>(() => {
    if (!icttData?.tokenDistribution) return [];
    return [...icttData.tokenDistribution]
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((t) => ({
        key: (t.address || t.symbol).toLowerCase(),
        label: tokenLabel(t.name, t.symbol),
        value: t.value,
        lead:
          t.symbol && t.symbol !== "UNKNOWN" ? (
            <>
              <span className="truncate">{t.name}</span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">{t.symbol}</span>
            </>
          ) : (
            <span className="truncate font-mono text-[12px] font-normal">{t.name}</span>
          ),
      }));
  }, [icttData]);

  const icttRouteParts = useMemo<SharePart[]>(() => {
    if (!icttData?.topRoutes) return [];
    return [...icttData.topRoutes]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((r) => ({ key: r.name, label: r.name, value: r.total, lead: <span className="truncate">{r.name}</span> }));
  }, [icttData]);

  const tokenLabels = useMemo(() => new Map(tokenParts.map((t) => [t.key, t.label])), [tokenParts]);

  /* ---- the transfers table, cut ---- */

  const transfers = useMemo(() => {
    return (icttData?.transfers ?? []).map((tx) => {
      const out = tx.direction === "out";
      const home = tx.homeChainDisplayName || tx.homeChainName;
      const remote = tx.remoteChainDisplayName || tx.remoteChainName;
      return {
        tx,
        from: out ? home : remote,
        to: out ? remote : home,
        fromLogo: out ? tx.homeChainLogo : tx.remoteChainLogo,
        toLogo: out ? tx.remoteChainLogo : tx.homeChainLogo,
      };
    });
  }, [icttData]);
  const rows = useMemo(
    () =>
      transfers.filter(
        (r) =>
          (!cut.chain || r.from === cut.chain || r.to === cut.chain) &&
          (!cut.route || route(r.from, r.to) === cut.route) &&
          (!cut.token || r.tx.coinAddress.toLowerCase() === cut.token),
      ),
    [transfers, cut],
  );
  const priced = transfers.some((r) => (r.tx.volumeUsd ?? 0) > 0);
  const cols = priced ? COLS_PRICED : COLS;
  const chips: CutChip[] = [
    cut.chain ? { key: "chain", label: `touches ${cut.chain}` } : null,
    cut.route ? { key: "route", label: cut.route } : null,
    cut.token ? { key: "token", label: `token ${tokenLabels.get(cut.token) ?? cut.token.slice(0, 10)}` } : null,
  ].filter((c): c is CutChip => c !== null);
  const cutting = chips.length > 0;

  const totalICTT = icttData?.overview?.totalTransfers ?? 0;
  // the share only holds when both figures cover the same span
  const icttShare = range === "all" && totalICM > 0 && icttData ? `${((totalICTT / totalICM) * 100).toFixed(1)}% of ICM` : null;
  const spark = volume.map((p) => p.value);

  let body: React.ReactNode;
  if (icmLoading) {
    body = (
      <div className="flex flex-col gap-12" aria-label="Loading interchain messaging data" role="status">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
        <div className="h-72 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  } else if (icmError) {
    body = (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <p className="max-w-md font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          {icmError || "Failed to load interchain messaging data"}
        </p>
        <RetryButton onClick={retryIcm}>Retry</RetryButton>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-12">
        {/* the pulse: message figures on the clock, ICTT figures all-time */}
        <ReadoutRow cols={4}>
          <Readout label="Messages" value={fmtCompact(totalICM)} sub={rangeWindowLabel(range)} spark={spark} />
          <Readout label="Latest Day" value={fmtCompact(latestDay)} sub={`avg ${fmtCompact(avgDaily)}`} delta={dayDelta} spark={spark.slice(-14)} />
          <Readout
            label="Token Transfers"
            value={icttData ? fmtCompact(totalICTT) : icttError ? "—" : null}
            sub={icttShare ? `all-time · ${icttShare}` : "all-time"}
          />
          <Readout
            label="ICTT Chains"
            value={icttData ? icttData.overview.activeChains.toLocaleString("en-US") : icttError ? "—" : null}
            sub={icttData ? `${icttData.overview.activeRoutes.toLocaleString("en-US")} routes` : undefined}
          />
        </ReadoutRow>

        {/* the daily messages as one block; a chain pick pours in blue */}
        {blockDays.length ? (
          <LayerBlock label="Messages" note={rangeWindowLabel(range)} days={blockDays} layers={blockLayers} fmt={fmtCompact} unit="msgs" />
        ) : (
          <Board divide={false} className="border">
            <EmptyRow>No ICM activity in this window</EmptyRow>
          </Board>
        )}

        {/* the same traffic as a map; a chain pick cuts like Top Chains */}
        <IcmNetworkMap picked={cut.chain ?? null} onPick={(k) => cutBy("chain", k)} />

        {/* who talks, and to whom; each cut filters the transfers below */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <SharePanel
            label="Top Chains"
            action={
              <Link
                href="/explorer/mainnet/chains"
                className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#0061E2] transition-colors hover:text-zinc-900 dark:text-[#5f9dff] dark:hover:text-zinc-100"
              >
                Per-chain feeds
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
            parts={chainParts}
            total={totalICM}
            fmt={fmtCompact}
            picked={cut.chain ?? null}
            onPick={(k) => cutBy("chain", k)}
            empty="No chains in window"
          />
          <SharePanel
            label="Top Routes · 30 days"
            parts={flowParts}
            total={flowData?.totalMessages}
            fmt={fmtCompact}
            picked={cut.route ?? null}
            onPick={(k) => cutBy("route", k)}
            loading={flowLoading}
            empty="No routes in window"
            failed={
              !flowLoading && flowError ? (
                <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
                  <Chip>Route feed unavailable</Chip>
                  <RetryButton onClick={retryFlow}>Retry</RetryButton>
                </div>
              ) : undefined
            }
          />
        </div>

        {/* what moves, and along which corridors: the all-time ICTT feed */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <SharePanel
            label="Tokens by Transfers"
            action={<Chip>All-Time</Chip>}
            parts={tokenParts}
            fmt={fmtCompact}
            picked={cut.token ?? null}
            onPick={(k) => cutBy("token", k)}
            loading={!icttData && !icttError}
            empty="No token data"
            failed={icttError && !icttData ? <IcttFailed onRetry={retryIctt} /> : undefined}
          />
          <SharePanel
            label="Routes by Transfers"
            action={<Chip>All-Time</Chip>}
            parts={icttRouteParts}
            fmt={fmtCompact}
            picked={cut.route ?? null}
            onPick={(k) => cutBy("route", k)}
            loading={!icttData && !icttError}
            empty="No route data"
            failed={icttError && !icttData ? <IcttFailed onRetry={retryIctt} /> : undefined}
          />
        </div>

        {/* the ledger: per-contract transfer totals, cut by the panels above */}
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHeader
            label="Token Transfers"
            action={
              icttData ? (
                <Chip>
                  {cutting
                    ? `${rows.length} of ${transfers.length} loaded`
                    : `${transfers.length} of ${(icttData.totalCount ?? transfers.length).toLocaleString("en-US")}`}
                </Chip>
              ) : undefined
            }
          />
          <CutChips chips={chips} onDrop={(k) => setCut((c) => ({ ...c, [k]: undefined }))} onClear={() => setCut({})} />
          <Board divide={false}>
            <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
              <span>Route</span>
              <span>Token</span>
              <span>Contract</span>
              <span className="text-right">Transfers</span>
              {priced && <span className="text-right">Volume</span>}
            </div>
            {!icttData && !icttError && <RowSkeleton n={8} />}
            {icttError && !icttData && <IcttFailed onRetry={retryIctt} />}
            {rows.map(({ tx, from, to, fromLogo, toLogo }, i) => {
              const sym = tx.tokenSymbol && tx.tokenSymbol !== "UNKNOWN" ? tx.tokenSymbol : null;
              return (
                <div key={`${tx.contractAddress}-${i}`} className={cn(ROW, cols, "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900")}>
                  {/* a row's route and token cut the table too */}
                  <button
                    type="button"
                    onClick={() => cutBy("route", route(from, to))}
                    title={`Only ${route(from, to)}`}
                    className="col-span-2 flex min-w-0 items-center gap-2 text-left text-[13px] font-medium text-zinc-900 transition-colors hover:text-[#0061E2] md:col-span-1 dark:text-zinc-100 dark:hover:text-[#5f9dff]"
                  >
                    <ChainLogo uri={fromLogo} name={from} />
                    <span className="min-w-0 truncate">{from}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                    <ChainLogo uri={toLogo} name={to} />
                    <span className="min-w-0 truncate">{to}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cutBy("token", tx.coinAddress.toLowerCase())}
                    title="Only this token"
                    className="min-w-0 truncate text-left transition-colors hover:text-[#0061E2] dark:hover:text-[#5f9dff]"
                  >
                    {sym ? (
                      <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {tx.tokenName} <span className={cn(MUTED, "text-[11px]")}>{sym}</span>
                      </span>
                    ) : (
                      <span className={cn(MUTED, "hover:text-inherit")}>{tx.tokenName}</span>
                    )}
                  </button>
                  <span className="hidden md:block">
                    <HashChip value={tx.contractAddress} len={8} />
                  </span>
                  <span className={cn(INK, "md:text-right")} title={rawTitle(tx.transferCoinsTotal)}>
                    {fmtCompact(tx.transferCount)}
                    <span className="text-zinc-400 md:hidden dark:text-zinc-500"> transfers</span>
                  </span>
                  {priced && (
                    <span className={cn(MUTED, "text-right")}>{tx.volumeUsd && tx.volumeUsd > 0 ? `$${fmtCompact(tx.volumeUsd)}` : "—"}</span>
                  )}
                </div>
              );
            })}
            {icttData && rows.length === 0 && (
              <EmptyRow>{cutting ? "No loaded transfers match this cut. Load more, or drop a chip." : "No transfers"}</EmptyRow>
            )}
          </Board>
          {icttData?.hasMore && (
            <LoadMore onClick={loadMoreTransfers} disabled={loadingMoreTransfers} label="Load more transfers" />
          )}
        </section>
      </div>
    );
  }

  return <NetworkShell>{body}</NetworkShell>;
}

function RouteLead({ from, to, fromLogo, toLogo }: { from: string; to: string; fromLogo?: string; toLogo?: string }) {
  return (
    <>
      <ChainLogo uri={fromLogo} name={from} />
      <span className="min-w-0 truncate">{from}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
      <ChainLogo uri={toLogo} name={to} />
      <span className="min-w-0 truncate">{to}</span>
    </>
  );
}

function IcttFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
      <Chip>ICTT feed unavailable</Chip>
      <RetryButton onClick={onRetry}>Retry</RetryButton>
    </div>
  );
}
