"use client";

import { useEffect, useState } from "react";
import type { PrimaryNetworkMetrics, TimeSeriesMetric } from "@/types/stats";
import { getValidatorFeeState } from "@/lib/pchain-node";

/* Shared feeds for the Primary Network's two instruments — Staking (the
   economics) and Validators (the set). Every endpoint returns a whole
   snapshot, so the hooks are plain one-shot loads; the pages compose
   whichever feeds they need and each section degrades alone. */

export interface SdkValidator {
  nodeId: string;
  /** nAVAX */
  amountStaked: string;
  /** nAVAX */
  amountDelegated: string;
  /** percent */
  delegationFee: string;
  delegatorCount: number;
  validationStatus: string;
  version?: string;
}

export interface P2pValidator {
  node_id: string;
  p50_uptime: number;
  /** nAVAX */
  total_stake: number;
  delegator_count: number;
  delegation_fee: number;
  version: string;
  days_left: number;
  miss_rate_14d: number;
  block_count_14d: number;
}

export interface StakingApy {
  data: { date: string; timestamp: number; supply: number; maxAPY: number; minAPY: number }[];
  current: { supply: number; totalBurned: number; maxAPY: number; minAPY: number };
}

function useLoad<T>(url: string, pick: (raw: unknown) => T | null) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((raw) => {
        if (cancelled) return;
        const picked = pick(raw);
        if (picked === null) setFailed(true);
        else setData(picked);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // pick is intentionally not a dependency — callers pass fresh inline
    // lambdas every render; re-fetching on identity change would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return { data, failed };
}

export function usePrimaryMetrics() {
  return useLoad<PrimaryNetworkMetrics>("/api/primary-network-stats?timeRange=all", (raw) =>
    raw && typeof raw === "object" ? (raw as PrimaryNetworkMetrics) : null,
  );
}

export function useSdkValidators() {
  return useLoad<SdkValidator[]>("/api/primary-network-validators", (raw) => {
    const list = (raw as { validators?: SdkValidator[] })?.validators;
    return Array.isArray(list) ? list : null;
  });
}

export function useP2pValidators() {
  return useLoad<Map<string, P2pValidator>>("/api/validators", (raw) => {
    if (!Array.isArray(raw)) return null;
    return new Map((raw as P2pValidator[]).map((v) => [v.node_id, v]));
  });
}

export function useStakingApy() {
  return useLoad<StakingApy>("/api/staking-apy", (raw) =>
    raw && typeof raw === "object" && Array.isArray((raw as StakingApy).data)
      ? (raw as StakingApy)
      : null,
  );
}

/* the total-seats overlay (Primary + L1 validators, post-Etna) */
export function useTotalSeats() {
  return useLoad<TimeSeriesMetric>("/api/total-ecosystem-validators?timeRange=all", (raw) => {
    const metric = (raw as { total_validator_seats?: TimeSeriesMetric })?.total_validator_seats;
    return metric?.data ? metric : null;
  });
}

/* the same feed, all three series — the L1 economy section reads the
   split (stake-backed Primary seats vs pay-as-you-go L1 seats) */
export interface EcosystemSeats {
  total: TimeSeriesMetric | null;
  l1: TimeSeriesMetric | null;
  primary: TimeSeriesMetric | null;
}

export function useEcosystemSeats() {
  return useLoad<EcosystemSeats>("/api/total-ecosystem-validators?timeRange=all", (raw) => {
    const r = raw as {
      total_validator_seats?: TimeSeriesMetric;
      l1_validator_seats?: TimeSeriesMetric;
      primary_network_validator_count?: TimeSeriesMetric;
    };
    if (!r?.total_validator_seats?.data) return null;
    return {
      total: r.total_validator_seats ?? null,
      l1: r.l1_validator_seats ?? null,
      primary: r.primary_network_validator_count ?? null,
    };
  });
}

/* the ACP-77 continuous fee price (nAVAX per second per L1 seat), straight
   from the node — null while loading or if the RPC is unreachable */
export function useValidatorFeePrice(network = "mainnet") {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getValidatorFeeState(network).then((f) => {
      if (!cancelled) setPrice(f ? f.price : null);
    });
    return () => {
      cancelled = true;
    };
  }, [network]);
  return price;
}

/* ------------------------------------------------------------------ */
/* staking money-flow — reward payouts behind us, unlocks ahead        */
/* ------------------------------------------------------------------ */

export interface MoneyFlow {
  rewards: { date: string; avax: number; payouts: number }[];
  unlocks: { date: string; avax: number; stakers: number }[];
}

/** the feed serves fixed computed windows — pick the smallest that covers the clock */
export function moneyFlowWindow(rangeDays: number): 30 | 90 | 365 {
  return rangeDays <= 30 ? 30 : rangeDays <= 90 ? 90 : 365;
}

/* fetched at the window covering the page clock; resets on window change
   so a stale wide window never poses as the narrow one */
export function useMoneyFlow(network: string, rangeDays: number) {
  const days = moneyFlowWindow(rangeDays);
  const [flow, setFlow] = useState<MoneyFlow | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFlow(null);
    setFailed(false);
    fetch(`/api/pchain-activity/${network}?days=${days}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: MoneyFlow) => {
        if (!cancelled) setFlow(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [network, days]);
  return { flow, failed, days };
}

/* ------------------------------------------------------------------ */
/* series shaping — the API returns newest-first with a partial today  */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  day: string;
  value: number;
}

/* ------------------------------------------------------------------ */
/* staking ratio — stake joined with the emission feed's daily supply  */
/* ------------------------------------------------------------------ */

export interface RatioPoint {
  day: string;
  /** staked share of circulating supply, % */
  pct: number;
  /** AVAX */
  staked: number;
  /** AVAX */
  supply: number;
}

/* the full oldest-first series; days the two feeds don't share drop.
   One join, two instruments: the staking page's trend card and the
   total-stake sheet's full-axes section read the same points. */
export function joinStakingRatio(
  metrics: PrimaryNetworkMetrics | null,
  apy: StakingApy | null,
): RatioPoint[] {
  if (!apy?.data) return [];
  const supplyByDay = new Map(apy.data.map((p) => [p.date, p.supply]));
  const delegated = new Map(toSeries(metrics?.delegator_weight).map((p) => [p.day, p.value]));
  return toSeries(metrics?.validator_weight).flatMap((p) => {
    const supply = supplyByDay.get(p.day);
    if (!supply) return [];
    const staked = (p.value + (delegated.get(p.day) ?? 0)) / NANO;
    return [{ day: p.day, pct: (staked / supply) * 100, staked, supply }];
  });
}

export function toSeries(metric: TimeSeriesMetric | null | undefined): SeriesPoint[] {
  if (!metric?.data) return [];
  const today = new Date().toISOString().split("T")[0];
  return metric.data
    .filter((p) => p.date !== today)
    .map((p) => ({
      day: p.date,
      value: typeof p.value === "string" ? Number.parseFloat(p.value) : p.value,
    }))
    .filter((p) => Number.isFinite(p.value))
    .reverse();
}

/** last N days of an oldest-first series; 0 = everything */
export function windowSeries<T>(points: T[], days: number): T[] {
  if (!days || points.length <= days) return points;
  return points.slice(points.length - days);
}

/** stride-sample long series so the all-time view stays light */
export function thin<T>(points: T[], max = 280): T[] {
  if (points.length <= max) return points;
  const stride = points.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * stride)]);
  out[out.length - 1] = points[points.length - 1];
  return out;
}

export const NANO = 1e9;

export function num(v: number | string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** compact AVAX quantity — 213.5M, 41.7K, 987 */
export function fmtCompact(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
