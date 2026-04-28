'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, BarChart3, Blocks, ExternalLink, Fuel, Timer } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { ExplorerMenu } from '@/components/console/ExplorerMenu';
import { useMyL1s } from '@/hooks/useMyL1s';
import { useL1RecentBlocks, type BlockSummary } from '@/hooks/useL1RecentBlocks';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import l1ChainsData from '@/constants/l1-chains.json';

const C_CHAIN_IDS = new Set([43113, 43114]);

// Map evmChainId → public stats slug so well-known L1s can link to the
// deeper /stats/l1/<slug> page (server-indexed history). Built once at
// module load.
const STATS_SLUG_BY_CHAIN_ID = (() => {
  const map = new Map<number, string>();
  (l1ChainsData as Array<{ chainId: string; slug: string }>).forEach((c) => {
    const id = Number(c.chainId);
    if (Number.isFinite(id) && c.slug) {
      map.set(id, c.slug);
    }
  });
  return map;
})();

export default function StatsPage({ params }: { params: Promise<{ chain: string }> }) {
  const { chain } = use(params);
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.WalletConnected]}>
      <StatsBody chainParam={chain} />
    </CheckRequirements>
  );
}

function StatsBody({ chainParam }: { chainParam: string }) {
  const router = useRouter();
  const { l1s: managedL1s, isLoading: managedLoading, error: managedError } = useMyL1s();
  const walletL1s = useL1List();

  // Resolve the L1 across both sources. Match by evmChainId first (the
  // common case — the URL uses the decimal chain ID), fall back to
  // subnetId for managed entries that haven't been indexed by Glacier yet.
  const l1 = useMemo(() => {
    const candidates: Array<{
      source: 'managed' | 'wallet';
      subnetId: string;
      blockchainId: string;
      evmChainId: number | null;
      chainName: string;
      rpcUrl: string;
      isTestnet: boolean;
      coinName?: string;
      explorerUrl?: string;
    }> = [];

    managedL1s.forEach((m) =>
      candidates.push({
        source: 'managed',
        subnetId: m.subnetId,
        blockchainId: m.blockchainId,
        evmChainId: m.evmChainId,
        chainName: m.chainName,
        rpcUrl: m.rpcUrl,
        isTestnet: m.isTestnet,
      }),
    );

    walletL1s.forEach((w: L1ListItem) => {
      if (C_CHAIN_IDS.has(w.evmChainId)) return;
      candidates.push({
        source: 'wallet',
        subnetId: w.subnetId,
        blockchainId: w.id,
        evmChainId: w.evmChainId,
        chainName: w.name,
        rpcUrl: w.rpcUrl,
        isTestnet: w.isTestnet,
        coinName: w.coinName,
        explorerUrl: w.explorerUrl,
      });
    });

    return (
      candidates.find(
        (c) => String(c.evmChainId) === chainParam || c.subnetId === chainParam,
      ) ?? null
    );
  }, [managedL1s, walletL1s, chainParam]);

  // Pull explorer URL from a matching wallet entry even when the primary
  // resolution came from managed (which doesn't carry the field).
  const walletExplorerUrl = useMemo(() => {
    if (!l1 || l1.evmChainId === null) return undefined;
    const w = walletL1s.find((x: L1ListItem) => x.evmChainId === l1.evmChainId);
    return w?.explorerUrl && w.explorerUrl.length > 0 ? w.explorerUrl : l1.explorerUrl;
  }, [l1, walletL1s]);

  const explorerUrl = walletExplorerUrl;
  const publicStatsSlug = l1?.evmChainId !== null && l1?.evmChainId !== undefined
    ? STATS_SLUG_BY_CHAIN_ID.get(l1.evmChainId)
    : undefined;

  // User-selectable history window. Larger windows show more trend but cost
  // more RPC calls on first load (incremental polling keeps subsequent
  // refreshes cheap regardless of window size).
  const [windowSize, setWindowSize] = useState<number>(60);
  const recent = useL1RecentBlocks(l1?.rpcUrl, windowSize);

  if (!l1) {
    if (managedLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/console/my-l1')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>L1 not found</CardTitle>
            <CardDescription>
              {managedError ??
                `No L1 matched chain ID or subnet "${chainParam}". It may have spun down or been removed from your wallet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <Link
            href={`/console/my-l1?chain=${l1.evmChainId ?? l1.subnetId}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to {l1.chainName}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{l1.chainName} — Stats</h1>
          <p className="text-sm text-muted-foreground">
            Live charts derived from this L1&apos;s RPC. Window: latest {recent.blocks.length} of{' '}
            {windowSize} blocks · refreshing every 15s.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <RangeSelector value={windowSize} onChange={setWindowSize} />
          {publicStatsSlug && (
            <Link href={`/stats/l1/${publicStatsSlug}`}>
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                Public stats
              </Button>
            </Link>
          )}
          <ExplorerMenu
            evmChainId={l1.evmChainId}
            isTestnet={l1.isTestnet}
            customExplorerUrl={explorerUrl}
            icon={ExternalLink}
          />
        </div>
      </div>

      {recent.error && recent.blocks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>RPC unreachable</CardTitle>
            <CardDescription>
              Couldn&apos;t fetch recent blocks from {l1.rpcUrl}. The chain may be offline or
              spun down.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">
              {recent.error}
            </p>
          </CardContent>
        </Card>
      ) : !recent.hasLoadedOnce ? (
        <ChartsSkeleton />
      ) : (
        <ChartsGrid blocks={recent.blocks} />
      )}
    </div>
  );
}

// Pill-style range selector for the chart window. Larger windows are
// noticeably costlier on first load (parallel RPC fan-out), but the
// incremental poll keeps subsequent refresh traffic constant regardless
// of window size — so users can leave it on 240 without penalty.
const RANGE_OPTIONS = [
  { count: 30, label: '30' },
  { count: 60, label: '60' },
  { count: 120, label: '120' },
  { count: 240, label: '240' },
] as const;

function RangeSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2">
        Blocks
      </span>
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.count}
          type="button"
          onClick={() => onChange(opt.count)}
          className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
            value === opt.count
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface ChartPoint {
  block: number;
  blockTime: number;
  txCount: number;
  gasUtilization: number;
  baseFeeGwei: number | null;
}

function buildChartPoints(blocks: BlockSummary[]): ChartPoint[] {
  // Block time = (timestamp_n - timestamp_n-1). The first block has no
  // predecessor in our window so we skip it for the time series.
  const sorted = [...blocks].sort((a, b) => Number(a.number - b.number));
  const points: ChartPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const blockTime = Number(cur.timestamp - prev.timestamp);
    const utilizationPct =
      cur.gasLimit === 0n
        ? 0
        : Number((cur.gasUsed * 10000n) / cur.gasLimit) / 100;
    const baseFeeGwei =
      cur.baseFeePerGas !== null ? Number(cur.baseFeePerGas) / 1e9 : null;
    points.push({
      block: Number(cur.number),
      blockTime,
      txCount: cur.txCount,
      gasUtilization: utilizationPct,
      baseFeeGwei,
    });
  }
  return points;
}

// Single-accent palette. Charts are differentiated by title, icon, and
// chart-type (line/bar/area) — not color. Using one brand-aligned accent
// keeps the page feeling like a coherent product surface, not a "rainbow
// dashboard." Avalanche red (#E84142) is the project's primary.
const CHART_ACCENT = '#E84142';
const GRID_STROKE = '#71717a';      // zinc-500 — visible on both themes at low opacity
const AXIS_TICK_COLOR = '#71717a';  // same — readable axis labels in both themes

function ChartsGrid({ blocks }: { blocks: BlockSummary[] }) {
  const points = useMemo(() => buildChartPoints(blocks), [blocks]);
  const hasBaseFee = points.some((p) => p.baseFeeGwei !== null);

  // Aggregate stats: averages over the window for the card sub-titles.
  const avgBlockTime = points.length
    ? (points.reduce((s, p) => s + p.blockTime, 0) / points.length).toFixed(2)
    : '—';
  const totalTx = points.reduce((s, p) => s + p.txCount, 0);
  const maxTx = points.reduce((m, p) => Math.max(m, p.txCount), 0);
  const avgUtilization = points.length
    ? (points.reduce((s, p) => s + p.gasUtilization, 0) / points.length).toFixed(2)
    : '—';
  const avgBaseFee =
    points.length && hasBaseFee
      ? (
          points.filter((p) => p.baseFeeGwei !== null).reduce((s, p) => s + (p.baseFeeGwei ?? 0), 0) /
          points.filter((p) => p.baseFeeGwei !== null).length
        ).toFixed(3)
      : '—';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard
        icon={Timer}
        title="Block time"
        subtitle={`Avg ${avgBlockTime}s · ${points.length} samples`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="grad-blockTime" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.2} />
                <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.25} />
            <XAxis
              dataKey="block"
              tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
              tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
              tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              tickFormatter={(v: number) => `${v}s`}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip
                color={CHART_ACCENT}
                formatValue={(v) => `${Number(v)}s`}
                seriesName="Block time"
              />}
              cursor={{ stroke: CHART_ACCENT, strokeOpacity: 0.4, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="blockTime"
              stroke={CHART_ACCENT}
              strokeWidth={2.25}
              fill="url(#grad-blockTime)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        icon={Blocks}
        title="Transactions per block"
        subtitle={`${totalTx} tx · max ${maxTx} per block`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="grad-txCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.9} />
                <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.25} />
            <XAxis
              dataKey="block"
              tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
              tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
              tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              content={<ChartTooltip
                color={CHART_ACCENT}
                formatValue={(v) => String(v)}
                seriesName="Transactions"
              />}
              cursor={{ fill: CHART_ACCENT, fillOpacity: 0.08 }}
            />
            <Bar
              dataKey="txCount"
              fill="url(#grad-txCount)"
              radius={[3, 3, 0, 0]}
              minPointSize={2}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        icon={Fuel}
        title="Gas utilization"
        subtitle={`Avg ${avgUtilization}% of block limit`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="grad-gasUtil" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.2} />
                <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.25} />
            <XAxis
              dataKey="block"
              tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
              tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
              tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip
                color={CHART_ACCENT}
                formatValue={(v) => `${Number(v).toFixed(2)}%`}
                seriesName="Utilization"
              />}
              cursor={{ stroke: CHART_ACCENT, strokeOpacity: 0.4, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="gasUtilization"
              stroke={CHART_ACCENT}
              strokeWidth={2.25}
              fill="url(#grad-gasUtil)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {hasBaseFee ? (
        <ChartCard
          icon={Fuel}
          title="Base fee"
          subtitle={`Avg ${avgBaseFee} Gwei (EIP-1559)`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="grad-baseFee" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.25} />
              <XAxis
                dataKey="block"
                tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
                tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
                axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: AXIS_TICK_COLOR }}
                tickLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
                axisLine={{ stroke: GRID_STROKE, strokeOpacity: 0.4 }}
                tickFormatter={(v: number) => `${v.toFixed(2)}`}
                width={48}
              />
              <Tooltip
                content={<ChartTooltip
                  color={CHART_ACCENT}
                  formatValue={(v) =>
                    v === null || v === undefined ? '—' : `${Number(v).toFixed(3)} Gwei`
                  }
                  seriesName="Base fee"
                />}
                cursor={{ stroke: CHART_ACCENT, strokeOpacity: 0.4, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="baseFeeGwei"
                stroke={CHART_ACCENT}
                strokeWidth={2.25}
                fill="url(#grad-baseFee)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              Base fee
            </CardTitle>
            <CardDescription>This chain doesn&apos;t expose an EIP-1559 base fee.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

// Custom Recharts tooltip — solid background so it reads cleanly over any
// chart/page combo, with a coloured pill matching the series accent so the
// user can tell at a glance which chart they're hovering.
function ChartTooltip({
  active,
  payload,
  label,
  color,
  formatValue,
  seriesName,
}: {
  active?: boolean;
  payload?: Array<{ value: number | string | null }>;
  label?: number | string;
  color: string;
  formatValue: (v: number | string | null | undefined) => string;
  seriesName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-md border border-border bg-popover/95 backdrop-blur shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-foreground mb-1">Block #{label}</div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-muted-foreground">{seriesName}</span>
        <span className="ml-auto font-mono text-foreground">{formatValue(value)}</span>
      </div>
    </div>
  );
}

// Quiet card chrome — icon at muted-foreground, no colored border. Only
// the chart line/area inside carries the brand accent so the data itself
// draws the eye.
function ChartCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
