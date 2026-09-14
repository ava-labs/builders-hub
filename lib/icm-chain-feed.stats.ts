import "server-only";

import { statsApi } from "@/lib/stats-api";
import { mapStatsFeedPage, type IcmFeedPage, type StatsFeedPage } from "@/lib/icm-feed-map";

/**
 * The per-chain ICM feed, served from our own ClickHouse. The only source of ICM data.
 */
export async function fetchIcmFeedFromStats(opts: {
  chainId: string;
  blockchainId?: string;
  limit: number;
  beforeBlock?: number;
}): Promise<IcmFeedPage | null> {
  const { chainId, blockchainId, limit, beforeBlock } = opts;
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeBlock !== undefined) params.set("before", String(beforeBlock));

  const page = await statsApi<StatsFeedPage>(
    `/icm-api/chain/${chainId}/messages?${params.toString()}`,
  );
  // null means the API could not answer; the caller turns that into an
  // "unavailable" page rather than an empty one.
  if (!page || !Array.isArray(page.messages)) return null;

  return mapStatsFeedPage(page, blockchainId);
}
