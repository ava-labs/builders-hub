import { NextResponse } from 'next/server';
import {
  queryClickHouse,
  buildContractGasReceivedQuery,
  buildContractGasGivenQuery,
  buildContractTxSummaryQuery,
} from '@/lib/clickhouse';
import { CONTRACT_REGISTRY } from '@/lib/contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

interface TraceRow {
  address: string;
  gas: string;
  tx_count: string;
}

interface SummaryRow {
  total_txs: string;
  unique_callers: string;
}

interface AddressInfo {
  address: string;
  name: string | null;
  protocol: string | null;
  category: string | null;
}

interface FlowEntry extends AddressInfo {
  gas: number;
  txCount: number;
  gasPercent: number;
}

function enrichAddress(address: string): AddressInfo {
  const info = CONTRACT_REGISTRY[address.toLowerCase()];
  return {
    address: address.toLowerCase(),
    name: info?.name ?? null,
    protocol: info?.protocol ?? null,
    category: info?.category ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const days = parseInt(searchParams.get('days') || '30');

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid or missing address parameter' },
        { status: 400 }
      );
    }

    // Run all three queries in parallel
    const [callersResult, calleesResult, summaryResult] = await Promise.all([
      queryClickHouse<TraceRow>(buildContractGasReceivedQuery(address, days)),
      queryClickHouse<TraceRow>(buildContractGasGivenQuery(address, days)),
      queryClickHouse<SummaryRow>(buildContractTxSummaryQuery(address, days)),
    ]);

    // Aggregate totals
    const totalGasReceived = callersResult.data.reduce(
      (sum, r) => sum + (parseInt(r.gas) || 0), 0
    );
    const totalGasGiven = calleesResult.data.reduce(
      (sum, r) => sum + (parseInt(r.gas) || 0), 0
    );
    const selfGas = Math.max(totalGasReceived - totalGasGiven, 0);
    const selfGasRatio = totalGasReceived > 0 ? selfGas / totalGasReceived : 0;

    // Classification
    let classification: 'entry_point' | 'gas_burner' | 'mixed';
    if (selfGasRatio >= 0.7) {
      classification = 'gas_burner';
    } else if (selfGasRatio <= 0.2) {
      classification = 'entry_point';
    } else {
      classification = 'mixed';
    }

    // Build top 10 callers, aggregate rest as "Others"
    function buildTopEntries(rows: TraceRow[], totalGas: number): FlowEntry[] {
      const sorted = rows
        .map(r => ({
          ...enrichAddress(r.address),
          gas: parseInt(r.gas) || 0,
          txCount: parseInt(r.tx_count) || 0,
          gasPercent: totalGas > 0 ? ((parseInt(r.gas) || 0) / totalGas) * 100 : 0,
        }))
        .sort((a, b) => b.gas - a.gas);

      if (sorted.length <= 10) return sorted;

      const top = sorted.slice(0, 10);
      const rest = sorted.slice(10);
      const othersGas = rest.reduce((s, r) => s + r.gas, 0);
      const othersTx = rest.reduce((s, r) => s + r.txCount, 0);

      top.push({
        address: 'others',
        name: `Others (${rest.length})`,
        protocol: null,
        category: null,
        gas: othersGas,
        txCount: othersTx,
        gasPercent: totalGas > 0 ? (othersGas / totalGas) * 100 : 0,
      });

      return top;
    }

    const callers = buildTopEntries(callersResult.data, totalGasReceived);
    const callees = buildTopEntries(calleesResult.data, totalGasGiven);

    const summaryData = summaryResult.data[0];

    const response = {
      target: enrichAddress(address),
      classification,
      selfGasRatio,
      summary: {
        totalGasReceived,
        totalGasGiven,
        selfGas,
        totalTransactions: parseInt(summaryData?.total_txs) || 0,
        uniqueCallers: parseInt(summaryData?.unique_callers) || 0,
      },
      callers,
      callees,
      timeRange: days > 0 ? `${days}d` : 'all',
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching contract gas flow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contract gas flow' },
      { status: 500 }
    );
  }
}
