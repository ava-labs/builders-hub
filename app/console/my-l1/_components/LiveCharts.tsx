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
import { Blocks, Clock, Fuel, Hash, Info, Pause, Play, RefreshCw, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PalettePicker } from '@/components/console/PalettePicker';
import { ChartThemePicker } from '@/components/console/ChartThemePicker';
import { useChartPalette } from '@/hooks/useChartPalette';
import { useChartTheme, type ChartThemeStyles } from '@/hooks/useChartTheme';
import type { ChartPalette } from '@/lib/console/palettes';
import { useL1RecentBlocks, type BlockSummary } from '@/hooks/useL1RecentBlocks';
import { cn } from '@/lib/utils';
import type { CombinedL1 } from '../_lib/types';

// All four charts share this syncId so Recharts mirrors the hover cursor
// across siblings — moving over one chart's block highlights the same
// block on every other chart at the same time.
const SYNC_ID = 'my-l1-livecharts';

// Charts are differentiated by title, icon, and chart-type (line/bar/area)
// — not color. The active accent comes from `useChartPalette` so users
// can repaint the dashboard from the section header. Card surface,
// axis-tick color, and grid-line color come from `useChartTheme` (light
// / dark / rich) so users can override the chart chrome independently
// from the page theme.

const RANGE_OPTIONS = [
  { count: 30, label: '30' },
  { count: 60, label: '60' },
  { count: 120, label: '120' },
  { count: 240, label: '240' },
] as const;

interface ChartPoint {
  block: number;
  /** Unix seconds (block.timestamp). Carried through so the tooltip can
   *  show when the block was mined, not just its height. */
  timestamp: number;
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
      timestamp: Number(cur.timestamp),
      blockTime,
      txCount: cur.txCount,
      gasUtilization: utilizationPct,
      baseFeeGwei,
    });
  }
  return points;
}

type XAxisMode = 'block' | 'time';

export function LiveCharts({ l1 }: { l1: CombinedL1 }) {
  const [windowSize, setWindowSize] = useState<number>(60);
  const [xAxisMode, setXAxisMode] = useState<XAxisMode>('block');
  const [paused, setPaused] = useState(false);
  const recent = useL1RecentBlocks(l1.rpcUrl, windowSize, paused);
  const { palette } = useChartPalette();
  const { styles: themeStyles } = useChartTheme();

  // Average block time observed in the current window. Drives the time
  // hint on each range option ("60 ~2m" vs "60 ~3h") so users can pick a
  // window in time-units they care about rather than guessing how many
  // blocks their chain produces per minute. null until we have ≥2 blocks.
  const avgBlockTimeSec = useMemo(() => {
    const blocks = recent.blocks;
    if (blocks.length < 2) return null;
    const sorted = [...blocks].sort((a, b) => Number(a.number - b.number));
    const totalSpan = Number(sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
    const samples = sorted.length - 1;
    if (samples <= 0 || totalSpan <= 0) return null;
    return totalSpan / samples;
  }, [recent.blocks]);

  // Description that used to live in a paragraph above the charts. Now
  // surfaces in a small (i) tooltip beside the section title so it stops
  // eating a vertical row of pixels.
  const windowSpanLabel =
    avgBlockTimeSec !== null
      ? ` (~${formatDurationShort(windowSize * avgBlockTimeSec)} of history)`
      : '';
  const refreshLabel = paused ? 'paused — click ▶ to resume' : 'refreshing every 15s';
  const description = `Live charts derived from this L1's RPC. Window: latest ${recent.blocks.length} of ${windowSize} blocks${windowSpanLabel} · ${refreshLabel}.`;

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
          <UITooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Resume live updates' : 'Pause live updates'}
                aria-pressed={paused}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  paused
                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-accent/40',
                )}
              >
                {paused ? (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {paused ? 'Resume live updates' : 'Pause live updates'}
            </TooltipContent>
          </UITooltip>
        </div>
        <div className="flex items-center gap-2">
          <PalettePicker />
          <ChartThemePicker />
          <XAxisModeToggle value={xAxisMode} onChange={setXAxisMode} />
          <RangeSelector
            value={windowSize}
            onChange={setWindowSize}
            avgBlockTimeSec={avgBlockTimeSec}
          />
        </div>
      </div>
      {recent.error && recent.blocks.length === 0 ? (
        <Card className={themeStyles.cardClass}>
          <CardHeader>
            <CardTitle>RPC unreachable</CardTitle>
            <CardDescription>
              Couldn&apos;t fetch recent blocks from {l1.rpcUrl}. The chain may be offline or
              spun down.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">
              {recent.error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={recent.refresh}
              disabled={recent.isLoading}
              aria-label="Retry fetching recent blocks"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5 mr-2', recent.isLoading && 'animate-spin')}
                aria-hidden="true"
              />
              {recent.isLoading ? 'Retrying…' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      ) : !recent.hasLoadedOnce ? (
        <ChartsSkeleton themeStyles={themeStyles} />
      ) : (
        <ChartsGrid
          blocks={recent.blocks}
          xAxisMode={xAxisMode}
          palette={palette}
          themeStyles={themeStyles}
        />
      )}
    </section>
  );
}

// Two-state toggle: render the X-axis as block numbers (default — best for
// debugging "what happened at block 5417946") or as wall-clock time (best
// for "what was the chain doing around 3pm"). The hover tooltip surfaces
// both pieces of info regardless of the toggle, so switching here only
// changes the axis labels — no information is hidden.
function XAxisModeToggle({
  value,
  onChange,
}: {
  value: XAxisMode;
  onChange: (mode: XAxisMode) => void;
}) {
  const options: Array<{ mode: XAxisMode; label: string; icon: typeof Hash }> = [
    { mode: 'block', label: 'Block', icon: Hash },
    { mode: 'time', label: 'Time', icon: Clock },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = value === opt.mode;
        const tooltipLabel = `Show X-axis as ${opt.label.toLowerCase()}`;
        return (
          <UITooltip key={opt.mode}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(opt.mode)}
                aria-pressed={isActive}
                aria-label={tooltipLabel}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                <span>{opt.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
          </UITooltip>
        );
      })}
    </div>
  );
}

// Pill-style range selector for the chart window. Larger windows are
// noticeably costlier on first load (parallel RPC fan-out), but the
// incremental poll keeps subsequent refresh traffic constant regardless
// of window size — so users can leave it on 240 without penalty.
//
// Each option renders a derived time hint ("~2m", "~3h") computed from
// the window's observed average block time so the picker is meaningful
// regardless of whether the chain produces a block every 100ms or every
// 3 minutes. The hint hides until we have enough samples to compute it.
function RangeSelector({
  value,
  onChange,
  avgBlockTimeSec,
}: {
  value: number;
  onChange: (n: number) => void;
  avgBlockTimeSec: number | null;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2">
        Blocks
      </span>
      {RANGE_OPTIONS.map((opt) => {
        const isActive = value === opt.count;
        // Time hint is computed but not rendered inline — surfaced via
        // a radix tooltip (instant, theme-styled) instead of the native
        // `title` attribute (~500ms delay, OS-styled). Pill stays compact;
        // the (i) tooltip beside the section title still surfaces the
        // active window's full time span for at-a-glance context.
        const hint =
          avgBlockTimeSec !== null
            ? formatDurationShort(opt.count * avgBlockTimeSec)
            : null;
        const tooltipLabel = hint ? `${opt.label} blocks · ~${hint}` : `${opt.label} blocks`;
        return (
          <UITooltip key={opt.count}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(opt.count)}
                aria-label={tooltipLabel}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
          </UITooltip>
        );
      })}
    </div>
  );
}

// Compact human-readable duration formatter. Stays single-line + ≤4 chars
// for typical values so it fits in the range pills without wrapping.
//   < 60s     → "Ns"
//   < 60m     → "Nm"
//   < 24h     → "Nh" (one decimal when under 10h, integer otherwise)
//   ≥ 24h     → "Nd"
function formatDurationShort(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) {
    const h = seconds / 3600;
    return h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
  }
  const d = seconds / 86_400;
  return d < 10 ? `${d.toFixed(1)}d` : `${Math.round(d)}d`;
}

function ChartsSkeleton({ themeStyles }: { themeStyles: ChartThemeStyles }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className={themeStyles.cardClass}>
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

// Build a Unix-second tick formatter whose granularity matches the actual
// time span of the chart window. The hover tooltip always carries
// "MMM DD, HH:MM:SS", so the axis itself only needs to surface the level
// of detail that actually changes between adjacent ticks — showing
// `HH:MM:SS` across a 4-day window just repeats meaningless seconds.
//
//   span > 24h  → "DD MMM HH:MM"  (e.g. "28 Apr 12:00") — keeps both
//                                  day-level orientation and hour-of-day
//                                  precision so consecutive ticks within
//                                  the same day stay distinguishable.
//   span > 1h   → "HH:MM"          (e.g. "10:11")
//   span ≤ 1h   → "HH:MM:SS"       (e.g. "10:11:16")
function makeTimeTickFormatter(spanSec: number): (v: number) => string {
  if (spanSec > 86_400) {
    return (v) =>
      new Date(v * 1000).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
  }
  if (spanSec > 3600) {
    return (v) =>
      new Date(v * 1000).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
  }
  return (v) =>
    new Date(v * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
}

function ChartsGrid({
  blocks,
  xAxisMode,
  palette,
  themeStyles,
}: {
  blocks: BlockSummary[];
  xAxisMode: XAxisMode;
  palette: ChartPalette;
  themeStyles: ChartThemeStyles;
}) {
  const points = useMemo(() => buildChartPoints(blocks), [blocks]);
  const hasBaseFee = points.some((p) => p.baseFeeGwei !== null);

  // Pull the active accent color out for the chart elements. Using the
  // [500] mid-shade gives the brightest, most saturated tone — line and
  // bar fills look sharp against the dark rich card background.
  const accent = palette.shades[500];
  // Stable gradient ID per palette so each accent gets its own def. The
  // chart titles already encode the metric so we suffix with `palette.name`
  // to avoid Recharts caching gradients between palette switches.
  const gradId = (suffix: string) =>
    `grad-${suffix}-${palette.name.toLowerCase()}`;

  // Common axis chrome shared by every chart. Inlined into each
  // `<XAxis>`/`<YAxis>` rather than wrapped in a custom component because
  // Recharts uses runtime child-type reflection on the chart container to
  // find its axes — wrapping in a non-recharts component makes Recharts
  // blind to them and they disappear.
  const axisStyleProps = {
    tick: { fontSize: 10, fill: themeStyles.axisTickColor },
    tickLine: { stroke: themeStyles.gridStroke, strokeOpacity: 0.4 },
    axisLine: { stroke: themeStyles.gridStroke, strokeOpacity: 0.4 },
  };

  // Total span of the visible window (last - first timestamp). Drives the
  // adaptive X-axis tick formatter — wider spans show only the day, narrow
  // spans show seconds. Recomputed only when points change.
  const windowSpanSec = useMemo(() => {
    if (points.length < 2) return 0;
    const first = points[0].timestamp;
    const last = points[points.length - 1].timestamp;
    return Math.max(0, last - first);
  }, [points]);

  // Factory output is a stable reference per span so Recharts doesn't
  // thrash over identity changes between renders within the same window.
  const timeTickFormatter = useMemo(
    () => makeTimeTickFormatter(windowSpanSec),
    [windowSpanSec],
  );

  // "28 Apr 12:00" is wider than either pure date or pure time labels, so
  // give it more breathing room to avoid collisions on narrow viewports.
  const timeMinTickGap = windowSpanSec > 86_400 ? 110 : 60;

  // Aggregate stats: averages over the window for the card sub-titles.
  const avgBlockTime = points.length
    ? (points.reduce((s, p) => s + p.blockTime, 0) / points.length).toFixed(2)
    : '—';
  const totalTx = points.reduce((s, p) => s + p.txCount, 0);
  const maxTx = points.reduce((m, p) => Math.max(m, p.txCount), 0);
  // Brand-new / idle L1s have all-zero tx counts. The bar chart renders
  // as a flat line of zero bars which reads as "broken", not "idle" — we
  // swap it for an empty-state at the same height so the grid layout
  // doesn't jump as soon as the first transaction lands.
  const isQuietWindow = points.length > 0 && totalTx === 0;
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
        themeStyles={themeStyles}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id={gradId('blockTime')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.gridStroke} strokeOpacity={0.25} />
            <XAxis
              dataKey={xAxisMode === 'time' ? 'timestamp' : 'block'}
              tickFormatter={xAxisMode === 'time' ? timeTickFormatter : undefined}
              minTickGap={xAxisMode === 'time' ? timeMinTickGap : 24}
              {...axisStyleProps}
            />
            <YAxis
              {...axisStyleProps}
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
              tickFormatter={(v: number) => `${v}s`}
              width={40}
            />
            <Tooltip
              content={
                <ChartTooltip
                  color={accent}
                  formatValue={(v) => `${Number(v)}s`}
                  seriesName="Block time"
                />
              }
              cursor={{ stroke: accent, strokeOpacity: 0.4, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="blockTime"
              stroke={accent}
              strokeWidth={2.25}
              fill={`url(#${gradId('blockTime')})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: themeStyles.activeDotStroke }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        icon={Blocks}
        title="Transactions per block"
        subtitle={
          isQuietWindow
            ? 'No activity in this window yet'
            : `${totalTx} tx · max ${maxTx} per block`
        }
        themeStyles={themeStyles}
      >
        {isQuietWindow ? (
          <ChartEmptyState
            icon={Blocks}
            height={260}
            title="No transactions yet"
            description="Send a transaction to this L1 — it'll show up here as soon as the next block lands."
          />
        ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id={gradId('txCount')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.9} />
                <stop offset="100%" stopColor={accent} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.gridStroke} strokeOpacity={0.25} />
            <XAxis
              dataKey={xAxisMode === 'time' ? 'timestamp' : 'block'}
              tickFormatter={xAxisMode === 'time' ? timeTickFormatter : undefined}
              minTickGap={xAxisMode === 'time' ? timeMinTickGap : 24}
              {...axisStyleProps}
            />
            <YAxis
              {...axisStyleProps}
              domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.1))]}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              content={
                <ChartTooltip
                  color={accent}
                  formatValue={(v) => String(v)}
                  seriesName="Transactions"
                />
              }
              cursor={{ fill: accent, fillOpacity: 0.08 }}
            />
            <Bar
              dataKey="txCount"
              fill={`url(#${gradId('txCount')})`}
              radius={[3, 3, 0, 0]}
              minPointSize={2}
            />
          </BarChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        icon={Fuel}
        title="Gas utilization"
        subtitle={`Avg ${avgUtilization}% of block limit`}
        themeStyles={themeStyles}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id={gradId('gasUtil')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.gridStroke} strokeOpacity={0.25} />
            <XAxis
              dataKey={xAxisMode === 'time' ? 'timestamp' : 'block'}
              tickFormatter={xAxisMode === 'time' ? timeTickFormatter : undefined}
              minTickGap={xAxisMode === 'time' ? timeMinTickGap : 24}
              {...axisStyleProps}
            />
            <YAxis
              domain={[0, 100]}
              {...axisStyleProps}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              content={
                <ChartTooltip
                  color={accent}
                  formatValue={(v) => `${Number(v).toFixed(2)}%`}
                  seriesName="Utilization"
                />
              }
              cursor={{ stroke: accent, strokeOpacity: 0.4, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="gasUtilization"
              stroke={accent}
              strokeWidth={2.25}
              fill={`url(#${gradId('gasUtil')})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: themeStyles.activeDotStroke }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {hasBaseFee ? (
        <ChartCard
          icon={Fuel}
          title="Base fee"
          subtitle={`Avg ${avgBaseFee} Gwei (EIP-1559)`}
          themeStyles={themeStyles}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id={gradId('baseFee')} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.gridStroke} strokeOpacity={0.25} />
              <XAxis
                dataKey={xAxisMode === 'time' ? 'timestamp' : 'block'}
                tickFormatter={xAxisMode === 'time' ? timeTickFormatter : undefined}
                minTickGap={xAxisMode === 'time' ? timeMinTickGap : 24}
                {...axisStyleProps}
              />
              <YAxis
                {...axisStyleProps}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
                tickFormatter={(v: number) => `${v.toFixed(2)}`}
                width={48}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    color={accent}
                    formatValue={(v) =>
                      v === null || v === undefined ? '—' : `${Number(v).toFixed(3)} Gwei`
                    }
                    seriesName="Base fee"
                  />
                }
                cursor={{ stroke: accent, strokeOpacity: 0.4, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="baseFeeGwei"
                stroke={accent}
                strokeWidth={2.25}
                fill={`url(#${gradId('baseFee')})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: themeStyles.activeDotStroke }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <Card className={themeStyles.cardClass}>
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
// user can tell at a glance which chart they're hovering. Also surfaces the
// block timestamp (mined time) so users can correlate hover blocks with
// real-world events without cross-referencing the explorer.
function ChartTooltip({
  active,
  payload,
  label,
  color,
  formatValue,
  seriesName,
}: {
  active?: boolean;
  // Recharts gives us `payload[0].payload` — the full data point — so we
  // can pull the timestamp without bolting on a second prop on every chart.
  payload?: Array<{ value: number | string | null; payload?: ChartPoint }>;
  label?: number | string;
  color: string;
  formatValue: (v: number | string | null | undefined) => string;
  seriesName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  // Read block + timestamp from the data point itself rather than from
  // the axis `label` — that way the tooltip is invariant to which dataKey
  // the X-axis is using (block-mode vs. time-mode toggle in the section
  // header). Both pieces of info show up regardless.
  const point = payload[0]?.payload;
  const blockNum = point?.block ?? label;
  const ts = point?.timestamp;
  // Locale-aware short date + HH:MM:SS — readable for fresh blocks (where
  // hovering across a window typically spans minutes) and still useful when
  // the user pans into older history. `undefined` locale falls back to the
  // browser's locale automatically.
  const dateLabel = typeof ts === 'number' && Number.isFinite(ts)
    ? new Date(ts * 1000).toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : null;
  return (
    <div className="rounded-md border border-border bg-popover/95 backdrop-blur shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-foreground">Block #{blockNum}</div>
      {dateLabel && (
        <div className="text-[10px] text-muted-foreground tabular-nums mb-1">{dateLabel}</div>
      )}
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
// Centered empty-state rendered inside a chart card when the underlying
// data is genuinely empty (vs. just loading). Matches the chart canvas
// height so the card layout doesn't jump when data starts flowing.
function ChartEmptyState({
  icon: Icon,
  height,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  height: number;
  title: string;
  description: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 text-center"
      style={{ height: `${height}px` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/70">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// Quiet card chrome — icon at muted-foreground, no colored border. Only
// the chart line/area inside carries the brand accent so the data itself
// draws the eye. Card surface comes from the theme picker (light / dark
// / rich) so users can flip between elevated, premium feel and pure
// light/dark cards independently from the page theme.
function ChartCard({
  icon: Icon,
  title,
  subtitle,
  themeStyles,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  themeStyles: ChartThemeStyles;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(themeStyles.cardClass, 'overflow-hidden')}>
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
