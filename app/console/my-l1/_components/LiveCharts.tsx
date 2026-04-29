'use client';

import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Blocks, Fuel, Info, Timer } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useL1RecentBlocks, type BlockSummary } from '@/hooks/useL1RecentBlocks';
import type { CombinedL1 } from '../_lib/types';

// All four charts share this syncId so Recharts mirrors the hover cursor
// across siblings — moving over one chart's block highlights the same
// block on every other chart at the same time.
const SYNC_ID = 'my-l1-livecharts';

// Single-accent palette. Charts are differentiated by title, icon, and
// chart-type (line/bar/area) — not color. Using one brand-aligned accent
// keeps the page feeling like a coherent product surface, not a "rainbow
// dashboard." Avalanche red (#E84142) is the project's primary.
const CHART_ACCENT = '#E84142';
const GRID_STROKE = '#71717a'; // zinc-500 — visible on both themes at low opacity
const AXIS_TICK_COLOR = '#71717a'; // same — readable axis labels in both themes

const RANGE_OPTIONS = [
  { count: 30, label: '30' },
  { count: 60, label: '60' },
  { count: 120, label: '120' },
  { count: 240, label: '240' },
] as const;

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
      cur.gasLimit === 0n ? 0 : Number((cur.gasUsed * 10000n) / cur.gasLimit) / 100;
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

export function LiveCharts({ l1 }: { l1: CombinedL1 }) {
  const [windowSize, setWindowSize] = useState<number>(60);
  const recent = useL1RecentBlocks(l1.rpcUrl, windowSize);
  // Description that used to live in a paragraph above the charts. Now
  // surfaces in a small (i) tooltip beside the section title so it stops
  // eating a vertical row of pixels.
  const description = `Live charts derived from this L1's RPC. Window: latest ${recent.blocks.length} of ${windowSize} blocks · refreshing every 15s.`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Live activity
          </h2>
          <UITooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About live activity"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent/40 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {description}
            </TooltipContent>
          </UITooltip>
        </div>
        <RangeSelector value={windowSize} onChange={setWindowSize} />
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
    </section>
  );
}

// Pill-style range selector for the chart window. Larger windows are
// noticeably costlier on first load (parallel RPC fan-out), but the
// incremental poll keeps subsequent refresh traffic constant regardless
// of window size — so users can leave it on 240 without penalty.
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
          <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
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
              content={
                <ChartTooltip
                  color={CHART_ACCENT}
                  formatValue={(v) => `${Number(v)}s`}
                  seriesName="Block time"
                />
              }
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
          <BarChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
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
              content={
                <ChartTooltip
                  color={CHART_ACCENT}
                  formatValue={(v) => String(v)}
                  seriesName="Transactions"
                />
              }
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
          <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
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
              content={
                <ChartTooltip
                  color={CHART_ACCENT}
                  formatValue={(v) => `${Number(v).toFixed(2)}%`}
                  seriesName="Utilization"
                />
              }
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
        <ChartCard icon={Fuel} title="Base fee" subtitle={`Avg ${avgBaseFee} Gwei (EIP-1559)`}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
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
                content={
                  <ChartTooltip
                    color={CHART_ACCENT}
                    formatValue={(v) =>
                      v === null || v === undefined ? '—' : `${Number(v).toFixed(3)} Gwei`
                    }
                    seriesName="Base fee"
                  />
                }
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
