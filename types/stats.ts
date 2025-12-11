export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number | string;
  date: string;
}

export interface TimeSeriesMetric {
  data: TimeSeriesDataPoint[];
  current_value: number | string;
  change_24h: number;
  change_percentage_24h: number;
}

export interface ICMDataPoint {
  timestamp: number;
  date: string;
  messageCount: number;
  incomingCount: number;
  outgoingCount: number;
}

export interface ICMMetric {
  data: ICMDataPoint[];
  current_value: number;
  change_24h: number;
  change_percentage_24h: number;
}

export interface ChartDataPoint {
  day: string;
  value: number;
}

// Primary Network specific metrics
export interface PrimaryNetworkMetrics {
  validator_count: TimeSeriesMetric;
  validator_weight: TimeSeriesMetric;
  delegator_count: TimeSeriesMetric;
  delegator_weight: TimeSeriesMetric;
  validator_versions: string;
  last_updated: number;
}

// Validator version data
export interface VersionCount {
  version: string;
  count: number;
  percentage: number;
  amountStaked: number;
  stakingPercentage: number;
}

// L1 Chain interface
export interface BlockExplorer {
  name: string;
  link: string;
}

export interface NetworkToken {
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
  description?: string;
}

export interface L1Chain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  blockchainId?: string;
  subnetId: string;
  slug: string;
  color?: string;
  category?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  explorers?: BlockExplorer[];
  rpcUrl?: string;
  coingeckoId?: string;
  networkToken?: NetworkToken;
  sourcifySupport?: boolean;
  isTestnet?: boolean;
}

export type TimeRange = "30d" | "90d" | "1y" | "all";

// shareable config constants
export const STATS_CONFIG = {
  CACHE: {
    LONG_DURATION: 24 * 60 * 60 * 1000,  // 24 hours - for validator data
    SHORT_DURATION: 4 * 60 * 60 * 1000,  // 4 hours - for overview/aggregated data
  },
  TIME_RANGES: {
    '30d': { days: 30, pageSize: 365, fetchAllPages: false },
    '90d': { days: 90, pageSize: 500, fetchAllPages: true },
    '1y': { days: 365, pageSize: 1000, fetchAllPages: true },
    'all': { startTimestamp: 1600646400, pageSize: 2000, fetchAllPages: true }
  },
  ACTIVE_ADDRESSES_INTERVALS: {
    'day': 'day',
    'week': 'week', 
    'month': 'month'
  }, // active addresses intervals for different views
  AVALANCHE_GENESIS_TIMESTAMP: 1600646400,
  DATA_OFFSET_DAYS: 1,
} as const;

// shared timestamp calc - used across all stats APIs
export function getTimestampsFromTimeRange(timeRange: string): { startTimestamp: number; endTimestamp: number } {
  const now = Math.floor(Date.now() / 1000);
  const yesterday = now - (STATS_CONFIG.DATA_OFFSET_DAYS * 24 * 60 * 60); // End at yesterday for finalized data
  const config = STATS_CONFIG.TIME_RANGES[timeRange as keyof typeof STATS_CONFIG.TIME_RANGES];
  
  let startTimestamp: number;

  if (config && 'startTimestamp' in config) { startTimestamp = config.startTimestamp; } 
  else if (config && 'days' in config) { startTimestamp = yesterday - (config.days * 24 * 60 * 60); } 
  else { startTimestamp = yesterday - (30 * 24 * 60 * 60); }
  
  return { startTimestamp, endTimestamp: yesterday };
}

export function createTimeSeriesMetric(data: TimeSeriesDataPoint[]): TimeSeriesMetric {
  if (data.length === 0) {
    return {
      data: [],
      current_value: 'N/A',
      change_24h: 0,
      change_percentage_24h: 0
    };
  }

  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
  const currentValue = sortedData[0].value;
  const current = sortedData[0]; // Yesterday (most recent)
  const previous = sortedData.length > 1 ? sortedData[1] : current; // Day before yesterday
  
  const currentVal = typeof current.value === 'string' ? parseFloat(current.value) : current.value;
  const previousVal = typeof previous.value === 'string' ? parseFloat(previous.value) : previous.value;
  
  const change = currentVal - previousVal; 
  const changePercentage = previousVal !== 0 ? (change / previousVal) * 100 : 0;

  return {
    data: sortedData,
    current_value: currentValue,
    change_24h: change,
    change_percentage_24h: changePercentage
  };
}

// ONLY for overview page aggregation
export function createTimeSeriesMetricWithPeriodSum(data: TimeSeriesDataPoint[]): TimeSeriesMetric {
  if (data.length === 0) {
    return {
      data: [],
      current_value: 'N/A',
      change_24h: 0,
      change_percentage_24h: 0
    };
  }

  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
  
  // Sum all values in the period for overview totals
  const periodTotal = sortedData.reduce((sum, point) => {
    const value = typeof point.value === 'string' ? parseFloat(point.value) : point.value;
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // For change comparison
  const current = sortedData[0];
  const previous = sortedData.length > 1 ? sortedData[1] : current;
  
  const currentVal = typeof current.value === 'string' ? parseFloat(current.value) : current.value;
  const previousVal = typeof previous.value === 'string' ? parseFloat(previous.value) : previous.value;
  
  const change = currentVal - previousVal;
  const changePercentage = previousVal !== 0 ? (change / previousVal) * 100 : 0;

  return {
    data: sortedData,
    current_value: periodTotal,
    change_24h: change,
    change_percentage_24h: changePercentage
  };
}

// Standard ICM metric creation 
export function createICMMetric(data: ICMDataPoint[]): ICMMetric {
  if (data.length === 0) {
    return {
      data: [],
      current_value: 0,
      change_24h: 0,
      change_percentage_24h: 0
    };
  }

  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
  const currentValue = sortedData[0].messageCount;
  const latest = sortedData[0];
  const previous = sortedData.length > 1 ? sortedData[1] : latest;
  const change = latest.messageCount - previous.messageCount;
  const changePercentage = previous.messageCount !== 0 ? (change / previous.messageCount) * 100 : 0;

  return {
    data: sortedData,
    current_value: currentValue,
    change_24h: change,
    change_percentage_24h: changePercentage
  };
}

// ONLY for overview page
export function createICMMetricWithPeriodSum(data: ICMDataPoint[]): ICMMetric {
  if (data.length === 0) {
    return {
      data: [],
      current_value: 0,
      change_24h: 0,
      change_percentage_24h: 0
    };
  }

  const sortedData = data.sort((a, b) => b.timestamp - a.timestamp);
  const periodTotal = sortedData.reduce((sum, point) => sum + point.messageCount, 0);
  const current = sortedData[0];
  const previous = sortedData.length > 1 ? sortedData[1] : current;
  const change = previous.messageCount - current.messageCount;
  const changePercentage = current.messageCount !== 0 ? (change / current.messageCount) * 100 : 0;

  return {
    data: sortedData,
    current_value: periodTotal,
    change_24h: change,
    change_percentage_24h: changePercentage
  };
}
