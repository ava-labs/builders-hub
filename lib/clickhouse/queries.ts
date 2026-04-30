// ClickHouse domain query builders — CTEs, protocol stats, gas rankings, contract flow

import {
  queryClickHouse,
  C_CHAIN_ID,
  assertSafeTimeFilter,
  assertSafeDate,
  assertSafeDays,
  toUnhex,
  toSafeHex,
  buildAddressFilter,
} from './client';

// Re-export client utilities so consumers can import from either file
export { C_CHAIN_ID, buildAddressFilter, toUnhex, toSafeHex };

// --- CTE Builders ---

export function buildSwapPricesCTE(timeFilter: string): string {
  assertSafeTimeFilter(timeFilter);
  return `swap_prices AS (
    SELECT
      toStartOfHour(block_time) as price_hour,
      median(
        toFloat64(
          reinterpretAsUInt256(reverse(substring(data, 33, 32)))
          + reinterpretAsUInt256(reverse(substring(data, 97, 32)))
        ) * 1e12
        / toFloat64(
          reinterpretAsUInt256(reverse(substring(data, 1, 32)))
          + reinterpretAsUInt256(reverse(substring(data, 65, 32)))
        )
      ) as price_usd
    FROM raw_logs
    WHERE chain_id = ${C_CHAIN_ID}
      AND topic0 = unhex('d78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822')
      AND address IN (
        unhex('f4003f4efbe8691b60249e6afbd307abe7758adb'),
        unhex('0e0100ab771e9288e0aa97e11557e6654c3a9665')
      )
      AND length(data) >= 128
      AND (reinterpretAsUInt256(reverse(substring(data, 1, 32)))
          + reinterpretAsUInt256(reverse(substring(data, 65, 32)))) > 0
      ${timeFilter}
    GROUP BY price_hour
    HAVING price_usd > 0 AND price_usd < 100000
  )`;
}

export function buildTraceAttributionCTE(addresses: string[], timeFilter: string): string {
  assertSafeTimeFilter(timeFilter);
  const toFilter = buildAddressFilter(addresses, 'tr.to');
  const fromFilter = buildAddressFilter(addresses, 'tr.from');

  return `trace_attribution AS (
    SELECT
      address,
      tx_hash,
      greatest(sum(received) - sum(given), 0) AS self_gas
    FROM (
      SELECT
        lower(concat('0x', hex(tr.to))) AS address,
        tr.tx_hash AS tx_hash,
        toInt64(tr.gas_used) AS received,
        0 AS given
      FROM raw_traces tr
      WHERE tr.chain_id = ${C_CHAIN_ID}
        AND ${toFilter}
        AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
        ${timeFilter.replace(/\bblock_time\b/g, 'tr.block_time')}

      UNION ALL

      SELECT
        lower(concat('0x', hex(tr.from))) AS address,
        tr.tx_hash AS tx_hash,
        0 AS received,
        toInt64(tr.gas_used) AS given
      FROM raw_traces tr
      WHERE tr.chain_id = ${C_CHAIN_ID}
        AND ${fromFilter}
        AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
        ${timeFilter.replace(/\bblock_time\b/g, 'tr.block_time')}
    )
    GROUP BY address, tx_hash
    HAVING self_gas > 0
  )`;
}

// --- Protocol Stats ---

export interface ProtocolStats {
  txCount: number;
  totalGas: number;
  avaxBurned: number;
  uniqueUsers: number;
  avgGasPerTx: number;
}

export async function getProtocolStats(addresses: string[], days?: number): Promise<ProtocolStats> {
  if (addresses.length === 0) {
    return { txCount: 0, totalGas: 0, avaxBurned: 0, uniqueUsers: 0, avgGasPerTx: 0 };
  }

  const addressFilter = buildAddressFilter(addresses);
  const timeFilter = days && days > 0 ? `AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';

  const sql = `
    SELECT
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as avax_burned,
      uniqExact(\`from\`) as unique_users,
      avg(gas_used) as avg_gas
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      ${timeFilter}
  `;

  const result = await queryClickHouse<{
    tx_count: string;
    total_gas: string;
    avax_burned: number;
    unique_users: string;
    avg_gas: number;
  }>(sql);

  const data = result.data[0];
  return {
    txCount: parseInt(data.tx_count) || 0,
    totalGas: parseInt(data.total_gas) || 0,
    avaxBurned: data.avax_burned || 0,
    uniqueUsers: parseInt(data.unique_users) || 0,
    avgGasPerTx: data.avg_gas || 0,
  };
}

// --- Daily Activity ---

export interface DailyActivity {
  date: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
}

export async function getProtocolDailyActivity(
  addresses: string[],
  days: number = 30
): Promise<DailyActivity[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      toDate(block_time) as date,
      count() as tx_count,
      sum(gas_used) as gas_used,
      sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as avax_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY
    GROUP BY date
    ORDER BY date
  `;

  const result = await queryClickHouse<{
    date: string;
    tx_count: string;
    gas_used: string;
    avax_burned: number;
  }>(sql);

  return result.data.map(row => ({
    date: row.date,
    txCount: parseInt(row.tx_count) || 0,
    gasUsed: parseInt(row.gas_used) || 0,
    avaxBurned: row.avax_burned || 0,
  }));
}

// --- Top Contracts ---

export interface TopContract {
  address: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
}

export async function getTopContractsByGas(
  addresses: string[],
  days: number = 30,
  limit: number = 20
): Promise<TopContract[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      lower(concat('0x', hex(to))) as address,
      count() as tx_count,
      sum(gas_used) as gas_used,
      sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as avax_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY
    GROUP BY to
    ORDER BY gas_used DESC
    LIMIT ${limit}
  `;

  const result = await queryClickHouse<{
    address: string;
    tx_count: string;
    gas_used: string;
    avax_burned: number;
  }>(sql);

  return result.data.map(row => ({
    address: row.address,
    txCount: parseInt(row.tx_count) || 0,
    gasUsed: parseInt(row.gas_used) || 0,
    avaxBurned: row.avax_burned || 0,
  }));
}

// --- Chain Overview ---

export interface ChainOverviewStats {
  totalTxCount: number;
  totalGasUsed: number;
  avgGasPrice: number;
  avgBlockTime: number;
  latestBlock: number;
}

export async function getCChainOverview(): Promise<ChainOverviewStats> {
  const sql = `
    SELECT
      count() as total_tx,
      sum(gas_used) as total_gas,
      avg(gas_price) as avg_gas_price,
      (max(block_time) - min(block_time)) / max(block_number) as avg_block_time,
      max(block_number) as latest_block
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND block_time >= now() - INTERVAL 24 HOUR
  `;

  const result = await queryClickHouse<{
    total_tx: string;
    total_gas: string;
    avg_gas_price: number;
    avg_block_time: number;
    latest_block: number;
  }>(sql);

  const data = result.data[0];
  return {
    totalTxCount: parseInt(data.total_tx) || 0,
    totalGasUsed: parseInt(data.total_gas) || 0,
    avgGasPrice: data.avg_gas_price || 0,
    avgBlockTime: data.avg_block_time || 0,
    latestBlock: data.latest_block || 0,
  };
}

// --- Recent Transactions ---

export type RecentTransaction = {
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  gasUsed: number;
  gasPrice: number;
  blockTime: string;
};

export async function getProtocolRecentTransactions(
  addresses: string[],
  limit: number = 100
): Promise<RecentTransaction[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      lower(hex(hash)) as hash,
      block_number,
      lower(concat('0x', hex(\`from\`))) as from_addr,
      lower(concat('0x', hex(\`to\`))) as to_addr,
      gas_used,
      gas_price,
      block_time
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
    ORDER BY block_time DESC
    LIMIT ${limit}
  `;

  const result = await queryClickHouse<{
    hash: string;
    block_number: number;
    from_addr: string;
    to_addr: string;
    gas_used: number;
    gas_price: number;
    block_time: string;
  }>(sql);

  return result.data.map(row => ({
    hash: row.hash,
    blockNumber: row.block_number,
    from: row.from_addr,
    to: row.to_addr,
    gasUsed: row.gas_used,
    gasPrice: row.gas_price,
    blockTime: row.block_time,
  }));
}

// --- Monthly Activity ---

export type MonthlyActivity = { month: string; txCount: number; gasUsed: number; avaxBurned: number };

export async function getProtocolMonthlyActivity(
  addresses: string[],
  months: number = 12
): Promise<MonthlyActivity[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      toStartOfMonth(block_time) as month,
      count() as tx_count,
      sum(gas_used) as gas_used,
      sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as avax_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${assertSafeDays(months * 31)} DAY
    GROUP BY month
    ORDER BY month
  `;

  const result = await queryClickHouse<{
    month: string;
    tx_count: string;
    gas_used: string;
    avax_burned: number;
  }>(sql);

  return result.data.map(row => ({
    month: row.month,
    txCount: parseInt(row.tx_count) || 0,
    gasUsed: parseInt(row.gas_used) || 0,
    avaxBurned: row.avax_burned || 0,
  }));
}

// --- Total Chain Gas ---

export interface TotalChainStats {
  totalTx: number;
  totalGas: number;
  totalBurned: number;
}

export async function getTotalChainGas(
  days: number,
  startDate?: string | null,
  endDate?: string | null
): Promise<TotalChainStats> {
  const timeFilter = (startDate && endDate)
    ? `AND block_time >= '${assertSafeDate(startDate)}' AND block_time < '${assertSafeDate(endDate)}' + INTERVAL 1 DAY`
    : (days > 0 ? `AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '');

  const result = await queryClickHouse<{
    total_tx: string;
    total_gas: string;
    total_burned: number;
  }>(`
    SELECT
      count() as total_tx,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as total_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      ${timeFilter}
  `);

  const data = result.data[0];
  return {
    totalTx: parseInt(data.total_tx) || 0,
    totalGas: parseInt(data.total_gas) || 0,
    totalBurned: data.total_burned || 0,
  };
}

// --- Contract Gas X-Ray Queries ---

export function buildContractGasReceivedQuery(address: string, days: number): string {
  const hex = toSafeHex(address);
  const trTimeFilter = days > 0 ? `AND tr.block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';
  const tTimeFilter = days > 0 ? `AND t.block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';
  return `
    SELECT
      lower(concat('0x', hex(tr.\`from\`))) as address,
      sum(tr.gas_used) as gas,
      sum(toFloat64(tr.gas_used) * toFloat64(t.gas_price)) / 1e18 as avax,
      uniqExact(tr.tx_hash) as tx_count
    FROM raw_traces tr
    INNER JOIN raw_txs t ON tr.tx_hash = t.hash
      AND t.chain_id = ${C_CHAIN_ID}
      ${tTimeFilter}
    WHERE tr.chain_id = ${C_CHAIN_ID}
      AND tr.\`to\` = unhex('${hex}')
      AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
      ${trTimeFilter}
    GROUP BY tr.\`from\`
    ORDER BY gas DESC
  `;
}

export function buildContractGasGivenQuery(address: string, days: number): string {
  const hex = toSafeHex(address);
  const trTimeFilter = days > 0 ? `AND tr.block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';
  const tTimeFilter = days > 0 ? `AND t.block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';
  return `
    SELECT
      lower(concat('0x', hex(tr.\`to\`))) as address,
      sum(tr.gas_used) as gas,
      sum(toFloat64(tr.gas_used) * toFloat64(t.gas_price)) / 1e18 as avax,
      uniqExact(tr.tx_hash) as tx_count
    FROM raw_traces tr
    INNER JOIN raw_txs t ON tr.tx_hash = t.hash
      AND t.chain_id = ${C_CHAIN_ID}
      ${tTimeFilter}
    WHERE tr.chain_id = ${C_CHAIN_ID}
      AND tr.\`from\` = unhex('${hex}')
      AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
      ${trTimeFilter}
    GROUP BY tr.\`to\`
    ORDER BY gas DESC
  `;
}

export function buildContractTxSummaryQuery(address: string, days: number): string {
  const hex = toSafeHex(address);
  const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';
  return `
    SELECT
      uniqExact(tx_hash) as total_txs,
      uniqExact(tx_from) as unique_callers
    FROM raw_traces
    WHERE chain_id = ${C_CHAIN_ID}
      AND (\`to\` = unhex('${hex}') OR \`from\` = unhex('${hex}'))
      AND call_type IN ('CALL', 'CREATE', 'CREATE2')
      ${timeFilter}
  `;
}

// --- Unknown Contracts ---

export interface UnknownContract {
  address: string;
  txCount: number;
  totalGas: number;
}

export async function getTopUnknownContracts(
  knownAddresses: string[],
  days: number,
  limit: number = 20
): Promise<UnknownContract[]> {
  const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY` : '';

  let exclusionFilter = '';
  if (knownAddresses.length > 0) {
    const unhexList = knownAddresses.map(a => `unhex('${toUnhex(a)}')`).join(', ');
    exclusionFilter = `AND to NOT IN (${unhexList})`;
  }

  const result = await queryClickHouse<{
    address: string;
    tx_count: string;
    total_gas: string;
  }>(`
    SELECT
      lower(concat('0x', hex(to))) as address,
      count() as tx_count,
      sum(gas_used) as total_gas
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND to IS NOT NULL
      ${exclusionFilter}
      ${timeFilter}
    GROUP BY to
    ORDER BY total_gas DESC
    LIMIT ${limit}
  `);

  return result.data.map(row => ({
    address: row.address,
    txCount: parseInt(row.tx_count) || 0,
    totalGas: parseInt(row.total_gas) || 0,
  }));
}

// --- Gas Rankings ---

export interface ProtocolGasRanking {
  protocol: string;
  addresses: string[];
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasShare: number;
}

export async function getProtocolGasRankings(
  protocolContracts: Map<string, string[]>,
  days: number = 30
): Promise<ProtocolGasRanking[]> {
  const allAddresses = Array.from(protocolContracts.values()).flat();
  if (allAddresses.length === 0) return [];

  const addressFilter = buildAddressFilter(allAddresses);

  const result = await queryClickHouse<{
    address: string;
    tx_count: string;
    total_gas: string;
    avax_burned: number;
  }>(`
    SELECT
      lower(concat('0x', hex(to))) as address,
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as avax_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${assertSafeDays(days)} DAY
    GROUP BY to
  `);

  const protocolStats = new Map<string, { txCount: number; gasUsed: number; avaxBurned: number; addresses: string[] }>();

  for (const [protocol, addresses] of protocolContracts.entries()) {
    const lowerAddresses = addresses.map(a => a.toLowerCase());
    protocolStats.set(protocol, { txCount: 0, gasUsed: 0, avaxBurned: 0, addresses: lowerAddresses });
  }

  for (const row of result.data) {
    for (const [, stats] of protocolStats.entries()) {
      if (stats.addresses.includes(row.address)) {
        stats.txCount += parseInt(row.tx_count) || 0;
        stats.gasUsed += parseInt(row.total_gas) || 0;
        stats.avaxBurned += row.avax_burned || 0;
        break;
      }
    }
  }

  const totalGas = Array.from(protocolStats.values()).reduce((sum, s) => sum + s.gasUsed, 0);

  return Array.from(protocolStats.entries())
    .map(([protocol, stats]) => ({
      protocol,
      addresses: stats.addresses,
      txCount: stats.txCount,
      gasUsed: stats.gasUsed,
      avaxBurned: stats.avaxBurned,
      gasShare: totalGas > 0 ? (stats.gasUsed / totalGas) * 100 : 0,
    }))
    .filter(r => r.txCount > 0)
    .sort((a, b) => b.gasUsed - a.gasUsed);
}
