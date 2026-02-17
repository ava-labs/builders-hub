import { NextResponse } from 'next/server';
import { queryClickHouse, C_CHAIN_ID, buildAddressFilter, getTotalChainGas } from '@/lib/clickhouse';
import { CONTRACT_REGISTRY, PROTOCOL_SLUGS } from '@/lib/contracts';

// Cache for 10 minutes - heavy aggregation query
export const revalidate = 600;

export interface ChainStatsResponse {
  // Overall chain stats
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  latestBlock: number;
  latestBlockTime: string;

  // Protocol breakdown (top 30)
  protocolBreakdown: {
    protocol: string;
    slug: string | null;
    category: string;
    txCount: number;
    gasUsed: number;
    avaxBurned: number;
    gasShare: number;
  }[];

  // Daily stats for last 30 days
  dailyStats: {
    date: string;
    txCount: number;
    gasUsed: number;
    avaxBurned: number;
  }[];

  // Coverage stats (vs total chain)
  coverage: {
    taggedGasPercent: number;
    taggedTxPercent: number;
    totalChainTxs: number;
    totalChainGas: number;
    totalChainBurned: number;
  };

  // Time period
  timeRange: string;
  lastUpdated: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Get all known contract addresses grouped by protocol
    const protocolAddresses = new Map<string, string[]>();
    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      const existing = protocolAddresses.get(contract.protocol) || [];
      existing.push(contract.address);
      protocolAddresses.set(contract.protocol, existing);
    }

    const allAddresses = Array.from(protocolAddresses.values()).flat();
    const addressFilter = buildAddressFilter(allAddresses);

    // Time filter: days=0 means all-time (no filter)
    const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';
    // For daily stats, use 90 days if all-time, otherwise use the requested range
    const dailyDays = days > 0 ? days : 90;

    // Run queries in parallel
    const [watermarkResult, contractStatsResult, dailyStatsResult, totalChainStats, nativeTransferResult, contractDeployResult] = await Promise.all([
      // 1. Get watermark for latest block
      queryClickHouse<{
        block_number: number;
        block_time: string;
      }>(`
        SELECT block_number, block_time
        FROM sync_watermark
        WHERE chain_id = ${C_CHAIN_ID}
      `),

      // 2. Get per-contract stats for the time period
      queryClickHouse<{
        address: string;
        tx_count: string;
        total_gas: string;
        avax_burned: number;
      }>(`
        SELECT
          lower(concat('0x', hex(to))) as address,
          count() as tx_count,
          sum(gas_used) as total_gas,
          sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas)) / 1e18 as avax_burned
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND ${addressFilter}
          ${timeFilter}
        GROUP BY to
      `),

      // 3. Get daily stats (limited to reasonable range for charting)
      queryClickHouse<{
        date: string;
        tx_count: string;
        total_gas: string;
        avax_burned: number;
      }>(`
        SELECT
          toDate(block_time) as date,
          count() as tx_count,
          sum(gas_used) as total_gas,
          sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas)) / 1e18 as avax_burned
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND ${addressFilter}
          AND block_time >= now() - INTERVAL ${dailyDays} DAY
        GROUP BY date
        ORDER BY date
      `),

      // 4. Get total chain gas (for coverage %)
      getTotalChainGas(days),

      // 5. Native transfers: to IS NOT NULL AND input is empty or just '0x'
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
        avax_burned: number;
      }>(`
        SELECT
          count() as tx_count,
          sum(gas_used) as total_gas,
          sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas)) / 1e18 as avax_burned
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND to IS NOT NULL
          AND length(input) <= 1
          ${timeFilter}
      `),

      // 6. Contract deploys: to IS NULL
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
        avax_burned: number;
      }>(`
        SELECT
          count() as tx_count,
          sum(gas_used) as total_gas,
          sum(toFloat64(gas_used) * toFloat64(base_fee_per_gas)) / 1e18 as avax_burned
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND to IS NULL
          ${timeFilter}
      `),
    ]);

    // Build protocol category lookup
    const protocolCategory = new Map<string, string>();
    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      if (!protocolCategory.has(contract.protocol)) {
        protocolCategory.set(contract.protocol, contract.category);
      }
    }

    // Aggregate by protocol
    const protocolStats = new Map<string, { txCount: number; gasUsed: number; avaxBurned: number }>();

    for (const [protocol] of protocolAddresses) {
      protocolStats.set(protocol, { txCount: 0, gasUsed: 0, avaxBurned: 0 });
    }

    for (const row of contractStatsResult.data) {
      for (const [protocol, addresses] of protocolAddresses) {
        if (addresses.map(a => a.toLowerCase()).includes(row.address)) {
          const stats = protocolStats.get(protocol)!;
          stats.txCount += parseInt(row.tx_count) || 0;
          stats.gasUsed += parseInt(row.total_gas) || 0;
          stats.avaxBurned += row.avax_burned || 0;
          break;
        }
      }
    }

    // Add native transfers as a synthetic protocol entry
    const nativeData = nativeTransferResult.data[0];
    const nativeTxCount = parseInt(nativeData?.tx_count) || 0;
    const nativeGas = parseInt(nativeData?.total_gas) || 0;
    const nativeBurned = nativeData?.avax_burned || 0;
    if (nativeTxCount > 0) {
      protocolStats.set('Native Transfers', { txCount: nativeTxCount, gasUsed: nativeGas, avaxBurned: nativeBurned });
      protocolCategory.set('Native Transfers', 'native');
    }

    // Add contract deploys as a synthetic protocol entry
    const deployData = contractDeployResult.data[0];
    const deployTxCount = parseInt(deployData?.tx_count) || 0;
    const deployGas = parseInt(deployData?.total_gas) || 0;
    const deployBurned = deployData?.avax_burned || 0;
    if (deployTxCount > 0) {
      protocolStats.set('Contract Deploys', { txCount: deployTxCount, gasUsed: deployGas, avaxBurned: deployBurned });
      protocolCategory.set('Contract Deploys', 'infrastructure');
    }

    // Calculate tagged totals (address-matched only, for coverage)
    let taggedTxCount = 0;
    let taggedGas = 0;
    let taggedBurned = 0;
    for (const stats of protocolStats.values()) {
      taggedTxCount += stats.txCount;
      taggedGas += stats.gasUsed;
      taggedBurned += stats.avaxBurned;
    }

    // Use total chain gas as the denominator for gasShare
    const totalChainGas = totalChainStats.totalGas;

    // Create sorted protocol breakdown - gasShare computed against total chain gas
    const protocolBreakdown = Array.from(protocolStats.entries())
      .map(([protocol, stats]) => ({
        protocol,
        slug: PROTOCOL_SLUGS[protocol] || null,
        category: protocolCategory.get(protocol) || 'other',
        txCount: stats.txCount,
        gasUsed: stats.gasUsed,
        avaxBurned: stats.avaxBurned,
        gasShare: totalChainGas > 0 ? (stats.gasUsed / totalChainGas) * 100 : 0,
      }))
      .filter(p => p.txCount > 0)
      .sort((a, b) => b.gasUsed - a.gasUsed)
      .slice(0, 30);

    // Format daily stats
    const dailyStats = dailyStatsResult.data.map(row => ({
      date: row.date,
      txCount: parseInt(row.tx_count) || 0,
      gasUsed: parseInt(row.total_gas) || 0,
      avaxBurned: row.avax_burned || 0,
    }));

    const watermark = watermarkResult.data[0];

    const response: ChainStatsResponse = {
      totalTransactions: taggedTxCount,
      totalGasUsed: taggedGas,
      totalAvaxBurned: taggedBurned,
      latestBlock: watermark?.block_number || 0,
      latestBlockTime: watermark?.block_time || '',
      protocolBreakdown,
      dailyStats,
      coverage: {
        taggedGasPercent: totalChainGas > 0 ? (taggedGas / totalChainGas) * 100 : 0,
        taggedTxPercent: totalChainStats.totalTx > 0 ? (taggedTxCount / totalChainStats.totalTx) * 100 : 0,
        totalChainTxs: totalChainStats.totalTx,
        totalChainGas: totalChainStats.totalGas,
        totalChainBurned: totalChainStats.totalBurned,
      },
      timeRange: days > 0 ? `${days} days` : 'All Time',
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Error fetching chain stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain stats' },
      { status: 500 }
    );
  }
}
