// Barrel re-export — all existing imports from '@/lib/clickhouse' continue to work.
// Implementation split into client.ts (connection + validation) and queries.ts (CTEs + domain queries).

export {
  C_CHAIN_ID,
  queryClickHouse,
  buildAddressFilter,
  toUnhex,
  toSafeHex,
  assertSafeTimeFilter,
  assertSafeDate,
  assertSafeDays,
  type ClickHouseResponse,
} from './clickhouse/client';

export {
  buildSwapPricesCTE,
  buildTraceAttributionCTE,
  getProtocolStats,
  getProtocolDailyActivity,
  getTopContractsByGas,
  getCChainOverview,
  getProtocolRecentTransactions,
  getProtocolMonthlyActivity,
  getTotalChainGas,
  buildContractGasReceivedQuery,
  buildContractGasGivenQuery,
  buildContractTxSummaryQuery,
  getTopUnknownContracts,
  getProtocolGasRankings,
  type ProtocolStats,
  type DailyActivity,
  type TopContract,
  type ChainOverviewStats,
  type TotalChainStats,
  type UnknownContract,
  type ProtocolGasRanking,
} from './clickhouse/queries';
