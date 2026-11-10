import type { ExplorerRange } from "@/components/explorer-v2/time-range";
import { catalogOf } from "@/lib/explorer-catalog";
import type { PchainNetwork } from "@/lib/pchain-explorer";

/* The first reads of the network scope's pages: the All Networks overview
   and the AVAX tab. The pages and the link warmer (warm-reads.ts) build
   their URLs here, so a hovered link reads what its page asks for. A
   mainnet URL names no network, so page memory and the CDN key it as
   before; a Fuji URL adds network=fuji. */

export const SUPPLY_URL = "/api/avax-supply";
/* DefiLlama's chain TVL, the same feed the DeFi tab reads */
export const DAPPS_URL = "/api/dapps";
export const STAKE_HISTORY_URL = "/api/primary-network-stats?timeRange=all";
export const BURN_HISTORY_URL = "/api/chain-stats/43114?metrics=cumulativeBurn&timeRange=1y";
/* the fee history asks for the one series it draws: the whole stats payload is 2.3 MB, and the
   server takes 2.3 s to build it when no cache holds it; this series is 26 KB and takes a few ms */
export const FEES_URL = "/api/chain-stats/43114?metrics=feesPaid&timeRange=1y";
export const ICM_FEES_URL = "/api/icm-contract-fees?timeRange=1y";
/* the C-Chain's fees so far today (UTC): the fee history above holds whole days only */
export const TODAY_FEES_URL = "/api/chain-stats/43114/today";

/* the overview aggregate's longest upstream window is a year: the ALL
   tick clamps to it, and the pulse labels say so */
export function overviewWindow(range: ExplorerRange): Exclude<ExplorerRange, "all"> {
  return range === "all" ? "year" : range;
}

export const overviewStatsUrl = (range: ExplorerRange, network: PchainNetwork = "mainnet") =>
  `/api/overview-stats?timeRange=${overviewWindow(range)}${network === "fuji" ? "&network=fuji" : ""}`;

/** the whole network's daily activity, in the chain-stats window that holds two of the clock's windows.
 *  The "all" rollup is mainnet's; "fuji" is Fuji's */
export function networkSeriesUrl(days: number, network: PchainNetwork = "mainnet"): string {
  const need = days * 2;
  const span = need <= 30 ? "30d" : need <= 90 ? "90d" : need <= 365 ? "1y" : "all";
  return `/api/chain-stats/${network === "fuji" ? "fuji" : "all"}?metrics=txCount,activeAddresses,icmMessages&timeRange=${span}`;
}

/** AVAX's price for the clock's window: the upstream stops at a year, and the day clock gets hourly points */
export function priceHistoryUrl(days: number): string {
  const span = days <= 1 ? 1 : days <= 7 ? 7 : days <= 30 ? 30 : days <= 90 ? 90 : 365;
  return `/api/market-history/43114?days=${span}`;
}

/* ------------------------------------------------------------------ */
/* The overview's live boards: their chains and each chain's feed      */

export interface LiveChain {
  /** EVM chain id, the API route key */
  chainId: string;
  slug: string;
  name: string;
  logo: string;
  symbol: string;
}

/** a chain's blocks from its RPC, headers only, after `last` when given,
 *  with their newest 3 transactions: the most a chain adds to the opening
 *  board */
export const blocksFeed = (chainId: string, last?: number) =>
  `/api/explorer/${chainId}?blocksOnly=true&txs=3${last ? `&lastFetchedBlock=${last}` : ""}`;

/* one chain's row in the overview feed, as far as the roster reads it */
export interface RosterRow {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number | null;
}

/** the boards' roster: the window's busiest chains that an RPC reads, eight at most. A chain with
 *  no transactions in the window stays off: on Fuji most rows have no count */
export function rosterOf(rows: RosterRow[], network: PchainNetwork = "mainnet"): LiveChain[] {
  // the network's catalog, so a board row links into its chain's own explorer
  const catalogByChainId = catalogOf(network);
  return rows
    .filter((c) => (c.txCount ?? 0) > 0)
    .sort((a, b) => (b.txCount ?? 0) - (a.txCount ?? 0))
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
export function boardReads(rows: RosterRow[], network: PchainNetwork = "mainnet"): string[] {
  return rosterOf(rows, network).map((c) => blocksFeed(c.chainId));
}
