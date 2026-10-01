"use client";

import { useMemo } from "react";
import { useRememberedJson } from "@/components/explorer-v2/page-data";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { BURN_HISTORY_URL, STAKE_HISTORY_URL, networkSeriesUrl } from "./network-reads";

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
  const raw = useRememberedJson<unknown>(url);
  // pick is an inline lambda; the payload alone decides a new pick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (raw ? pick(raw) : null), [raw]);
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

export interface NetworkSeries {
  txCount: DayPoint[];
  activeAddresses: DayPoint[];
  icmMessages: DayPoint[];
}

/** the whole network's daily activity: the metrics API's mainnet rollup */
export function useNetworkSeries(days: number): NetworkSeries | null {
  return useJson(networkSeriesUrl(days), (raw) => {
    const r = raw as Record<string, { data?: Raw[] } | undefined>;
    return {
      txCount: complete(toPoints(r.txCount?.data)),
      activeAddresses: complete(toPoints(r.activeAddresses?.data)),
      icmMessages: complete(toPoints(r.icmMessages?.data, "messageCount")),
    };
  });
}

/** the Primary Network's stake by day, in AVAX: own stake plus delegations */
export function useStakeHistory(): DayPoint[] | null {
  return useJson(STAKE_HISTORY_URL, (raw) => {
    const r = raw as { validator_weight?: { data?: Raw[] }; delegator_weight?: { data?: Raw[] } };
    const delegated = new Map(toPoints(r.delegator_weight?.data).map((p) => [p.t, p.v]));
    const own = toPoints(r.validator_weight?.data);
    if (!own.length) return null;
    return complete(own.map((p) => ({ t: p.t, v: (p.v + (delegated.get(p.t) ?? 0)) / 1e9 })));
  });
}

/** every AVAX burned to date, by day */
export function useBurnHistory(): DayPoint[] | null {
  return useJson(BURN_HISTORY_URL, (raw) => {
    const rows = (raw as { cumulativeBurn?: { data?: Raw[] } }).cumulativeBurn?.data;
    return rows ? complete(toPoints(rows)) : null;
  });
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

/* compact figures in the C-Chain's voice: 57.8M */
export { fmtCompact };
