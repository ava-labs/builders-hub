'use client';

import React, { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pause, Play, RefreshCw } from 'lucide-react';

import { Board, ChartBoard, SectionHeader } from '@/components/explorer-v2/ui';
import { PUNCH, QUIET } from '@/components/explorer-v2/evm/metric-charts';
import { TipPlate } from '@/components/explorer-v2/staking/bits';
import { useL1RecentBlocks, type BlockSummary } from '@/hooks/useL1RecentBlocks';
import { cn } from '@/lib/utils';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { ChartsSkeleton } from './charts/skeleton';

// All four charts share this syncId so Recharts mirrors the hover cursor across siblings: hovering a block on one
// chart highlights the same block on the others.
const SYNC_ID = 'my-l1-livecharts';
const CHART_HEIGHT = 176;

const RANGE_OPTIONS = [30, 60, 120, 240] as const;

const SEG = 'inline-flex border border-zinc-200 dark:border-zinc-800';
const SEG_BTN = 'h-7 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums transition-colors';
const SEG_ON = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
const SEG_OFF = 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';

interface ChartPoint {
  block: number;
  /** Unix seconds (block.timestamp), so the tooltip can say when the block was mined, not just its height. */
  timestamp: number;
  blockTime: number;
  txCount: number;
  gasUtilization: number;
  baseFeeGwei: number | null;
}

function buildChartPoints(blocks: BlockSummary[]): ChartPoint[] {
  // Block time is the gap to the previous block, so the window's first block has none and is skipped.
  const sorted = [...blocks].sort((a, b) => Number(a.number - b.number));
  const points: ChartPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    points.push({
      block: Number(cur.number),
      timestamp: Number(cur.timestamp),
      blockTime: Number(cur.timestamp - prev.timestamp),
      txCount: cur.txCount,
      gasUtilization: cur.gasLimit === 0n ? 0 : Number((cur.gasUsed * 10000n) / cur.gasLimit) / 100,
      baseFeeGwei: cur.baseFeePerGas !== null ? Number(cur.baseFeePerGas) / 1e9 : null,
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

  // The window's average block time, so each range option can say how much history it covers.
  const avgBlockTimeSec = useMemo(() => {
    const blocks = recent.blocks;
    if (blocks.length < 2) return null;
    const sorted = [...blocks].sort((a, b) => Number(a.number - b.number));
    const span = Number(sorted[sorted.length - 1].timestamp - sorted[0].timestamp);
    return span > 0 ? span / (sorted.length - 1) : null;
  }, [recent.blocks]);

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        title={paused ? 'Resume live updates' : 'Pause live updates (refreshes every 15s)'}
        className={cn(
          SEG,
          SEG_BTN,
          'items-center gap-1.5',
          paused ? 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300' : SEG_OFF,
        )}
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        {paused ? 'Paused' : 'Live'}
      </button>
      <div className={SEG} role="group" aria-label="X-axis">
        {(['block', 'time'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setXAxisMode(mode)}
            aria-pressed={xAxisMode === mode}
            className={cn(SEG_BTN, xAxisMode === mode ? SEG_ON : SEG_OFF)}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className={SEG} role="group" aria-label="Blocks in the window">
        {RANGE_OPTIONS.map((count) => {
          const hint = avgBlockTimeSec !== null ? ` · ~${formatDurationShort(count * avgBlockTimeSec)}` : '';
          return (
            <button
              key={count}
              type="button"
              onClick={() => setWindowSize(count)}
              aria-pressed={windowSize === count}
              title={`${count} blocks${hint}`}
              className={cn(SEG_BTN, windowSize === count ? SEG_ON : SEG_OFF)}
            >
              {count}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Live activity"
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400">
            {recent.blocks.length}/{windowSize} blocks
            {avgBlockTimeSec !== null && ` · ~${formatDurationShort(windowSize * avgBlockTimeSec)}`}
          </span>
        }
      />
      {controls}
      {recent.error && recent.blocks.length === 0 ? (
        <Board className="border-x border-t">
          <div className="flex flex-col gap-3 px-5 py-5">
            <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-50">RPC unreachable</p>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              Couldn&apos;t fetch recent blocks from <span className="font-mono">{l1.rpcUrl}</span>. The chain may be
              offline or spun down.
            </p>
            <p className="break-all font-mono text-[12px] text-red-600 dark:text-red-400">{recent.error}</p>
            <button
              type="button"
              onClick={recent.refresh}
              disabled={recent.isLoading}
              className="inline-flex h-9 w-fit items-center gap-2 border border-zinc-300 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', recent.isLoading && 'animate-spin')} />
              {recent.isLoading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </Board>
      ) : !recent.hasLoadedOnce ? (
        <ChartsSkeleton />
      ) : (
        <ChartsGrid blocks={recent.blocks} xAxisMode={xAxisMode} />
      )}
    </section>
  );
}

/** Short duration for range hints: 45s, 12m, 2.5h, 3d. */
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

/* The axis shows only the detail that changes between ticks: dates over a day, minutes over an hour, else seconds.
   The tooltip always carries the full time. */
function makeTimeTickFormatter(spanSec: number): (v: number) => string {
  const opts: Intl.DateTimeFormatOptions =
    spanSec > 86_400
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
      : spanSec > 3600
        ? { hour: '2-digit', minute: '2-digit', hour12: false }
        : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return (v) => new Date(v * 1000).toLocaleString(undefined, opts);
}

function Headline({ value, unit, sub }: { value: string; unit?: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <p className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
        {unit && <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>}
      </p>
      {sub && <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">{sub}</p>}
    </div>
  );
}

function ChartsGrid({ blocks, xAxisMode }: { blocks: BlockSummary[]; xAxisMode: XAxisMode }) {
  const points = useMemo(() => buildChartPoints(blocks), [blocks]);
  const hasBaseFee = points.some((p) => p.baseFeeGwei !== null);

  const windowSpanSec = points.length < 2 ? 0 : Math.max(0, points[points.length - 1].timestamp - points[0].timestamp);
  const timeTickFormatter = useMemo(() => makeTimeTickFormatter(windowSpanSec), [windowSpanSec]);

  // Recharts finds its axes by child type, so these are spread into each <XAxis>/<YAxis> rather than wrapped.
  const xAxis = {
    dataKey: xAxisMode === 'time' ? 'timestamp' : 'block',
    tickFormatter: xAxisMode === 'time' ? timeTickFormatter : undefined,
    minTickGap: xAxisMode === 'time' ? (windowSpanSec > 86_400 ? 110 : 60) : 32,
    tick: { fontSize: 10, fill: QUIET, fontFamily: 'var(--font-mono)' },
    tickLine: false,
    axisLine: { stroke: QUIET, strokeOpacity: 0.3 },
  } as const;
  const yAxis = {
    tick: { fontSize: 10, fill: QUIET, fontFamily: 'var(--font-mono)' },
    tickLine: false,
    axisLine: false,
  } as const;

  const avg = (f: (p: ChartPoint) => number, list = points) =>
    list.length ? list.reduce((s, p) => s + f(p), 0) / list.length : null;
  const avgBlockTime = avg((p) => p.blockTime);
  const totalTx = points.reduce((s, p) => s + p.txCount, 0);
  const maxTx = points.reduce((m, p) => Math.max(m, p.txCount), 0);
  const avgUtilization = avg((p) => p.gasUtilization);
  const baseFeePoints = points.filter((p) => p.baseFeeGwei !== null);
  const avgBaseFee = avg((p) => p.baseFeeGwei ?? 0, baseFeePoints);
  // A brand-new or idle L1 has all-zero blocks; a flat bar row reads as broken, so it gets an empty state instead.
  const isQuietWindow = points.length > 0 && totalTx === 0;

  const area = (key: keyof ChartPoint, extra?: { connectNulls?: boolean }) => (
    <Area
      type="monotone"
      dataKey={key}
      stroke="currentColor"
      strokeWidth={1.5}
      fill="currentColor"
      fillOpacity={0.08}
      dot={false}
      activeDot={{ r: 3, fill: PUNCH, stroke: 'none' }}
      isAnimationActive={false}
      {...extra}
    />
  );
  const tip = (format: (v: number | string | null | undefined) => string, name: string) => (
    <Tooltip
      content={<ChartTooltip formatValue={format} seriesName={name} />}
      cursor={{ stroke: QUIET, strokeOpacity: 0.4 }}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartBoard label="Block time">
        <Headline
          value={avgBlockTime === null ? '—' : avgBlockTime.toFixed(2)}
          unit="s avg"
          sub={`${points.length} samples`}
        />
        <div className="text-zinc-900 dark:text-zinc-100" style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis {...xAxis} />
              <YAxis
                {...yAxis}
                width={36}
                tickFormatter={(v: number) => `${v}s`}
                domain={[0, (m: number) => Math.ceil(m * 1.1)]}
              />
              {tip((v) => `${Number(v)}s`, 'Block time')}
              {area('blockTime')}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartBoard>

      <ChartBoard label="Transactions per block">
        <Headline
          value={totalTx.toLocaleString('en-US')}
          unit="tx"
          sub={isQuietWindow ? 'No activity yet' : `max ${maxTx} per block`}
        />
        {isQuietWindow ? (
          <div
            className="flex flex-col items-start justify-center gap-2 border border-zinc-200 px-5 dark:border-zinc-800"
            style={{ height: CHART_HEIGHT }}
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              No transactions yet
            </p>
            <p className="max-w-xs text-[12px] text-zinc-500 dark:text-zinc-400">
              Send a transaction to this L1 and it shows up with the next block.
            </p>
          </div>
        ) : (
          <div style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                syncId={SYNC_ID}
                data={points}
                barCategoryGap="22%"
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <XAxis {...xAxis} />
                <YAxis
                  {...yAxis}
                  width={28}
                  allowDecimals={false}
                  domain={[0, (m: number) => Math.max(1, Math.ceil(m * 1.1))]}
                />
                <Tooltip
                  content={<ChartTooltip formatValue={(v) => String(v)} seriesName="Transactions" />}
                  cursor={{ fill: 'rgba(161,161,170,0.08)' }}
                />
                <Bar dataKey="txCount" fill={QUIET} fillOpacity={0.85} minPointSize={1} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartBoard>

      <ChartBoard label="Gas utilization">
        <Headline
          value={avgUtilization === null ? '—' : avgUtilization.toFixed(2)}
          unit="% avg"
          sub="of the block gas limit"
        />
        <div className="text-zinc-900 dark:text-zinc-100" style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis {...xAxis} />
              <YAxis {...yAxis} width={36} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              {tip((v) => `${Number(v).toFixed(2)}%`, 'Utilization')}
              {area('gasUtilization')}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartBoard>

      <ChartBoard label="Base fee">
        {hasBaseFee ? (
          <>
            <Headline value={avgBaseFee === null ? '—' : avgBaseFee.toFixed(3)} unit="Gwei avg" sub="EIP-1559" />
            <div className="text-[#E6212F]" style={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart syncId={SYNC_ID} data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis {...xAxis} />
                  <YAxis
                    {...yAxis}
                    width={44}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    domain={[0, (m: number) => Math.ceil(m * 1.1)]}
                  />
                  {tip((v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(3)} Gwei`), 'Base fee')}
                  {area('baseFeeGwei', { connectNulls: true })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            This chain doesn&apos;t expose an EIP-1559 base fee.
          </p>
        )}
      </ChartBoard>
    </div>
  );
}

/* The explorer's tooltip plate: the block, when it was mined, and the value. It reads the block and time from the data
   point itself, so it reads the same whichever X-axis is shown. */
function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  seriesName,
}: {
  active?: boolean;
  payload?: Array<{ value: number | string | null; payload?: ChartPoint }>;
  label?: number | string;
  formatValue: (v: number | string | null | undefined) => string;
  seriesName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  const ts = point?.timestamp;
  const when =
    typeof ts === 'number' && Number.isFinite(ts)
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
    <TipPlate>
      <p className="font-mono text-[10px] text-zinc-500">
        Block #{point?.block ?? label}
        {when && ` · ${when}`}
      </p>
      <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {formatValue(payload[0]?.value)} <span className="font-normal text-zinc-500">{seriesName}</span>
      </p>
    </TipPlate>
  );
}
