"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Landmark, Wallet, PieChart } from "lucide-react";
import {
  DATS as STATIC_DATS,
  ETFS as STATIC_ETFS,
  DAT_HISTORY,
  ETF_HISTORY,
  type DatEntry,
  type EtfEntry,
  type HistoryPoint,
} from "@/constants/dat-etf";

interface ApiResponse {
  dats: DatEntry[];
  etfs: EtfEntry[];
  updatedAt: string;
}

function formatAvax(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

function TickerBadge({ ticker }: { ticker: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700">
      {ticker}
    </span>
  );
}

/** Compact label/value box used inside entity cards — kept identical for DAT and ETF. */
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-mono font-semibold text-black dark:text-white mt-0.5">{value}</div>
    </div>
  );
}

/** Aggregate stat card at the top — matches the Network Overview cards style. */
function AggregateStatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <Card className="bg-white dark:bg-black border-gray-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="text-2xl font-mono font-semibold text-gray-900 dark:text-white">
        {value}
        {unit && <span className="text-xs font-sans text-muted-foreground ml-1">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function HoldingsHistoryChart({
  title,
  subtitle,
  history,
  currentTotal,
  color,
}: {
  title: string;
  subtitle: string;
  history: HistoryPoint[];
  currentTotal?: number;
  color: string;
}) {
  // Overlay live total onto the most recent bucket so the chart's endpoint matches the stat card.
  const data = useMemo(() => {
    const cloned = history.map((h) => ({ ...h }));
    if (currentTotal != null && cloned.length > 0) {
      cloned[cloned.length - 1].avax = currentTotal;
    }
    return cloned;
  }, [history, currentTotal]);

  const gradientId = `dat-etf-gradient-${color.replace("#", "")}`;

  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-base font-medium text-black dark:text-white">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "currentColor" }}
              className="text-zinc-500 dark:text-zinc-400"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "currentColor" }}
              className="text-zinc-500 dark:text-zinc-400"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatAvax(v)}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: color, strokeOpacity: 0.2 }}
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border, #e4e4e7)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${formatAvax(value)} AVAX`, "Holdings"]}
              labelFormatter={(label, payload) => {
                const note = payload?.[0]?.payload?.label;
                return note ? `${label} — ${note}` : label;
              }}
            />
            <Area
              type="monotone"
              dataKey="avax"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Shared card shell so DAT and ETF cards are visually identical in chrome. */
function EntityCard({
  name,
  ticker,
  meta,
  logoSrc,
  logoSrcDark,
  logoTone,
  stats,
}: {
  name: string;
  ticker: string;
  /** Optional small-print line shown under the logo. Hidden when omitted. */
  meta?: string;
  logoSrc: string;
  logoSrcDark?: string;
  logoTone?: "light" | "dark" | "color";
  stats: { label: string; value: string }[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Prefer an explicit dark variant; otherwise fall back to logoTone-based CSS inversion.
  const effectiveLogoSrc = isDark && logoSrcDark ? logoSrcDark : logoSrc;
  let invertClass = "";
  if (!logoSrcDark) {
    if (logoTone === "light") invertClass = "invert dark:invert-0";
    else if (logoTone === "dark") invertClass = "dark:invert";
  }

  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 h-full flex flex-col">
      {/* Header — logo left, ticker badge right */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="h-8 max-w-[180px] flex items-center min-w-0">
          <Image
            src={effectiveLogoSrc}
            alt={name}
            width={180}
            height={32}
            className={`h-6 sm:h-7 w-auto max-w-full object-contain object-left ${invertClass}`}
          />
        </div>
        <TickerBadge ticker={ticker} />
      </div>

      {/* Sub-line: optional small print (sponsor, etc.) */}
      {meta && <p className="text-xs text-muted-foreground mb-3 truncate">{meta}</p>}

      {/* Stats grid — the primary signal */}
      <div className="grid grid-cols-2 gap-2 mt-auto">
        {stats.map((s) => (
          <StatBox key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
    </Card>
  );
}

function DatCard({ dat }: { dat: DatEntry }) {
  return (
    <EntityCard
      name={dat.name}
      ticker={dat.ticker}
      logoSrc={dat.logoSrc}
      logoSrcDark={dat.logoSrcDark}
      logoTone={dat.logoTone}
      stats={[
        { label: "AVAX held", value: formatAvax(dat.avaxHoldings) },
        { label: "Treasury AUM", value: formatUsd(dat.aum) },
      ]}
    />
  );
}

function EtfCard({ etf }: { etf: EtfEntry }) {
  const feeLabel =
    etf.sponsorFee === 0 && etf.sponsorFeeAfterWaiver
      ? `0% (then ${etf.sponsorFeeAfterWaiver.toFixed(2)}%)`
      : `${etf.sponsorFee.toFixed(2)}%`;

  return (
    <EntityCard
      name={etf.name}
      ticker={etf.ticker}
      meta={etf.sponsor}
      logoSrc={etf.logoSrc}
      logoSrcDark={etf.logoSrcDark}
      logoTone={etf.logoTone}
      stats={[
        { label: "AVAX held", value: formatAvax(etf.avaxHoldings) },
        { label: "AUM", value: formatUsd(etf.aum) },
        { label: "Sponsor fee", value: feeLabel },
        {
          label: "Staking",
          value: etf.stakingMax && etf.stakingMax > 0 ? `up to ${etf.stakingMax}%` : "—",
        },
      ]}
    />
  );
}

export function DatEtfSection() {
  const [dats, setDats] = useState<DatEntry[]>(STATIC_DATS);
  const [etfs, setEtfs] = useState<EtfEntry[]>(STATIC_ETFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/avax-dat-etf");
        if (!res.ok) return;
        const data: ApiResponse = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.dats)) setDats(data.dats);
        if (Array.isArray(data.etfs)) setEtfs(data.etfs);
      } catch {
        // Silently fall back to static — the section still renders meaningfully.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalDatAvax = dats.reduce((sum, d) => sum + (d.avaxHoldings || 0), 0);
  const totalEtfAvax = etfs.reduce((sum, e) => sum + (e.avaxHoldings || 0), 0);
  const totalEtfAum = etfs.reduce((sum, e) => sum + (e.aum || 0), 0);
  const combined = totalDatAvax + totalEtfAvax;

  return (
    <section className="space-y-4 sm:space-y-6">
      {/* Section header — matches ChainMetricsPage section pattern */}
      <div className="space-y-2">
        <h2 className="text-lg sm:text-2xl font-medium text-black dark:text-white">DATs &amp; ETFs</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Avalanche-native Digital Asset Treasuries and U.S.-listed ETFs holding AVAX
        </p>
      </div>

      {/* Aggregate stats — mirrors Network Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AggregateStatCard icon={Building2} label="Total DAT holdings" value={formatAvax(totalDatAvax)} unit="AVAX" hint={`${dats.length} entities`} />
        <AggregateStatCard icon={Landmark} label="Total ETF holdings" value={formatAvax(totalEtfAvax)} unit="AVAX" hint={`${etfs.length} funds`} />
        <AggregateStatCard icon={Wallet} label="Combined" value={formatAvax(combined)} unit="AVAX" hint="DATs + ETFs" />
        <AggregateStatCard icon={PieChart} label="Total ETF AUM" value={formatUsd(totalEtfAum)} hint="Across all listed funds" />
      </div>

      {/* History charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HoldingsHistoryChart
          title="DAT AVAX Holdings Over Time"
          subtitle="Combined treasury holdings, monthly"
          history={DAT_HISTORY}
          currentTotal={totalDatAvax}
          color="#E84142"
        />
        <HoldingsHistoryChart
          title="ETF AVAX Holdings Over Time"
          subtitle="Combined ETF-held AVAX, monthly"
          history={ETF_HISTORY}
          currentTotal={totalEtfAvax}
          color="#3B82F6"
        />
      </div>

      {/* DATs section — full width, 3 across on desktop */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-zinc-500" />
          <h3 className="text-base font-medium text-black dark:text-white">Digital Asset Treasuries</h3>
          <span className="text-xs text-muted-foreground">({dats.length})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {dats.map((dat) => (
            <DatCard key={dat.id} dat={dat} />
          ))}
        </div>
      </div>

      {/* ETFs section — full width, 3 across on desktop */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="w-4 h-4 text-zinc-500" />
          <h3 className="text-base font-medium text-black dark:text-white">ETFs</h3>
          <span className="text-xs text-muted-foreground">({etfs.length})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {etfs.map((etf) => (
            <EtfCard key={etf.id} etf={etf} />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        VAVX market price pulled live from Yahoo Finance; remaining figures sourced from issuer filings,
        press releases, and the AVAX One Blueprint dashboard.{loading ? " Refreshing…" : ""}
      </p>
    </section>
  );
}
