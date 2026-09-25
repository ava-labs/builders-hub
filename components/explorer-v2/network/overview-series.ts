"use client";

import { useEffect, useState } from "react";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";

/* The histories behind the network figures. Each hook returns daily
   points, oldest first, so a figure can draw its spark and its move
   against the previous window. The headline numbers still come from
   their own feeds; these only give them a past. */

export interface DayPoint {
  /** unix seconds, UTC midnight */
  t: number;
  v: number;
}

/* the fewest days a trace is worth drawing for, as on the C-Chain */
export const SPARK_MIN_DAYS = 7;

function useJson<T>(url: string | null, pick: (raw: unknown) => T | null): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (!cancelled && raw) setData(pick(raw));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // pick is an inline lambda; the url alone decides a refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return data;
}

/* today's partial day would read as a collapse at the window's end */
export function complete(points: DayPoint[]): DayPoint[] {
  const today = Math.floor(Date.now() / 86_400_000) * 86_400;
  return points.filter((p) => p.t < today).sort((a, b) => a.t - b.t);
}

type Raw = { timestamp: number; value?: number; messageCount?: number };
const toPoints = (rows: Raw[] | undefined, key: "value" | "messageCount" = "value"): DayPoint[] =>
  (rows ?? []).flatMap((r) => {
    const v = r[key];
    return typeof v === "number" && Number.isFinite(v) ? [{ t: r.timestamp, v }] : [];
  });

/** the chain-stats window that holds two of the clock's windows */
function statsRange(days: number): string {
  const need = days * 2;
  return need <= 30 ? "30d" : need <= 90 ? "90d" : need <= 365 ? "1y" : "all";
}

export interface NetworkSeries {
  txCount: DayPoint[];
  activeAddresses: DayPoint[];
  icmMessages: DayPoint[];
}

/** the whole network's daily activity: the metrics API's mainnet rollup */
export function useNetworkSeries(days: number): NetworkSeries | null {
  return useJson(`/api/chain-stats/all?metrics=txCount,activeAddresses,icmMessages&timeRange=${statsRange(days)}`, (raw) => {
    const r = raw as Record<string, { data?: Raw[] } | undefined>;
    return {
      txCount: complete(toPoints(r.txCount?.data)),
      activeAddresses: complete(toPoints(r.activeAddresses?.data)),
      icmMessages: complete(toPoints(r.icmMessages?.data, "messageCount")),
    };
  });
}

/** AVAX's daily price, oldest first; the upstream stops at a year */
export function usePriceHistory(days: number): number[] | null {
  const span = days <= 7 ? 7 : days <= 30 ? 30 : days <= 90 ? 90 : 365;
  return useJson(`/api/market-history/43114?days=${span}`, (raw) => {
    const prices = (raw as { prices?: number[] }).prices;
    return Array.isArray(prices) && prices.length ? prices : null;
  });
}

/** every validator seat on the network, Primary and L1, by day. The feed's
 *  total drops the L1 seats on days their series is missing, which would
 *  read as the set halving, so only days that carry both parts count. */
export function useSeatHistory(): DayPoint[] | null {
  return useJson("/api/total-ecosystem-validators?timeRange=all", (raw) => {
    const r = raw as { l1_validator_seats?: { data?: Raw[] }; primary_network_validator_count?: { data?: Raw[] } };
    const primary = new Map(toPoints(r.primary_network_validator_count?.data).map((p) => [p.t, p.v]));
    const seats = toPoints(r.l1_validator_seats?.data).flatMap((p) => {
      const pn = primary.get(p.t);
      return pn === undefined ? [] : [{ t: p.t, v: p.v + pn }];
    });
    return seats.length ? complete(seats) : null;
  });
}

/** the Primary Network's stake by day, in AVAX: own stake plus delegations */
export function useStakeHistory(): DayPoint[] | null {
  return useJson("/api/primary-network-stats?timeRange=all", (raw) => {
    const r = raw as { validator_weight?: { data?: Raw[] }; delegator_weight?: { data?: Raw[] } };
    const delegated = new Map(toPoints(r.delegator_weight?.data).map((p) => [p.t, p.v]));
    const own = toPoints(r.validator_weight?.data);
    if (!own.length) return null;
    return complete(own.map((p) => ({ t: p.t, v: (p.v + (delegated.get(p.t) ?? 0)) / 1e9 })));
  });
}

/** every AVAX burned to date, by day */
export function useBurnHistory(): DayPoint[] | null {
  return useJson("/api/chain-stats/43114?metrics=cumulativeBurn&timeRange=1y", (raw) => {
    const rows = (raw as { cumulativeBurn?: { data?: Raw[] } }).cumulativeBurn?.data;
    return rows ? complete(toPoints(rows)) : null;
  });
}

/** a volume over the clock: the window's days as the spark, and the
 *  window's sum against the window before it */
export function flowWindow(points: DayPoint[] | null | undefined, days: number): { spark?: number[]; delta: number | null } {
  if (!points?.length) return { delta: null };
  const vals = points.map((p) => p.v);
  const cur = vals.slice(-days);
  const prev = vals.slice(-2 * days, -days);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const delta = prev.length === days && sum(prev) > 0 ? ((sum(cur) - sum(prev)) / sum(prev)) * 100 : null;
  return { spark: days >= SPARK_MIN_DAYS ? cur : undefined, delta };
}

/** a level over the clock (a count, a balance): the window's days as the
 *  spark, and the latest reading against the one the window opened on.
 *  Dated, not counted, so a feed with missing days still spans the window. */
export function levelWindow(points: DayPoint[] | null | undefined, days: number): { spark?: number[]; delta: number | null } {
  if (!points || points.length < 2) return { delta: null };
  const last = points[points.length - 1];
  const from = last.t - Math.max(days, SPARK_MIN_DAYS) * 86_400;
  const opensAt = last.t - days * 86_400;
  const open = [...points].reverse().find((p) => p.t <= opensAt);
  const spark = points.filter((p) => p.t >= from).map((p) => p.v);
  return { spark, delta: open && open.v > 0 ? ((last.v - open.v) / open.v) * 100 : null };
}

/* compact figures in the C-Chain's voice: 57.8M, $612.3M */
export { fmtCompact };
export const fmtUsdCompact = (v: number) => `$${fmtCompact(v)}`;
