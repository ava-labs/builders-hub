/**
 * What our stats API actually holds for a chain.
 *
 * `/v2/chains` lists every chain with history in ClickHouse, including several
 * that stopped producing blocks months ago, so presence in that list says
 * nothing about whether a chart will have anything current in it. This asks the
 * only question the explorer cares about: when does the data end?
 *
 * The distinction matters because the three cases want different copy. A chain
 * we have never indexed has no data at all. A chain like Lamina1 has 119M
 * transactions of real history and simply stopped. Telling a visitor "no data"
 * in the second case is wrong, and telling them the chain "publishes no public
 * RPC endpoint" is wrong in both.
 */

import { resolveDedicatedMetricsChain, DEDICATED_STATS_BASE_URL } from "./dedicated-stats";

// Re-exported so existing server-side importers keep one place to look.
export { toStatsChainId } from "./dedicated-stats";

export type CoverageStatus = "live" | "historical" | "absent" | "unknown";

export interface ChainCoverage {
  status: CoverageStatus;
  /** Unix seconds of the most recent daily data point, when there is one. */
  lastDataAt?: number;
}

/**
 * How old the newest daily point may be before we call a chain stopped.
 *
 * Deliberately loose. A quiet chain can go a few days without a transaction,
 * and calling it dead because of that would be a worse error than being late to
 * notice a real outage. The chains this actually catches are 30+ days stale, so
 * the exact cutoff inside that gap does not matter.
 */
const STALE_AFTER_DAYS = 7;

const REQUEST_TIMEOUT_MS = 5000;

/** Chains our stats API serves. Everything else goes to the shared Metrics API. */
export function isServedByStatsApi(chainId: string): boolean {
  return resolveDedicatedMetricsChain(chainId) !== undefined;
}

/**
 * Ask our stats API when a chain's data ends.
 *
 * Returns "unknown" if the API cannot be reached. That case must not render as
 * "not indexed": an outage on our side is not evidence about the chain, and
 * claiming otherwise would put a false statement on the page.
 */
export async function fetchChainCoverage(chainId: string): Promise<ChainCoverage> {
  const resolved = resolveDedicatedMetricsChain(chainId);
  if (!resolved) return { status: "unknown" };

  const url = new URL(`${DEDICATED_STATS_BASE_URL}/v2/chains/${resolved}/metrics/txCount`);
  url.searchParams.set("timeInterval", "day");
  url.searchParams.set("pageSize", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      next: { revalidate: 900 },
    });
    if (!res.ok) return { status: "unknown" };

    const body = (await res.json()) as { results?: Array<{ timestamp?: number }> };
    const newest = Array.isArray(body.results) ? body.results[0] : undefined;
    const lastDataAt = Number(newest?.timestamp);
    if (!Number.isFinite(lastDataAt) || lastDataAt <= 0) return { status: "absent" };

    const ageDays = (Date.now() / 1000 - lastDataAt) / 86400;
    return { status: ageDays > STALE_AFTER_DAYS ? "historical" : "live", lastDataAt };
  } catch {
    return { status: "unknown" };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatCoverageDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The chain IDs our stats API actually indexes.
 *
 * `/evm-api/chains` is the authoritative list — it is built from what is in
 * ClickHouse, not from a catalog someone maintains by hand.
 *
 * Returns null if the API cannot be reached. Callers must treat that as "do not
 * know" and leave the page alone.
 */
export async function fetchIndexedChainIds(): Promise<Set<string> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${DEDICATED_STATS_BASE_URL}/evm-api/chains`, {
      signal: controller.signal,
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    const rows = Array.isArray(body)
      ? body
      : ((body as { chains?: unknown[] })?.chains ?? []);
    if (!Array.isArray(rows)) return null;
    return new Set(
      rows
        .map((c) => String((c as { chainId?: unknown })?.chainId ?? ""))
        .filter(Boolean),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
