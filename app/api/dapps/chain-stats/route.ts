import { NextResponse } from 'next/server';
import { queryClickHouse, C_CHAIN_ID, buildSwapPricesCTE, getTotalChainGas } from '@/lib/clickhouse';
import { CONTRACT_REGISTRY, PROTOCOL_SLUGS } from '@/lib/contracts';

// Cache for 10 minutes - heavy aggregation query
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel function timeout (seconds)

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
    subcategory: string | null;
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

  // Daily per-category gas breakdown (for timeline chart)
  dailyCategoryStats: {
    date: string;
    avgGasPriceGwei: number;
    [category: string]: number | string;
  }[];

  // Top burner contract address (for X-Ray preload)
  topBurnerAddress: string | null;

  // Top unclassified ("breadcrumbs") contracts for discovery
  topBreadcrumbs: {
    address: string;
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

// Row shape for per-address stats (current period)
interface AddressStatsRow {
  address: string;
  tx_count: string;
  total_gas: string;
  avax_burned: number;
  avax_burned_usd: number;
}

// Row shape for per-address stats (previous period — no USD, no uniqExact)
interface PrevAddressStatsRow {
  address: string;
  total_gas: string;
  avax_burned: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysRaw = parseInt(searchParams.get('days') || '30');
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 183) : 30;

    // Absolute date params for custom ranges (validated: digits + hyphens only)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const startDateRaw = searchParams.get('startDate');
    const endDateRaw = searchParams.get('endDate');
    const startDate = (startDateRaw && dateRegex.test(startDateRaw)) ? startDateRaw : null;
    const endDate = (endDateRaw && dateRegex.test(endDateRaw)) ? endDateRaw : null;
    const useAbsoluteRange = !!(startDate && endDate);

    // Get all known contract addresses grouped by protocol
    const protocolAddresses = new Map<string, string[]>();
    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      const existing = protocolAddresses.get(contract.protocol) || [];
      existing.push(contract.address);
      protocolAddresses.set(contract.protocol, existing);
    }

    // Build address→protocol lookup for JS-side filtering
    const addressToProtocol = new Map<string, string>();
    for (const [protocol, addresses] of protocolAddresses) {
      for (const a of addresses) {
        addressToProtocol.set(a.toLowerCase(), protocol);
      }
    }

    // Build protocol→category and protocol→subcategory lookups
    const protocolCategory = new Map<string, string>();
    const protocolSubcategory = new Map<string, string | null>();
    for (const contract of Object.values(CONTRACT_REGISTRY)) {
      if (!protocolCategory.has(contract.protocol)) {
        protocolCategory.set(contract.protocol, contract.category);
        protocolSubcategory.set(contract.protocol, contract.subcategory || null);
      }
    }

    // Time filters for each query
    let currTimeFilter: string;
    let prevTimeFilter: string;
    let dailyTimeFilter: string;
    let swapPricesCurrFilter: string;
    let swapPricesDailyFilter: string;

    if (useAbsoluteRange) {
      const spanMs = new Date(endDate!).getTime() - new Date(startDate!).getTime();
      const spanDays = Math.max(1, Math.ceil(spanMs / (1000 * 60 * 60 * 24)) + 1);
      currTimeFilter = `AND t.block_time >= '${startDate}' AND t.block_time < '${endDate}' + INTERVAL 1 DAY`;
      prevTimeFilter = `AND t.block_time >= '${startDate}' - INTERVAL ${spanDays} DAY AND t.block_time < '${startDate}'`;
      dailyTimeFilter = currTimeFilter;
      swapPricesCurrFilter = `AND block_time >= '${startDate}' AND block_time < '${endDate}' + INTERVAL 1 DAY`;
      swapPricesDailyFilter = swapPricesCurrFilter;
    } else {
      currTimeFilter = days > 0 ? `AND t.block_time >= now() - INTERVAL ${days} DAY` : '';
      prevTimeFilter = days > 0
        ? `AND t.block_time >= now() - INTERVAL ${days * 2} DAY AND t.block_time < now() - INTERVAL ${days} DAY`
        : '';
      const dailyDays = days > 0 ? days : 90;
      dailyTimeFilter = `AND t.block_time >= now() - INTERVAL ${dailyDays} DAY`;
      swapPricesCurrFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';
      swapPricesDailyFilter = `AND block_time >= now() - INTERVAL ${dailyDays} DAY`;
    }

    const hasPrevPeriod = days > 0 || useAbsoluteRange;

    // ──────────────────────────────────────────────────────────────
    // Run queries in parallel — NO `to IN (addresses)` filter.
    // Instead: scan ALL txs grouped by `to`, filter by registry in JS.
    // This avoids a pathological scan on the non-indexed Nullable `to`
    // column (36s with IN vs 6s without on ClickHouse 26.2).
    // ──────────────────────────────────────────────────────────────
    const [
      watermarkResult,
      currStatsResult,
      prevStatsResult,
      dailyStatsResult,
      totalChainStats,
      nativeDeployResult,
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

      // 2. Current period: per-address stats with swap_prices for USD
      // ~6s on 30d (vs 36s with IN filter)
      queryClickHouse<AddressStatsRow>(`
        WITH ${buildSwapPricesCTE(swapPricesCurrFilter)}
        SELECT
          lower(concat('0x', hex(t.to))) as address,
          count() as tx_count,
          sum(t.gas_used) as total_gas,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price)) / 1e18 as avax_burned,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          AND t.to IS NOT NULL
          ${currTimeFilter}
        GROUP BY t.to
        HAVING avax_burned > 0
      `),

      // 3. Previous period: per-address stats — AVAX only, no USD, no uniqExact
      // Kept lean to stay fast (~9s). Only used for delta calculation.
      hasPrevPeriod
        ? queryClickHouse<PrevAddressStatsRow>(`
            SELECT
              lower(concat('0x', hex(t.to))) as address,
              sum(t.gas_used) as total_gas,
              sum(toFloat64(t.gas_used) * toFloat64(t.gas_price)) / 1e18 as avax_burned
            FROM raw_txs t
            WHERE t.chain_id = ${C_CHAIN_ID}
              AND t.to IS NOT NULL
              ${prevTimeFilter}
            GROUP BY t.to
            HAVING avax_burned > 0
          `)
        : Promise.resolve({ data: [], meta: [], rows: 0, statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 } }),

      // 4. Daily stats per contract (for aggregate daily stats and category timeline)
      queryClickHouse<{
        date: string;
        address: string;
        tx_count: string;
        total_gas: string;
        avax_burned: number;
        avax_burned_usd: number;
        weighted_gas_price_sum: number;
      }>(`
        WITH ${buildSwapPricesCTE(swapPricesDailyFilter)}
        SELECT
          toDate(t.block_time) as date,
          lower(concat('0x', hex(t.to))) as address,
          count() as tx_count,
          sum(t.gas_used) as total_gas,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price)) / 1e18 as avax_burned,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0)) as avax_burned_usd,
          sum(toFloat64(t.gas_used) * toFloat64(t.gas_price)) as weighted_gas_price_sum
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          AND t.to IS NOT NULL
          ${dailyTimeFilter}
        GROUP BY date, t.to
        HAVING avax_burned > 0.0001
        ORDER BY date
      `),

      // 5. Get total chain gas (for coverage %)
      getTotalChainGas(days, startDate, endDate),

      // 6. Native transfers + contract deploys — combined, current period only
      // Previous period delta for native/deploy is low-value, skip to save a query
      queryClickHouse<{
        native_tx: string;
        native_gas: string;
        native_burned: number;
        native_burned_usd: number;
        native_senders: string;
        deploy_tx: string;
        deploy_gas: string;
        deploy_burned: number;
        deploy_burned_usd: number;
        deploy_senders: string;
      }>(`
        WITH ${buildSwapPricesCTE(swapPricesCurrFilter)}
        SELECT
          countIf(t.to IS NOT NULL AND length(t.input) <= 1) as native_tx,
          sumIf(t.gas_used, t.to IS NOT NULL AND length(t.input) <= 1) as native_gas,
          sumIf(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18, t.to IS NOT NULL AND length(t.input) <= 1) as native_burned,
          sumIf(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0), t.to IS NOT NULL AND length(t.input) <= 1) as native_burned_usd,
          uniqExactIf(t.from, t.to IS NOT NULL AND length(t.input) <= 1) as native_senders,
          countIf(t.to IS NULL) as deploy_tx,
          sumIf(t.gas_used, t.to IS NULL) as deploy_gas,
          sumIf(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18, t.to IS NULL) as deploy_burned,
          sumIf(toFloat64(t.gas_used) * toFloat64(t.gas_price) / 1e18 * coalesce(p.price_usd, 0), t.to IS NULL) as deploy_burned_usd,
          uniqExactIf(t.from, t.to IS NULL) as deploy_senders
        FROM raw_txs t
        LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
        WHERE t.chain_id = ${C_CHAIN_ID}
          ${currTimeFilter}
      `),
    ]);

    // --- JS-side aggregation: filter query results through the contract registry ---

    type ProtocolStats = { txCount: number; gasUsed: number; avaxBurned: number; gasCostUsd: number; avaxBurnedUsd: number; uniqueSenders: number };
    const currentProtocolStats = new Map<string, ProtocolStats>();
    const prevProtocolStats = new Map<string, ProtocolStats>();

    // Initialize all protocols with zeros
    for (const [protocol] of protocolAddresses) {
      currentProtocolStats.set(protocol, { txCount: 0, gasUsed: 0, avaxBurned: 0, gasCostUsd: 0, avaxBurnedUsd: 0, uniqueSenders: 0 });
      prevProtocolStats.set(protocol, { txCount: 0, gasUsed: 0, avaxBurned: 0, gasCostUsd: 0, avaxBurnedUsd: 0, uniqueSenders: 0 });
    }

    // Current period: filter by registry, aggregate into protocols
    for (const row of currStatsResult.data) {
      const protocol = addressToProtocol.get(row.address);
      if (!protocol) continue;

      const s = currentProtocolStats.get(protocol)!;
      s.txCount += parseInt(row.tx_count) || 0;
      s.gasUsed += parseInt(row.total_gas) || 0;
      s.avaxBurned += row.avax_burned || 0;
      s.gasCostUsd += row.avax_burned_usd || 0;
      s.avaxBurnedUsd += row.avax_burned_usd || 0;
    }

    // Previous period: filter by registry, only gas/avaxBurned (for delta)
    for (const row of prevStatsResult.data) {
      const protocol = addressToProtocol.get(row.address);
      if (!protocol) continue;

      const s = prevProtocolStats.get(protocol)!;
      s.gasUsed += parseInt(row.total_gas) || 0;
      s.avaxBurned += row.avax_burned || 0;
    }

    // Add native transfers + deploys
    const nd = nativeDeployResult.data[0];
    if (nd) {
      const nativeTx = parseInt(nd.native_tx) || 0;
      if (nativeTx > 0) {
        currentProtocolStats.set('Native Transfers', {
          txCount: nativeTx,
          gasUsed: parseInt(nd.native_gas) || 0,
          avaxBurned: nd.native_burned || 0,
          gasCostUsd: nd.native_burned_usd || 0,
          avaxBurnedUsd: nd.native_burned_usd || 0,
          uniqueSenders: parseInt(nd.native_senders) || 0,
        });
        protocolCategory.set('Native Transfers', 'native');
      }

      const deployTx = parseInt(nd.deploy_tx) || 0;
      if (deployTx > 0) {
        currentProtocolStats.set('Contract Deploys', {
          txCount: deployTx,
          gasUsed: parseInt(nd.deploy_gas) || 0,
          avaxBurned: nd.deploy_burned || 0,
          gasCostUsd: nd.deploy_burned_usd || 0,
          avaxBurnedUsd: nd.deploy_burned_usd || 0,
          uniqueSenders: parseInt(nd.deploy_senders) || 0,
        });
        protocolCategory.set('Contract Deploys', 'infrastructure');
      }
    }

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
          subcategory: protocolSubcategory.get(protocol) || null,
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

    // Aggregate daily stats from per-contract rows (filter by registry in JS)
    const dailyAgg = new Map<string, { txCount: number; gasUsed: number; avaxBurned: number; avaxBurnedUsd: number }>();
    const dailyCatAgg = new Map<string, { categories: Map<string, number>; totalGas: number; weightedGasPriceSum: number }>();

    for (const row of dailyStatsResult.data) {
      const date = row.date;
      const protocol = addressToProtocol.get(row.address);
      const category = protocol ? (protocolCategory.get(protocol) || 'other') : 'other';

      // Aggregate daily totals (only for registered contracts)
      if (protocol) {
        if (!dailyAgg.has(date)) {
          dailyAgg.set(date, { txCount: 0, gasUsed: 0, avaxBurned: 0, avaxBurnedUsd: 0 });
        }
        const agg = dailyAgg.get(date)!;
        agg.txCount += parseInt(row.tx_count) || 0;
        agg.gasUsed += parseInt(row.total_gas) || 0;
        agg.avaxBurned += row.avax_burned || 0;
        agg.avaxBurnedUsd += row.avax_burned_usd || 0;
      }

      // Category timeline includes all contracts (registered get their category, others go to 'other')
      if (!dailyCatAgg.has(date)) {
        dailyCatAgg.set(date, { categories: new Map(), totalGas: 0, weightedGasPriceSum: 0 });
      }
      const catAgg = dailyCatAgg.get(date)!;
      catAgg.categories.set(category, (catAgg.categories.get(category) || 0) + (row.avax_burned || 0));
      catAgg.totalGas += parseInt(row.total_gas) || 0;
      catAgg.weightedGasPriceSum += row.weighted_gas_price_sum || 0;
    }

    const dailyStats = Array.from(dailyAgg.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, agg]) => ({
        date,
        txCount: agg.txCount,
        gasUsed: agg.gasUsed,
        avaxBurned: agg.avaxBurned,
        avaxBurnedUsd: agg.avaxBurnedUsd,
      }));

    const dailyCategoryStats = Array.from(dailyCatAgg.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, agg]) => {
        const point: { date: string; avgGasPriceGwei: number; [category: string]: number | string } = {
          date,
          avgGasPriceGwei: agg.totalGas > 0 ? agg.weightedGasPriceSum / agg.totalGas / 1e9 : 0,
        };
        for (const [cat, burned] of agg.categories) {
          point[cat] = burned;
        }
        return point;
      });

    // Find top burner address (highest avax_burned among classified contracts)
    let topBurnerAddress: string | null = null;
    let topBurnerBurned = 0;
    for (const row of currStatsResult.data) {
      if (addressToProtocol.has(row.address) && row.avax_burned > topBurnerBurned) {
        topBurnerBurned = row.avax_burned;
        topBurnerAddress = row.address;
      }
    }

    const watermark = watermarkResult.data[0];

    // Breadcrumbs: top unclassified contracts — derived from currStatsResult (no extra query)
    const topBreadcrumbs = currStatsResult.data
      .filter(row => !addressToProtocol.has(row.address))
      .sort((a, b) => b.avax_burned - a.avax_burned)
      .slice(0, 10)
      .map(row => ({
        address: row.address,
        txCount: parseInt(row.tx_count) || 0,
        gasUsed: parseInt(row.total_gas) || 0,
        avaxBurned: row.avax_burned || 0,
      }));

    const response: ChainStatsResponse = {
      totalTransactions: taggedTxCount,
      totalGasUsed: taggedGas,
      totalAvaxBurned: taggedBurned,
      latestBlock: watermark?.block_number || 0,
      latestBlockTime: watermark?.block_time || '',
      protocolBreakdown,
      categoryBreakdown,
      dailyStats,
      dailyCategoryStats,
      topBurnerAddress,
      topBreadcrumbs,
      coverage: {
        taggedGasPercent: totalChainGas > 0 ? (taggedGas / totalChainGas) * 100 : 0,
        taggedTxPercent: totalChainStats.totalTx > 0 ? (taggedTxCount / totalChainStats.totalTx) * 100 : 0,
        totalChainTxs: totalChainStats.totalTx,
        totalChainGas: totalChainStats.totalGas,
        totalChainBurned: totalChainStats.totalBurned,
      },
      timeRange: useAbsoluteRange ? `${startDate} to ${endDate}` : (days > 0 ? `${days} days` : 'All Time'),
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
