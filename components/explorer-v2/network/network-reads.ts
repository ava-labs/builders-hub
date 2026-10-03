import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import type { ExplorerRange } from "@/components/explorer-v2/time-range";

/* The first reads of the network scope's pages: the All Networks overview
   and the AVAX tab. The pages and the link warmer (warm-reads.ts) build
   their URLs here, so a hovered link reads what its page asks for. */

export const SUPPLY_URL = "/api/avax-supply";
/* DefiLlama's chain TVL, the same feed the DeFi tab reads */
export const DAPPS_URL = "/api/dapps";
export const STAKE_HISTORY_URL = "/api/primary-network-stats?timeRange=all";
export const BURN_HISTORY_URL = "/api/chain-stats/43114?metrics=cumulativeBurn&timeRange=1y";
/* the fee history asks for the one series it draws: the whole stats payload is 2.3 MB, and the
   server takes 2.3 s to build it when no cache holds it; this series is 26 KB and takes a few ms */
export const FEES_URL = "/api/chain-stats/43114?metrics=feesPaid&timeRange=1y";
export const ICM_FEES_URL = "/api/icm-contract-fees?timeRange=1y";

/* the overview aggregate's longest upstream window is a year: the ALL
   tick clamps to it, and the pulse labels say so */
export function overviewWindow(range: ExplorerRange): Exclude<ExplorerRange, "all"> {
  return range === "all" ? "year" : range;
}

export const overviewStatsUrl = (range: ExplorerRange) => `/api/overview-stats?timeRange=${overviewWindow(range)}`;

/** the whole network's daily activity, in the chain-stats window that holds two of the clock's windows */
export function networkSeriesUrl(days: number): string {
  const need = days * 2;
  const span = need <= 30 ? "30d" : need <= 90 ? "90d" : need <= 365 ? "1y" : "all";
  return `/api/chain-stats/all?metrics=txCount,activeAddresses,icmMessages&timeRange=${span}`;
}

/** AVAX's price for the clock's window: the upstream stops at a year, and the day clock gets hourly points */
export function priceHistoryUrl(days: number): string {
  const span = days <= 1 ? 1 : days <= 7 ? 7 : days <= 30 ? 30 : days <= 90 ? 90 : 365;
  return `/api/market-history/43114?days=${span}`;
}

/* ------------------------------------------------------------------ */
/* The overview's live boards: their chains and each chain's two feeds  */

export interface LiveChain {
  /** EVM chain id, the API route key */
  chainId: string;
  slug: string;
  name: string;
  logo: string;
  symbol: string;
}

/** a chain's blocks from its RPC, headers only; after `last` when given */
export const blocksFeed = (chainId: string, last?: number) =>
  `/api/explorer/${chainId}?blocksOnly=true${last ? `&lastFetchedBlock=${last}` : ""}`;

/** a chain's latest transactions from the indexer: a few to open on, more to keep up */
export const txsFeed = (chainId: string, first: boolean) => `/api/evm/${chainId}/txs?limit=${first ? 6 : 10}`;

/* one chain's row in the overview feed, as far as the roster reads it */
export interface RosterRow {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number | null;
}

/* the catalog, so a board row links into its chain's own explorer */
const catalogByChainId = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

/** the boards' roster: the window's busiest chains that an RPC reads, eight at most */
export function rosterOf(rows: RosterRow[]): LiveChain[] {
  return rows
    .slice()
    .sort((a, b) => (b.txCount ?? -1) - (a.txCount ?? -1))
    .flatMap((c) => {
      const catalog = catalogByChainId.get(String(c.chainId));
      if (!catalog?.rpcUrl) return [];
      return [
        {
          chainId: String(c.chainId),
          slug: catalog.slug,
          name: c.chainName,
          logo: c.chainLogoURI || catalog.chainLogoURI || "",
          symbol: catalog.networkToken?.symbol || "",
        },
      ];
    })
    .slice(0, 8);
}

/** the reads the boards open with, for the chains an overview feed names */
export function boardReads(rows: RosterRow[]): string[] {
  return rosterOf(rows).flatMap((c) => [blocksFeed(c.chainId), txsFeed(c.chainId, true)]);
}
