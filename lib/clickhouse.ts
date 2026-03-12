// ClickHouse client for querying C-Chain analytics data
const CLICKHOUSE_URL = process.env.CLICKHOUSE_PROXY_URL || '';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'readonly';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || '';
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'default';

// C-Chain ID
export const C_CHAIN_ID = 43114;

export interface ClickHouseResponse<T> {
  meta: { name: string; type: string }[];
  data: T[];
  rows: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

export async function queryClickHouse<T>(sql: string): Promise<ClickHouseResponse<T>> {
  const response = await fetch(CLICKHOUSE_URL, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': CLICKHOUSE_USER,
      'X-ClickHouse-Key': CLICKHOUSE_PASSWORD,
      'X-ClickHouse-Database': CLICKHOUSE_DATABASE,
    },
    body: sql.includes('FORMAT') ? sql : `${sql} FORMAT JSON`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ClickHouse query failed: ${errorText}`);
  }

  return response.json();
}

// Helper to convert address to unhex format for queries
export function toUnhex(address: string): string {
  // Remove 0x prefix and lowercase
  return address.toLowerCase().replace('0x', '');
}

// Build WHERE clause for multiple addresses
export function buildAddressFilter(addresses: string[], column: string = 'to'): string {
  if (addresses.length === 0) return '1=0';
  if (addresses.length === 1) {
    return `${column} = unhex('${toUnhex(addresses[0])}')`;
  }
  const unhexList = addresses.map(a => `unhex('${toUnhex(a)}')`).join(', ');
  return `${column} IN (${unhexList})`;
}

// Build swap_prices CTE for on-chain AVAX/USD price derivation
// Hourly median from Trader Joe V1 + Pangolin USDC/WAVAX Swap events
export function buildSwapPricesCTE(timeFilter: string): string {
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

// Build trace_attribution CTE: "received minus given" self-gas per contract.
// For each known address, computes gas_used from traces WHERE to=address (received)
// minus gas_used from traces WHERE from=address (given away to sub-calls).
// Filters to CALL/CREATE/CREATE2 — excludes DELEGATECALL (keeps gas with proxy)
// and STATICCALL (read-only, gas already counted in parent).
export function buildTraceAttributionCTE(addresses: string[], timeFilter: string): string {
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

// Protocol stats from transactions
export interface ProtocolStats {
  txCount: number;
  totalGas: number;
  avaxBurned: number;
  uniqueUsers: number;
  avgGasPerTx: number;
}

// Get stats for a list of contract addresses (with optional time filter)
// days = 0 or undefined means all-time
export async function getProtocolStats(addresses: string[], days?: number): Promise<ProtocolStats> {
  if (addresses.length === 0) {
    return { txCount: 0, totalGas: 0, avaxBurned: 0, uniqueUsers: 0, avgGasPerTx: 0 };
  }

  const addressFilter = buildAddressFilter(addresses);
  const timeFilter = days && days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';

  const sql = `
    SELECT
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as avax_burned,
      uniqExact(from) as unique_users
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
  }>(sql);

  const data = result.data[0];
  const txCount = parseInt(data.tx_count) || 0;

  return {
    txCount,
    totalGas: parseInt(data.total_gas) || 0,
    avaxBurned: data.avax_burned || 0,
    uniqueUsers: parseInt(data.unique_users) || 0,
    avgGasPerTx: txCount > 0 ? Math.round(parseInt(data.total_gas) / txCount) : 0,
  };
}

// Daily activity for a protocol
export interface DailyActivity {
  date: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  uniqueUsers: number;
}

export async function getProtocolDailyActivity(
  addresses: string[],
  days: number = 90
): Promise<DailyActivity[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      toDate(block_time) as date,
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as avax_burned,
      uniqExact(from) as unique_users
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${days} DAY
    GROUP BY date
    ORDER BY date
  `;

  const result = await queryClickHouse<{
    date: string;
    tx_count: string;
    total_gas: string;
    avax_burned: number;
    unique_users: string;
  }>(sql);

  return result.data.map(row => ({
    date: row.date,
    txCount: parseInt(row.tx_count) || 0,
    gasUsed: parseInt(row.total_gas) || 0,
    avaxBurned: row.avax_burned || 0,
    uniqueUsers: parseInt(row.unique_users) || 0,
  }));
}

// Top protocols by gas usage
export interface TopProtocolByGas {
  address: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
}

export async function getTopContractsByGas(
  addresses: string[],
  limit: number = 50
): Promise<TopProtocolByGas[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      lower(concat('0x', hex(to))) as address,
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as avax_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
    GROUP BY to
    ORDER BY total_gas DESC
    LIMIT ${limit}
  `;

  const result = await queryClickHouse<{
    address: string;
    tx_count: string;
    total_gas: string;
    avax_burned: number;
  }>(sql);

  return result.data.map(row => ({
    address: row.address,
    txCount: parseInt(row.tx_count) || 0,
    gasUsed: parseInt(row.total_gas) || 0,
    avaxBurned: row.avax_burned || 0,
  }));
}

// C-Chain overall stats
export interface ChainOverviewStats {
  totalTxCount: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  latestBlock: number;
  latestBlockTime: string;
}

export async function getCChainOverview(): Promise<ChainOverviewStats> {
  // Get watermark for latest block
  const watermarkSql = `
    SELECT block_number, block_time
    FROM sync_watermark
    WHERE chain_id = ${C_CHAIN_ID}
  `;

  const watermarkResult = await queryClickHouse<{
    block_number: number;
    block_time: string;
  }>(watermarkSql);

  // Get aggregated stats - this is expensive, should be cached heavily
  const statsSql = `
    SELECT
      count() as total_tx,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as total_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
  `;

  const statsResult = await queryClickHouse<{
    total_tx: string;
    total_gas: string;
    total_burned: number;
  }>(statsSql);

  const watermark = watermarkResult.data[0];
  const stats = statsResult.data[0];

  return {
    totalTxCount: parseInt(stats.total_tx) || 0,
    totalGasUsed: parseInt(stats.total_gas) || 0,
    totalAvaxBurned: stats.total_burned || 0,
    latestBlock: watermark?.block_number || 0,
    latestBlockTime: watermark?.block_time || '',
  };
}

// Get recent transactions for a protocol
export interface RecentTransaction {
  hash: string;
  blockNumber: number;
  blockTime: string;
  from: string;
  to: string;
  gasUsed: number;
  avaxBurned: number;
  success: boolean;
}

export async function getProtocolRecentTransactions(
  addresses: string[],
  limit: number = 20
): Promise<RecentTransaction[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      lower(concat('0x', hex(hash))) as tx_hash,
      block_number,
      block_time,
      lower(concat('0x', hex(from))) as from_addr,
      lower(concat('0x', hex(to))) as to_addr,
      gas_used as tx_gas_used,
      toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price) / 1e18 as avax_burned,
      success
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
    ORDER BY block_number DESC
    LIMIT ${limit}
  `;

  const result = await queryClickHouse<{
    tx_hash: string;
    block_number: number;
    block_time: string;
    from_addr: string;
    to_addr: string;
    tx_gas_used: number;
    avax_burned: number;
    success: boolean;
  }>(sql);

  return result.data.map(row => ({
    hash: row.tx_hash,
    blockNumber: row.block_number,
    blockTime: row.block_time,
    from: row.from_addr,
    to: row.to_addr,
    gasUsed: row.tx_gas_used,
    avaxBurned: row.avax_burned,
    success: row.success,
  }));
}

// Monthly activity summary for historical analysis
export interface MonthlyActivity {
  month: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  uniqueUsers: number;
}

export async function getProtocolMonthlyActivity(
  addresses: string[],
  months: number = 24
): Promise<MonthlyActivity[]> {
  if (addresses.length === 0) return [];

  const addressFilter = buildAddressFilter(addresses);

  const sql = `
    SELECT
      toStartOfMonth(block_time) as month,
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as avax_burned,
      uniqExact(from) as unique_users
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${months} MONTH
    GROUP BY month
    ORDER BY month
  `;

  const result = await queryClickHouse<{
    month: string;
    tx_count: string;
    total_gas: string;
    avax_burned: number;
    unique_users: string;
  }>(sql);

  return result.data.map(row => ({
    month: row.month,
    txCount: parseInt(row.tx_count) || 0,
    gasUsed: parseInt(row.total_gas) || 0,
    avaxBurned: row.avax_burned || 0,
    uniqueUsers: parseInt(row.unique_users) || 0,
  }));
}

// Total chain gas/tx stats for coverage measurement
export interface TotalChainStats {
  totalTx: number;
  totalGas: number;
  totalBurned: number;
}

export async function getTotalChainGas(days: number): Promise<TotalChainStats> {
  const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';

  const sql = `
    SELECT
      count() as total_tx,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as total_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      ${timeFilter}
  `;

  const result = await queryClickHouse<{
    total_tx: string;
    total_gas: string;
    total_burned: number;
  }>(sql);

  const data = result.data[0];
  return {
    totalTx: parseInt(data.total_tx) || 0,
    totalGas: parseInt(data.total_gas) || 0,
    totalBurned: data.total_burned || 0,
  };
}

// ============ Contract Gas X-Ray Queries (raw_traces) ============

// Validate and convert address to safe hex string for SQL interpolation.
// Defense-in-depth: even if the API caller forgets to validate, this
// ensures only exactly 40 lowercase hex chars ever reach the query.
function toSafeHex(address: string): string {
  const hex = toUnhex(address);
  if (!/^[a-f0-9]{40}$/.test(hex)) {
    throw new Error(`Invalid address for query: ${address}`);
  }
  return hex;
}

// Query A: Who calls this contract and how much gas each caller sends
export function buildContractGasReceivedQuery(address: string, days: number): string {
  const hex = toSafeHex(address);
  const trTimeFilter = days > 0 ? `AND tr.block_time >= now() - INTERVAL ${days} DAY` : '';
  const tTimeFilter = days > 0 ? `AND t.block_time >= now() - INTERVAL ${days} DAY` : '';
  return `
    SELECT
      lower(concat('0x', hex(tr.\`from\`))) as address,
      sum(tr.gas_used) as gas,
      sum(toFloat64(tr.gas_used) * toFloat64(t.base_fee_per_gas + t.gas_price)) / 1e18 as avax,
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

// Query B: What contracts does this contract call and how much gas it gives
export function buildContractGasGivenQuery(address: string, days: number): string {
  const hex = toSafeHex(address);
  const trTimeFilter = days > 0 ? `AND tr.block_time >= now() - INTERVAL ${days} DAY` : '';
  const tTimeFilter = days > 0 ? `AND t.block_time >= now() - INTERVAL ${days} DAY` : '';
  return `
    SELECT
      lower(concat('0x', hex(tr.\`to\`))) as address,
      sum(tr.gas_used) as gas,
      sum(toFloat64(tr.gas_used) * toFloat64(t.base_fee_per_gas + t.gas_price)) / 1e18 as avax,
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

// Query C: Transaction and caller summary for the target contract
export function buildContractTxSummaryQuery(address: string, days: number): string {
  const hex = toSafeHex(address);
  const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';
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

// Top unknown contracts (not in known address list) by gas
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
  const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';

  // Build exclusion list
  let exclusionFilter = '';
  if (knownAddresses.length > 0) {
    const unhexList = knownAddresses.map(a => `unhex('${toUnhex(a)}')`).join(', ');
    exclusionFilter = `AND to NOT IN (${unhexList})`;
  }

  const sql = `
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
  `;

  const result = await queryClickHouse<{
    address: string;
    tx_count: string;
    total_gas: string;
  }>(sql);

  return result.data.map(row => ({
    address: row.address,
    txCount: parseInt(row.tx_count) || 0,
    totalGas: parseInt(row.total_gas) || 0,
  }));
}

// Get gas consumption breakdown by protocol for ranking
export interface ProtocolGasRanking {
  protocol: string;
  addresses: string[];
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasShare: number; // percentage of total
}

export async function getProtocolGasRankings(
  protocolContracts: Map<string, string[]>, // protocol name -> addresses
  days: number = 30
): Promise<ProtocolGasRanking[]> {
  const allAddresses = Array.from(protocolContracts.values()).flat();
  if (allAddresses.length === 0) return [];

  const addressFilter = buildAddressFilter(allAddresses);

  const sql = `
    SELECT
      lower(concat('0x', hex(to))) as address,
      count() as tx_count,
      sum(gas_used) as total_gas,
      sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas + gas_price)) / 1e18 as avax_burned
    FROM raw_txs
    WHERE chain_id = ${C_CHAIN_ID}
      AND ${addressFilter}
      AND block_time >= now() - INTERVAL ${days} DAY
    GROUP BY to
  `;

  const result = await queryClickHouse<{
    address: string;
    tx_count: string;
    total_gas: string;
    avax_burned: number;
  }>(sql);

  // Map addresses back to protocols and aggregate
  const protocolStats = new Map<string, { txCount: number; gasUsed: number; avaxBurned: number; addresses: string[] }>();

  for (const [protocol, addresses] of protocolContracts.entries()) {
    const lowerAddresses = addresses.map(a => a.toLowerCase());
    protocolStats.set(protocol, { txCount: 0, gasUsed: 0, avaxBurned: 0, addresses: lowerAddresses });
  }

  // Aggregate by protocol
  for (const row of result.data) {
    for (const [protocol, stats] of protocolStats.entries()) {
      if (stats.addresses.includes(row.address)) {
        stats.txCount += parseInt(row.tx_count) || 0;
        stats.gasUsed += parseInt(row.total_gas) || 0;
        stats.avaxBurned += row.avax_burned || 0;
        break;
      }
    }
  }

  // Calculate total gas and create rankings
  const totalGas = Array.from(protocolStats.values()).reduce((sum, s) => sum + s.gasUsed, 0);

  const rankings: ProtocolGasRanking[] = Array.from(protocolStats.entries())
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

  return rankings;
}
