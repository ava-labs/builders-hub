// DApp category type
export type DAppCategory =
  | 'dex'
  | 'lending'
  | 'nft'
  | 'gaming'
  | 'bridge'
  | 'yield'
  | 'derivatives'
  | 'launchpad'
  | 'other';

// Sub-protocol TVL breakdown (for consolidated protocols)
export interface SubProtocolTVL {
  name: string;
  slug: string;
  tvl: number;
  logo?: string;
}

// DApp data for leaderboard display
export interface DAppStats {
  id: string;
  name: string;
  slug: string;
  logo: string;
  category: DAppCategory;
  tvl: number;           // Avalanche TVL only (combined for consolidated protocols)
  change_1d: number | null;
  change_7d: number | null;
  volume24h?: number;
  mcap?: number;
  url?: string;
  twitter?: string;
  audits?: string[];
  description?: string;
  rank?: number;
  subProtocols?: SubProtocolTVL[];  // TVL breakdown by sub-protocol
}

// Aggregated metrics for the overview page
export interface DAppsMetrics {
  totalTVL: number;
  totalProtocols: number;
  total24hVolume: number;
  categoryBreakdown: Partial<Record<DAppCategory, number>>;
  avaxPrice?: {
    usd: number;
    usd_24h_change: number;
  };
}

// Detailed protocol data for individual dApp pages
export interface DAppDetail extends DAppStats {
  chains: string[];
  tvlHistory: { timestamp: number; value: number }[];
  chainTvls: Record<string, number>;
  token?: string;
  contracts?: {
    address: string;
    name: string;
    type: string;
  }[];
  audit_links?: string[];
  isLocalOnly?: boolean;
  subProtocols?: SubProtocolTVL[];  // TVL breakdown by sub-protocol (for consolidated protocols)
}

// Sort options for the leaderboard
export type DAppSortField = 'tvl' | 'change_1d' | 'change_7d' | 'volume24h' | 'mcap' | 'name';
export type SortDirection = 'asc' | 'desc';

export interface DAppSortConfig {
  field: DAppSortField;
  direction: SortDirection;
}

// Filter options
export interface DAppFilters {
  category: DAppCategory | 'all';
  search: string;
  minTVL?: number;
}

// API response types
export interface DAppsApiResponse {
  dapps: DAppStats[];
  metrics: DAppsMetrics;
}

// DefiLlama protocol interface
export interface DefiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  category: string;
  chains: string[];
  logo: string;
  url: string;
  description: string;
  twitter?: string;
  mcap?: number;
}

// Category metadata
export const DAPP_CATEGORIES: Record<DAppCategory, { name: string; color: string }> = {
  dex: { name: 'DEX', color: '#3b82f6' },
  lending: { name: 'Lending', color: '#10b981' },
  nft: { name: 'NFT', color: '#8b5cf6' },
  gaming: { name: 'Gaming', color: '#f59e0b' },
  bridge: { name: 'Bridge', color: '#ec4899' },
  yield: { name: 'Yield', color: '#06b6d4' },
  derivatives: { name: 'Derivatives', color: '#ef4444' },
  launchpad: { name: 'Launchpad', color: '#84cc16' },
  other: { name: 'Other', color: '#6b7280' },
};

// Map DefiLlama categories to our categories
export function mapDefiLlamaCategory(defiLlamaCategory: string): DAppCategory {
  const mapping: Record<string, DAppCategory> = {
    'Dexes': 'dex',
    'DEX': 'dex',
    'Lending': 'lending',
    'CDP': 'lending',
    'Borrowing': 'lending',
    'NFT Marketplace': 'nft',
    'NFT Lending': 'nft',
    'Gaming': 'gaming',
    'Bridge': 'bridge',
    'Cross Chain': 'bridge',
    'Yield': 'yield',
    'Yield Aggregator': 'yield',
    'Farm': 'yield',
    'Derivatives': 'derivatives',
    'Perpetuals': 'derivatives',
    'Options': 'derivatives',
    'Launchpad': 'launchpad',
    'Liquid Staking': 'yield',
    'Liquidity manager': 'yield',
    'Reserve Currency': 'other',
    'Algo-Stables': 'other',
    'Insurance': 'other',
    'Indexes': 'other',
    'Synthetics': 'derivatives',
    'Payments': 'other',
    'Privacy': 'other',
    'Staking': 'yield',
    'Services': 'other',
    'Oracle': 'other',
    'RWA': 'other',
    'Restaking': 'yield',
  };
  return mapping[defiLlamaCategory] || 'other';
}
