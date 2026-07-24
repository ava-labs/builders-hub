"use client";
import { useState, type JSX } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Reward-curve visual for the Helicon ACP-285 section: reward rate as a function of
// staking duration, today's curve vs. Helicon after the 90-day consumption-rate ramp.
// The math mirrors app/api/staking-apy/route.ts so the site stays internally consistent.
// ACP-285's only change is the minimum consumption rate (10% -> 7.5%); the maximum
// (12%, at the 1-year point) is untouched, so the two curves converge at 365 days.

const MAX_SUPPLY = 720_000_000; // AVAX supply cap
const MAX_CR = 0.12; // consumption rate at max (1-year) duration — unchanged by ACP-285
const MINTING_PERIOD = 365; // days
const CURRENT_MIN_CR = 0.1; // today's floor
const HELICON_MIN_CR = 0.075; // ACP-285 floor after the ramp

// ponytail: P-Chain supply snapshot (473.1M AVAX, platform.getCurrentSupply on
// 2026-07-21) instead of a live fetch. Supply grows over time, so these rates drift
// down slowly; for numbers that always track parafi/live, fetch current.supply from
// /api/staking-apy and pass it in as a prop.
const SUPPLY = 473_115_409;

const CURRENT_MIN_DAYS = 14; // 2 weeks — today's minimum (ACP-273 drops it)
const HELICON_MIN_DAYS = 2; // 48 hours (ACP-273)

// Effective consumption rate: linear interpolation from the floor to MAX_CR over 0..365 days.
function ecr(days: number, minCR: number): number {
  const t = Math.min(1, Math.max(0, days / MINTING_PERIOD));
  return minCR * (1 - t) + MAX_CR * t;
}

// Simple annualized reward rate (APR), matching the repo's staking-apy formula.
function apr(days: number, minCR: number): number {
  return ((MAX_SUPPLY - SUPPLY) / SUPPLY) * ecr(days, minCR) * 100;
}

// APY: the APR auto-compounded each staking period across a year (the ACP-236
// auto-renew case). Equals APR at the 1-year point, which is a single period.
function apy(days: number, minCR: number): number {
  const periods = MINTING_PERIOD / days;
  const periodRate = apr(days, minCR) / 100 / periods;
  return ((1 + periodRate) ** periods - 1) * 100;
}
// Anchor (APR, supply 473.1M): 14d today 5.26%, 14d Helicon 4.00% (drops ~1.3pp),
// 365d ~6.26% on both — matches parafi's calculator and the section copy.

const DURATIONS = [2, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];

const round = (n: number): number => Math.round(n * 100) / 100;

type Metric = "apr" | "apy";

export function StakingRewardCurveChart(): JSX.Element {
  const [metric, setMetric] = useState<Metric>("apr");
  const rate = metric === "apr" ? apr : apy;

  const data = DURATIONS.map((days) => ({
    days,
    current: days >= CURRENT_MIN_DAYS ? round(rate(days, CURRENT_MIN_CR)) : null,
    helicon: days >= HELICON_MIN_DAYS ? round(rate(days, HELICON_MIN_CR)) : null,
  }));

  return (
    <div className="w-full my-6 p-4 border rounded-lg bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Reward rate by staking duration
        </span>
        <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
          {(["apr", "apy"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={
                "px-3 py-1 transition-colors " +
                (metric === m
                  ? "bg-[#E84142] text-white"
                  : "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800")
              }
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="days"
            type="number"
            domain={[0, 365]}
            ticks={[2, 30, 90, 180, 270, 365]}
            tickFormatter={(d) => `${d}d`}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            label={{ value: "Staking duration", position: "insideBottom", offset: -12, fill: "#9ca3af", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            label={{ value: `${metric.toUpperCase()} (%)`, angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 12 }}
          />
          <Tooltip
            formatter={(v: number, name: string) => [v != null ? `${v}%` : "—", name]}
            labelFormatter={(d) => `${d} days`}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend verticalAlign="top" height={30} wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="current"
            name="Today"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="helicon"
            name="Helicon (post-ramp)"
            stroke="#E84142"
            strokeWidth={3}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        ACP-285 lowers the minimum consumption rate from 10% to 7.5% <strong>while leaving the
        maximum (1-year) rate untouched</strong>, so the curve steepens and the two lines meet at
        365 days. APY assumes rewards auto-compound each period (ACP-236). Rates use an
        approximate current supply of 473M AVAX and the network&apos;s standard rewards formula.
      </div>
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
        Based on the current P-Chain AVAX supply — as supply grows toward the 720M cap
        over time, the whole curve drifts gradually lower.
      </div>
    </div>
  );
}
