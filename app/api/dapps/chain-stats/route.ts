import { NextResponse } from 'next/server';
import { queryClickHouse, C_CHAIN_ID, buildAddressFilter, buildSwapPricesCTE, getTotalChainGas } from '@/lib/clickhouse';
import { CONTRACT_REGISTRY, PROTOCOL_SLUGS } from '@/lib/contracts';

// Cache for 10 minutes - heavy aggregation query
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export interface CategoryBreakdown {
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
  gasShare: number;
  delta: number; // % change vs previous period
}

export interface ChainStatsResponse {
  // Overall chain stats
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  latestBlock: number;
  latestBlockTime: string;

  // Protocol breakdown
  protocolBreakdown: {
    protocol: string;
    slug: string | null;
    category: string;
    txCount: number;
    gasUsed: number;
    avaxBurned: number;
    gasCostUsd: number;
    avaxBurnedUsd: number;
    uniqueSenders: number;
    gasShare: number;
    delta: number;
  }[];

  // Category breakdown with deltas (for treemap)
  categoryBreakdown: CategoryBreakdown[];

  // Daily stats for last 30 days
  dailyStats: {
    date: string;
    txCount: number;
    gasUsed: number;
    avaxBurned: number;
    avaxBurnedUsd: number;
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
    const tAddressFilter = buildAddressFilter(allAddresses, 't.to');

    // Time filters: current period and previous period (for delta)
    const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';
    const tTimeFilter = days > 0 ? `AND t.block_time >= now() - INTERVAL ${days} DAY` : '';
    const prevTimeFilter = days > 0
      ? `AND block_time >= now() - INTERVAL ${days * 2} DAY AND block_time < now() - INTERVAL ${days} DAY`
      : '';
    const tPrevTimeFilter = days > 0
      ? `AND t.block_time >= now() - INTERVAL ${days * 2} DAY AND t.block_time < now() - INTERVAL ${days} DAY`
      : '';
    // For daily stats, use 90 days if all-time, otherwise use the requested range
    const dailyDays = days > 0 ? days : 90;
    const dailyTimeFilter = `AND block_time >= now() - INTERVAL ${dailyDays} DAY`;
    const tDailyTimeFilter = `AND t.block_time >= now() - INTERVAL ${dailyDays} DAY`;

    // Run queries in parallel
    const [
      watermarkResult,
      contractStatsResult,
      prevContractStatsResult,
      dailyStatsResult,
      totalChainStats,
      nativeTransferResult,
      contractDeployResult,
      prevNativeTransferResult,
      prevContractDeployResult,
    ] = await Promise.all([
      // 1. Get watermark for latest block
      queryClickHouse<{
        block_number: number;
        block_time: string;
      }>(`
        SELECT block_number, block_time
        FROM sync_watermark
        WHERE chain_id = ${C_CHAIN_ID}
      `),

      // 2. Get per-contract stats for the CURRENT period
      queryClickHouse<{
        address: string;
        tx_count: string;
        total_gas: string;
        avax_burned: number;
        avax_burned_usd: number;
        gas_cost_usd: number;
        unique_senders: string;
      }>(`
        WITH ${buildSwapPricesCTE(timeFilter)}
        SELECT
          lower(concat('0x', hex(t.to))) as address,
          count() as tx_count,
          sum(t.gas_used) as total_gas,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as gas_cost_usd,
          uniqExact(t.from) as unique_senders
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          AND ${tAddressFilter}
          ${tTimeFilter}
        GROUP BY t.to
      `),

      // 3. Get per-contract stats for the PREVIOUS period (for delta)
      days > 0
        ? queryClickHouse<{
            address: string;
            tx_count: string;
            total_gas: string;
            avax_burned: number;
            avax_burned_usd: number;
            gas_cost_usd: number;
            unique_senders: string;
          }>(`
            WITH ${buildSwapPricesCTE(prevTimeFilter)}
            SELECT
              lower(concat('0x', hex(t.to))) as address,
              count() as tx_count,
              sum(t.gas_used) as total_gas,
              sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
              sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
              sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as gas_cost_usd,
              uniqExact(t.from) as unique_senders
            FROM raw_txs t
            LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
            WHERE t.chain_id = ${C_CHAIN_ID}
              AND ${tAddressFilter}
              ${tPrevTimeFilter}
            GROUP BY t.to
          `)
        : Promise.resolve({ data: [], meta: [], rows: 0, statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 } }),

      // 4. Get daily stats (limited to reasonable range for charting)
      queryClickHouse<{
        date: string;
        tx_count: string;
        total_gas: string;
        avax_burned: number;
        avax_burned_usd: number;
      }>(`
        WITH ${buildSwapPricesCTE(dailyTimeFilter)}
        SELECT
          toDate(t.block_time) as date,
          count() as tx_count,
          sum(t.gas_used) as total_gas,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          AND ${tAddressFilter}
          ${tDailyTimeFilter}
        GROUP BY date
        ORDER BY date
      `),

      // 5. Get total chain gas (for coverage %)
      getTotalChainGas(days),

      // 6. Native transfers: current period
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
        avax_burned: number;
        avax_burned_usd: number;
        gas_cost_usd: number;
        unique_senders: string;
      }>(`
        WITH ${buildSwapPricesCTE(timeFilter)}
        SELECT
          count() as tx_count,
          sum(t.gas_used) as total_gas,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as gas_cost_usd,
          uniqExact(t.from) as unique_senders
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          AND t.to IS NOT NULL
          AND length(t.input) <= 1
          ${tTimeFilter}
      `),

      // 7. Contract deploys: current period
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
        avax_burned: number;
        avax_burned_usd: number;
        gas_cost_usd: number;
        unique_senders: string;
      }>(`
        WITH ${buildSwapPricesCTE(timeFilter)}
        SELECT
          count() as tx_count,
          sum(t.gas_used) as total_gas,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
          sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as gas_cost_usd,
          uniqExact(t.from) as unique_senders
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          AND t.to IS NULL
          ${tTimeFilter}
      `),

      // 8. Native transfers: previous period (for delta)
      days > 0
        ? queryClickHouse<{
            tx_count: string;
            total_gas: string;
            avax_burned: number;
            avax_burned_usd: number;
            gas_cost_usd: number;
            unique_senders: string;
          }>(`
            WITH ${buildSwapPricesCTE(prevTimeFilter)}
            SELECT
              count() as tx_count,
              sum(t.gas_used) as total_gas,
              sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
              sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
              sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as gas_cost_usd,
              uniqExact(t.from) as unique_senders
            FROM raw_txs t
            LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
            WHERE t.chain_id = ${C_CHAIN_ID}
              AND t.to IS NOT NULL
              AND length(t.input) <= 1
              ${tPrevTimeFilter}
          `)
        : Promise.resolve({ data: [{ tx_count: '0', total_gas: '0', avax_burned: 0, avax_burned_usd: 0, gas_cost_usd: 0, unique_senders: '0' }], meta: [], rows: 1, statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 } }),

      // 9. Contract deploys: previous period (for delta)
      days > 0
        ? queryClickHouse<{
            tx_count: string;
            total_gas: string;
            avax_burned: number;
            avax_burned_usd: number;
            gas_cost_usd: number;
            unique_senders: string;
          }>(`
            WITH ${buildSwapPricesCTE(prevTimeFilter)}
            SELECT
              count() as tx_count,
              sum(t.gas_used) as total_gas,
              sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas)) / 1e18 as avax_burned,
              sum(toFloat64(t.gas_used) * toFloat64(t.base_fee_per_gas) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
              sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as gas_cost_usd,
              uniqExact(t.from) as unique_senders
            FROM raw_txs t
            LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
            WHERE t.chain_id = ${C_CHAIN_ID}
              AND t.to IS NULL
              ${tPrevTimeFilter}
          `)
        : Promise.resolve({ data: [{ tx_count: '0', total_gas: '0', avax_burned: 0, avax_burned_usd: 0, gas_cost_usd: 0, unique_senders: '0' }], meta: [], rows: 1, statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 } }),
    ]);

    // Build protocol category lookup
    const protocolCategory = new Map<string, string>();
    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      if (!protocolCategory.has(contract.protocol)) {
        protocolCategory.set(contract.protocol, contract.category);
      }
    }

    // Helper: aggregate per-address rows into protocol stats
    function aggregateByProtocol(rows: { address: string; tx_count: string; total_gas: string; avax_burned: number; avax_burned_usd: number; gas_cost_usd: number; unique_senders: string }[]) {
      const stats = new Map<string, { txCount: number; gasUsed: number; avaxBurned: number; gasCostUsd: number; avaxBurnedUsd: number; uniqueSenders: number }>();
      for (const [protocol] of protocolAddresses) {
        stats.set(protocol, { txCount: 0, gasUsed: 0, avaxBurned: 0, gasCostUsd: 0, avaxBurnedUsd: 0, uniqueSenders: 0 });
      }
      for (const row of rows) {
        for (const [protocol, addresses] of protocolAddresses) {
          if (addresses.map(a => a.toLowerCase()).includes(row.address)) {
            const s = stats.get(protocol)!;
            s.txCount += parseInt(row.tx_count) || 0;
            s.gasUsed += parseInt(row.total_gas) || 0;
            s.avaxBurned += row.avax_burned || 0;
            s.gasCostUsd += row.gas_cost_usd || 0;
            s.avaxBurnedUsd += row.avax_burned_usd || 0;
            s.uniqueSenders += parseInt(row.unique_senders) || 0;
            break;
          }
        }
      }
      return stats;
    }

    // Aggregate current and previous periods
    const currentProtocolStats = aggregateByProtocol(contractStatsResult.data);
    const prevProtocolStats = aggregateByProtocol(prevContractStatsResult.data);

    // Add native transfers
    const nativeData = nativeTransferResult.data[0];
    const nativeTxCount = parseInt(nativeData?.tx_count) || 0;
    const nativeGas = parseInt(nativeData?.total_gas) || 0;
    const nativeBurned = nativeData?.avax_burned || 0;
    if (nativeTxCount > 0) {
      currentProtocolStats.set('Native Transfers', {
        txCount: nativeTxCount,
        gasUsed: nativeGas,
        avaxBurned: nativeBurned,
        gasCostUsd: nativeData?.gas_cost_usd || 0,
        avaxBurnedUsd: nativeData?.avax_burned_usd || 0,
        uniqueSenders: parseInt(nativeData?.unique_senders) || 0,
      });
      protocolCategory.set('Native Transfers', 'native');
    }

    const prevNativeData = prevNativeTransferResult.data[0];
    prevProtocolStats.set('Native Transfers', {
      txCount: parseInt(prevNativeData?.tx_count) || 0,
      gasUsed: parseInt(prevNativeData?.total_gas) || 0,
      avaxBurned: prevNativeData?.avax_burned || 0,
      gasCostUsd: prevNativeData?.gas_cost_usd || 0,
      avaxBurnedUsd: prevNativeData?.avax_burned_usd || 0,
      uniqueSenders: parseInt(prevNativeData?.unique_senders) || 0,
    });

    // Add contract deploys
    const deployData = contractDeployResult.data[0];
    const deployTxCount = parseInt(deployData?.tx_count) || 0;
    const deployGas = parseInt(deployData?.total_gas) || 0;
    const deployBurned = deployData?.avax_burned || 0;
    if (deployTxCount > 0) {
      currentProtocolStats.set('Contract Deploys', {
        txCount: deployTxCount,
        gasUsed: deployGas,
        avaxBurned: deployBurned,
        gasCostUsd: deployData?.gas_cost_usd || 0,
        avaxBurnedUsd: deployData?.avax_burned_usd || 0,
        uniqueSenders: parseInt(deployData?.unique_senders) || 0,
      });
      protocolCategory.set('Contract Deploys', 'infrastructure');
    }

    const prevDeployData = prevContractDeployResult.data[0];
    prevProtocolStats.set('Contract Deploys', {
      txCount: parseInt(prevDeployData?.tx_count) || 0,
      gasUsed: parseInt(prevDeployData?.total_gas) || 0,
      avaxBurned: prevDeployData?.avax_burned || 0,
      gasCostUsd: prevDeployData?.gas_cost_usd || 0,
      avaxBurnedUsd: prevDeployData?.avax_burned_usd || 0,
      uniqueSenders: parseInt(prevDeployData?.unique_senders) || 0,
    });

    // Calculate tagged totals
    let taggedTxCount = 0;
    let taggedGas = 0;
    let taggedBurned = 0;
    for (const stats of currentProtocolStats.values()) {
      taggedTxCount += stats.txCount;
      taggedGas += stats.gasUsed;
      taggedBurned += stats.avaxBurned;
    }

    const totalChainGas = totalChainStats.totalGas;

    // Create sorted protocol breakdown (with deltas for treemap nesting)
    const protocolBreakdown = Array.from(currentProtocolStats.entries())
      .map(([protocol, stats]) => {
        const prevStats = prevProtocolStats.get(protocol);
        const prevGas = prevStats?.gasUsed || 0;
        const currGas = stats.gasUsed;
        const delta = prevGas > 0 ? ((currGas - prevGas) / prevGas) * 100 : (currGas > 0 ? 100 : 0);

        return {
          protocol,
          slug: PROTOCOL_SLUGS[protocol] || null,
          category: protocolCategory.get(protocol) || 'other',
          txCount: stats.txCount,
          gasUsed: stats.gasUsed,
          avaxBurned: stats.avaxBurned,
          gasCostUsd: stats.gasCostUsd,
          avaxBurnedUsd: stats.avaxBurnedUsd,
          uniqueSenders: stats.uniqueSenders,
          gasShare: totalChainGas > 0 ? (stats.gasUsed / totalChainGas) * 100 : 0,
          delta,
        };
      })
      .filter(p => p.txCount > 0)
      .sort((a, b) => b.gasUsed - a.gasUsed);

    // Build category breakdown with deltas
    const categoryMap = new Map<string, {
      current: { txCount: number; gasUsed: number; avaxBurned: number; gasCostUsd: number; avaxBurnedUsd: number; uniqueSenders: number };
      prev: { gasUsed: number };
    }>();

    for (const [protocol, stats] of currentProtocolStats) {
      const cat = protocolCategory.get(protocol) || 'other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          current: { txCount: 0, gasUsed: 0, avaxBurned: 0, gasCostUsd: 0, avaxBurnedUsd: 0, uniqueSenders: 0 },
          prev: { gasUsed: 0 },
        });
      }
      const entry = categoryMap.get(cat)!;
      entry.current.txCount += stats.txCount;
      entry.current.gasUsed += stats.gasUsed;
      entry.current.avaxBurned += stats.avaxBurned;
      entry.current.gasCostUsd += stats.gasCostUsd;
      entry.current.avaxBurnedUsd += stats.avaxBurnedUsd;
      entry.current.uniqueSenders += stats.uniqueSenders;
    }

    for (const [protocol, stats] of prevProtocolStats) {
      const cat = protocolCategory.get(protocol) || 'other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          current: { txCount: 0, gasUsed: 0, avaxBurned: 0, gasCostUsd: 0, avaxBurnedUsd: 0, uniqueSenders: 0 },
          prev: { gasUsed: 0 },
        });
      }
      categoryMap.get(cat)!.prev.gasUsed += stats.gasUsed;
    }

    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const prevGas = data.prev.gasUsed;
        const currGas = data.current.gasUsed;
        const delta = prevGas > 0 ? ((currGas - prevGas) / prevGas) * 100 : (currGas > 0 ? 100 : 0);

        return {
          category,
          txCount: data.current.txCount,
          gasUsed: data.current.gasUsed,
          avaxBurned: data.current.avaxBurned,
          gasCostUsd: data.current.gasCostUsd,
          avaxBurnedUsd: data.current.avaxBurnedUsd,
          uniqueSenders: data.current.uniqueSenders,
          gasShare: totalChainGas > 0 ? (data.current.gasUsed / totalChainGas) * 100 : 0,
          delta,
        };
      })
      .filter(c => c.gasUsed > 0)
      .sort((a, b) => b.gasUsed - a.gasUsed);

    // Format daily stats
    const dailyStats = dailyStatsResult.data.map(row => ({
      date: row.date,
      txCount: parseInt(row.tx_count) || 0,
      gasUsed: parseInt(row.total_gas) || 0,
      avaxBurned: row.avax_burned || 0,
      avaxBurnedUsd: row.avax_burned_usd || 0,
    }));

    const watermark = watermarkResult.data[0];

    const response: ChainStatsResponse = {
      totalTransactions: taggedTxCount,
      totalGasUsed: taggedGas,
      totalAvaxBurned: taggedBurned,
      latestBlock: watermark?.block_number || 0,
      latestBlockTime: watermark?.block_time || '',
      protocolBreakdown,
      categoryBreakdown,
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
