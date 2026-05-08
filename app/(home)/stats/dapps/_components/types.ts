export interface ChainStats {
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  protocolBreakdown: {
    protocol: string;
    slug: string | null;
    txCount: number;
    gasUsed: number;
    avaxBurned: number;
    gasShare: number;
  }[];
}

export type SortDirection = "asc" | "desc";

export type SortField =
  | "tvl"
  | "change_1d"
  | "change_7d"
  | "volume24h"
  | "mcap"
  | "name";

export type ChainStatsRange = "30d" | "90d" | "365d" | "all";

export const CHAIN_STATS_RANGES: Record<
  ChainStatsRange,
  { label: string; days: number }
> = {
  "30d": { label: "30D", days: 30 },
  "90d": { label: "90D", days: 90 },
  "365d": { label: "1Y", days: 365 },
  all: { label: "All", days: 0 },
};
