// Server-side client for the stats API.
//
// This replaces the direct ClickHouse connections that lib/explorer-clickhouse,
// lib/icm-clickhouse and lib/ictt-clickhouse used to open.

import { EXPLORER_API_BASE } from "./pchain-explorer";

export const STATS_API_BASE = EXPLORER_API_BASE;

export async function statsApi<T>(path: string, timeoutMs = 10_000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${STATS_API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) {
      if (res.status !== 404) {
        console.error(`[stats-api] ${path}: ${res.status} ${res.statusText}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[stats-api] ${path} failed:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
