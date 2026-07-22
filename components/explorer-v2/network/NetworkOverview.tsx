"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChainCosmosData, ICMFlowRoute } from "@/components/stats/NetworkDiagram";
import {
  Board,
  SectionHeader,
  StatCell,
  StatDash,
  StatFigure,
} from "@/components/explorer-v2/ui";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The All Networks overview — the explorer's widest lens. One ledger strip
   of ecosystem aggregates, the chains ranked by live activity, and the two
   network-level instruments (staking, the token) as teaser boards that
   link into their own facets. */

type TimeRange = "day" | "week" | "month";
const RANGES: { key: TimeRange; label: string }[] = [
  { key: "day", label: "24H" },
  { key: "week", label: "7D" },
  { key: "month", label: "30D" },
];

interface ChainRow {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number;
  tps: number;
  activeAddresses: number;
  icmMessages: number;
  validatorCount: number | string;
}

interface OverviewData {
  chains: ChainRow[];
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalValidators: number;
    activeL1Count: number;
  };
}

interface SupplyData {
  circulatingSupply: string;
  totalStaked: string;
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  price: number;
  priceChange24h: number;
}

function useOverviewStats(timeRange: TimeRange) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    fetch(`/api/overview-stats?timeRange=${timeRange}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: OverviewData) => setData(d))
      .catch(() => {
        /* the previous range's data stands */
      })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [timeRange]);
  return { data, refreshing };
}

/* the cosmos map — a 1.6k-line canvas, so it only loads on the client
   and never blocks the splash's first paint */
const NetworkDiagram = dynamic(() => import("@/components/stats/NetworkDiagram"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-black" />,
});

/* 30-day ICM flows drawn as arcs between chains. Failure is non-fatal:
   the diagram still renders its nodes, just without traffic. */
function useIcmFlowRoutes() {
  const [flows, setFlows] = useState<ICMFlowRoute[]>([]);
  const [failedChainIds, setFailedChainIds] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/icm-flow?days=30", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { flows?: ICMFlowRoute[]; failedChainIds?: string[] }) => {
        if (Array.isArray(d.flows)) setFlows(d.flows);
        if (Array.isArray(d.failedChainIds)) setFailedChainIds(d.failedChainIds);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return { flows, failedChainIds };
}

/* deterministic fallback tint for catalog chains without a brand color */
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 70%, 50%)`;
}

function useAvaxSupply() {
  const [data, setData] = useState<SupplyData | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/avax-supply", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: SupplyData) => setData(d))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return data;
}

/* compact figures for table cells and AVAX quantities: 1.24M, 254.9M */
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
function fmtAvax(v: string | undefined): string | null {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? `${compact.format(n)} AVAX` : null;
}

/* catalog lookups so activity rows link into each chain's own explorer */
const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);
function chainHref(chainId: string): string | null {
  const c = catalogByChainId.get(String(chainId));
  if (!c) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}` : `/stats/l1/${c.slug}`;
}

function RangeChips({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div className="inline-flex shrink-0 border border-zinc-200 dark:border-zinc-800">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={cn(
            "px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
            r.key === value
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function BoardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const TH = "px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const TD = "px-5 py-3 text-[13px] tabular-nums md:px-6";

export function NetworkOverview() {
  const [range, setRange] = useState<TimeRange>("day");
  const { data, refreshing } = useOverviewStats(range);
  const supply = useAvaxSupply();

  const agg = data?.aggregated;
  const rows = useMemo(
    () => (data?.chains ?? []).slice().sort((a, b) => b.activeAddresses - a.activeAddresses).slice(0, 12),
    [data],
  );

  const { flows, failedChainIds } = useIcmFlowRoutes();

  /* the diagram's node list: validator-backed chains only (zero-validator
     chains render as orphan dots), largest sets first to anchor the layout */
  const cosmos = useMemo<ChainCosmosData[]>(() => {
    return (data?.chains ?? [])
      .map((c) => {
        const validatorCount = typeof c.validatorCount === "number" ? c.validatorCount : 0;
        if (validatorCount === 0) return null;
        const catalog = catalogByChainId.get(String(c.chainId));
        return {
          id: catalog?.subnetId || c.chainId,
          chainId: c.chainId,
          name: c.chainName,
          logo: c.chainLogoURI,
          color: catalog?.color || colorFromName(c.chainName),
          validatorCount,
          subnetId: catalog?.subnetId,
          activeAddresses: c.activeAddresses > 0 ? c.activeAddresses : undefined,
          txCount: c.txCount > 0 ? Math.round(c.txCount) : undefined,
          icmMessages: c.icmMessages > 0 ? Math.round(c.icmMessages) : undefined,
          tps: c.tps > 0 ? parseFloat(c.tps.toFixed(2)) : undefined,
          category: catalog?.category || "General",
        } as ChainCosmosData;
      })
      .filter((c): c is ChainCosmosData => c !== null)
      .sort((a, b) => b.validatorCount - a.validatorCount);
  }, [data]);

  const feesBurned = useMemo(() => {
    if (!supply) return null;
    const total =
      parseFloat(supply.totalCBurned || "0") +
      parseFloat(supply.totalPBurned || "0") +
      parseFloat(supply.totalXBurned || "0");
    return Number.isFinite(total) && total > 0 ? total : null;
  }, [supply]);

  const priceAside = supply?.price ? (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        AVAX
      </span>
      <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
        ${supply.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {Number.isFinite(supply.priceChange24h) && (
          <span
            className={cn(
              "ml-2 text-sm",
              supply.priceChange24h >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]",
            )}
          >
            {supply.priceChange24h >= 0 ? "+" : ""}
            {supply.priceChange24h.toFixed(2)}%
          </span>
        )}
      </span>
    </div>
  ) : undefined;

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem · Mainnet"
      title="All Networks"
      intro="Every Avalanche chain on one sheet — live activity, interchain traffic, validators, and the token that secures it all."
      aside={priceAside}
    >
      <div className="flex flex-col gap-10">
        {/* the ecosystem's ledger strip */}
        <section className="flex flex-col gap-4">
          <SectionHeader label="Network pulse" action={<RangeChips value={range} onChange={setRange} />} />
          <Board
            divide={false}
            className={cn("overflow-hidden transition-opacity", refreshing && data && "opacity-60")}
          >
            {/* -ml/-mt swallow the leading hairlines so every cell can carry
                border-l/border-t and the grid stays clean at any column count */}
            <div className="-ml-px -mt-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 [&>div]:border-l [&>div]:border-t [&>div]:border-zinc-200 dark:[&>div]:border-zinc-800">
              <div>
                <StatCell label="Transactions" live>
                  {agg ? <StatFigure value={agg.totalTxCount} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="Avg TPS">
                  {agg ? (
                    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                      {agg.totalTps >= 100 ? Math.round(agg.totalTps).toLocaleString("en-US") : agg.totalTps.toFixed(1)}
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
              </div>
              <div>
                <StatCell label="Active addresses">
                  {agg ? <StatFigure value={agg.totalActiveAddresses} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="ICM messages" href="/explorer/mainnet/icm">
                  {agg ? <StatFigure value={agg.totalICMMessages} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="Validators" href="/explorer/mainnet/validators">
                  {agg ? <StatFigure value={agg.totalValidators} /> : <StatDash />}
                </StatCell>
              </div>
              <div>
                <StatCell label="Active L1s" href="/explorer/mainnet/chains">
                  {agg ? <StatFigure value={agg.activeL1Count} /> : <StatDash />}
                </StatCell>
              </div>
            </div>
          </Board>
        </section>

        {/* the network as a cosmos: every validator set a body, ICM traffic
            as arcs between them — the one dark surface on the sheet */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Network map"
            action={<BoardLink href="/explorer/mainnet/icm">ICM flows</BoardLink>}
          />
          <Board divide={false} className="overflow-hidden bg-zinc-900 p-0 dark:bg-black">
            <div className="h-[400px] sm:h-[500px] md:h-[560px]">
              {cosmos.length > 0 ? (
                <NetworkDiagram data={cosmos} icmFlows={flows} failedChainIds={failedChainIds} />
              ) : (
                <div className="h-full w-full animate-pulse bg-zinc-900 dark:bg-black" />
              )}
            </div>
          </Board>
        </section>

        {/* the chains, ranked by who's actually being used */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            label={`Top chains · ${RANGES.find((r) => r.key === range)?.label}`}
            action={<BoardLink href="/explorer/mainnet/chains">All chains</BoardLink>}
          />
          <Board divide={false} className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className={TH}>Chain</th>
                  <th className={cn(TH, "text-right")}>Active addresses</th>
                  <th className={cn(TH, "text-right")}>Transactions</th>
                  <th className={cn(TH, "text-right")}>TPS</th>
                  <th className={cn(TH, "text-right")}>ICM</th>
                  <th className={cn(TH, "text-right")}>Validators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.length === 0 &&
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td className={TD} colSpan={6}>
                        <span className="block h-4 w-2/5 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                      </td>
                    </tr>
                  ))}
                {rows.map((c) => {
                  const href = chainHref(c.chainId);
                  const name = (
                    <span className="flex items-center gap-2.5">
                      {c.chainLogoURI ? (
                        <img src={c.chainLogoURI} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                      )}
                      <span
                        className={cn(
                          "truncate text-[13px] font-medium",
                          href
                            ? "text-[#0061E2] group-hover:underline dark:text-[#5f9dff]"
                            : "text-zinc-900 dark:text-zinc-100",
                        )}
                      >
                        {c.chainName}
                      </span>
                    </span>
                  );
                  return (
                    <tr
                      key={c.chainId}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className={cn(TD, "max-w-64")}>
                        {href ? (
                          <Link href={href} className="group block">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-900 dark:text-zinc-100")}>
                        {compact.format(c.activeAddresses)}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-700 dark:text-zinc-300")}>
                        {compact.format(c.txCount)}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-700 dark:text-zinc-300")}>
                        {c.tps >= 100 ? Math.round(c.tps).toLocaleString("en-US") : c.tps.toFixed(2)}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-700 dark:text-zinc-300")}>
                        {c.icmMessages > 0 ? compact.format(c.icmMessages) : "—"}
                      </td>
                      <td className={cn(TD, "text-right font-mono text-zinc-700 dark:text-zinc-300")}>
                        {typeof c.validatorCount === "number" ? c.validatorCount.toLocaleString("en-US") : c.validatorCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Board>
        </section>

        {/* the two network-level instruments, as teasers into their facets */}
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <section className="flex flex-col gap-4">
            <SectionHeader label="Staking" action={<BoardLink href="/explorer/mainnet/validators">Validators</BoardLink>} />
            <Board divide={false}>
              <div className="grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-800">
                <StatCell label="Total staked">
                  {fmtAvax(supply?.totalStaked) ? (
                    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                      {fmtAvax(supply?.totalStaked)}
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
                <StatCell label="Validators">
                  {agg ? <StatFigure value={agg.totalValidators} className="sm:text-2xl md:text-2xl" /> : <StatDash />}
                </StatCell>
              </div>
            </Board>
          </section>
          <section className="flex flex-col gap-4">
            <SectionHeader label="AVAX" action={<BoardLink href="/explorer/mainnet/token">Token</BoardLink>} />
            <Board divide={false}>
              <div className="grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-800">
                <StatCell label="Circulating supply">
                  {fmtAvax(supply?.circulatingSupply) ? (
                    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                      {fmtAvax(supply?.circulatingSupply)}
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
                <StatCell label="Fees burned · all time">
                  {feesBurned ? (
                    <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                      {compact.format(feesBurned)} AVAX
                    </span>
                  ) : (
                    <StatDash />
                  )}
                </StatCell>
              </div>
            </Board>
          </section>
        </div>
      </div>
    </NetworkShell>
  );
}
