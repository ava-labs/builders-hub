import { NextResponse } from 'next/server';
import { queryClickHouse, C_CHAIN_ID, buildAddressFilter, getTotalChainGas, getTopUnknownContracts } from '@/lib/clickhouse';
import { CONTRACT_REGISTRY } from '@/lib/contracts';
import { SELECTOR_CATEGORIES } from '@/lib/selectors';

// Cache for 10 minutes
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const unknownLimit = parseInt(searchParams.get('unknownLimit') || '20');

    const timeFilter = days > 0 ? `AND block_time >= now() - INTERVAL ${days} DAY` : '';

    // Collect all known addresses
    const allAddresses = Object.keys(CONTRACT_REGISTRY);
    const addressFilter = buildAddressFilter(allAddresses);

    // Build selector list for SQL IN clause
    const selectorHexList = Object.keys(SELECTOR_CATEGORIES)
      .map(s => `unhex('${s}')`)
      .join(', ');

    // Run all classification queries in parallel
    const [
      totalChainStats,
      addressMatchResult,
      selectorOnlyResult,
      nativeTransferResult,
      contractDeployResult,
      topUnknown,
    ] = await Promise.all([
      // Total chain stats
      getTotalChainGas(days),

      // 1. Address-matched transactions (known contracts)
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
      }>(`
        SELECT
          count() as tx_count,
          sum(gas_used) as total_gas
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND ${addressFilter}
          ${timeFilter}
      `),

      // 2. Selector-matched but NOT address-matched
      // Transactions to unknown addresses but with known function selectors
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
      }>(`
        SELECT
          count() as tx_count,
          sum(gas_used) as total_gas
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND to IS NOT NULL
          AND NOT (${addressFilter})
          AND length(input) >= 4
          AND substring(input, 1, 4) IN (${selectorHexList})
          ${timeFilter}
      `),

      // 3. Native transfers (no input data, has recipient)
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
      }>(`
        SELECT
          count() as tx_count,
          sum(gas_used) as total_gas
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND to IS NOT NULL
          AND length(input) <= 1
          ${timeFilter}
      `),

      // 4. Contract deploys (no recipient)
      queryClickHouse<{
        tx_count: string;
        total_gas: string;
      }>(`
        SELECT
          count() as tx_count,
          sum(gas_used) as total_gas
        FROM raw_txs
        WHERE chain_id = ${C_CHAIN_ID}
          AND to IS NULL
          ${timeFilter}
      `),

      // 5. Top unknown contracts
      getTopUnknownContracts(allAddresses, days, unknownLimit),
    ]);

    const totalTx = totalChainStats.totalTx;
    const totalGas = totalChainStats.totalGas;

    const addressMatched = {
      txs: parseInt(addressMatchResult.data[0]?.tx_count) || 0,
      gas: parseInt(addressMatchResult.data[0]?.total_gas) || 0,
    };

    const selectorMatched = {
      txs: parseInt(selectorOnlyResult.data[0]?.tx_count) || 0,
      gas: parseInt(selectorOnlyResult.data[0]?.total_gas) || 0,
    };

    const nativeTransfers = {
      txs: parseInt(nativeTransferResult.data[0]?.tx_count) || 0,
      gas: parseInt(nativeTransferResult.data[0]?.total_gas) || 0,
    };

    const contractDeploys = {
      txs: parseInt(contractDeployResult.data[0]?.tx_count) || 0,
      gas: parseInt(contractDeployResult.data[0]?.total_gas) || 0,
    };

    // Classified = address + selector + native + deploys
    const classifiedTx = addressMatched.txs + selectorMatched.txs + nativeTransfers.txs + contractDeploys.txs;
    const classifiedGas = addressMatched.gas + selectorMatched.gas + nativeTransfers.gas + contractDeploys.gas;

    const unclassified = {
      txs: Math.max(0, totalTx - classifiedTx),
      gas: Math.max(0, totalGas - classifiedGas),
    };

    // Build top unknown with gas percentage
    const topUnknownWithPercent = topUnknown.map(u => ({
      address: u.address,
      txCount: u.txCount,
      gasUsed: u.totalGas,
      gasPercent: totalGas > 0 ? (u.totalGas / totalGas) * 100 : 0,
    }));

    const response = {
      period: days > 0 ? `${days} days` : 'All Time',
      totalChainTxs: totalTx,
      totalChainGas: totalGas,
      addressMatched,
      selectorMatched,
      nativeTransfers,
      contractDeploys,
      unclassified,
      accuracy: {
        txPercent: totalTx > 0 ? (classifiedTx / totalTx) * 100 : 0,
        gasPercent: totalGas > 0 ? (classifiedGas / totalGas) * 100 : 0,
      },
      topUnknown: topUnknownWithPercent,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Error fetching accuracy stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accuracy stats' },
      { status: 500 }
    );
  }
}
