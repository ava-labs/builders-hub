export type TableView = "summary" | "validators";

export type TimeRangeKey = "day" | "week" | "month";

export type SortDirection = "asc" | "desc";

export const TIME_RANGE_CONFIG: Record<
  TimeRangeKey,
  { label: string; shortLabel: string; secondsInRange: number }
> = {
  day: { label: "Daily", shortLabel: "D", secondsInRange: 24 * 60 * 60 },
  week: { label: "Weekly", shortLabel: "W", secondsInRange: 7 * 24 * 60 * 60 },
  month: {
    label: "Monthly",
    shortLabel: "M",
    secondsInRange: 30 * 24 * 60 * 60,
  },
};

export interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number;
  tps: number;
  activeAddresses: number;
  icmMessages: number;
  marketCap: number | null;
  validatorCount: number | string;
}

export interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalMarketCap: number;
    totalValidators: number;
    activeChains: number;
    activeL1Count: number;
  };
  timeRange: TimeRangeKey;
  last_updated: number;
}

export interface AvaxSupplyData {
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  l1ValidatorFees: string;
}
