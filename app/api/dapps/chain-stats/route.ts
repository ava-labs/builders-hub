import { NextResponse } from 'next/server';
import { queryClickHouse, C_CHAIN_ID, buildAddressFilter } from '@/lib/clickhouse';
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

    // 1. Get watermark for latest block
    const watermarkResult = await queryClickHouse<{
      block_number: number;
      block_time: string;
    }>(`
      SELECT block_number, block_time
      FROM sync_watermark
      WHERE chain_id = ${C_CHAIN_ID}
    `);

    // 2. Get per-contract stats for the time period
    const contractStatsResult = await queryClickHouse<{
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
    `);

    // 3. Get daily stats (limited to reasonable range for charting)
    const dailyStatsResult = await queryClickHouse<{
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
    `);

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

    // Calculate totals
    let totalTransactions = 0;
    let totalGasUsed = 0;
    let totalAvaxBurned = 0;

    for (const stats of protocolStats.values()) {
      totalTransactions += stats.txCount;
      totalGasUsed += stats.gasUsed;
      totalAvaxBurned += stats.avaxBurned;
    }

    // Create sorted protocol breakdown
    const protocolBreakdown = Array.from(protocolStats.entries())
      .map(([protocol, stats]) => ({
        protocol,
        slug: PROTOCOL_SLUGS[protocol] || null,
        txCount: stats.txCount,
        gasUsed: stats.gasUsed,
        avaxBurned: stats.avaxBurned,
        gasShare: totalGasUsed > 0 ? (stats.gasUsed / totalGasUsed) * 100 : 0,
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
      totalTransactions,
      totalGasUsed,
      totalAvaxBurned,
      latestBlock: watermark?.block_number || 0,
      latestBlockTime: watermark?.block_time || '',
      protocolBreakdown,
      dailyStats,
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
