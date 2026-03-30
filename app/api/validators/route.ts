import { NextResponse } from 'next/server';

const UPSTREAM_URL = 'https://52.203.183.9.sslip.io/api/validators';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 15000;

interface ValidatorP2P {
  node_id: string;
  p50_uptime: number;
  weight: number;
  delegator_count: number;
  delegator_weight: number;
  delegation_fee: number;
  potential_reward: number;
  bench_observers: number;
  end_time: string;
  version: string;
  tracked_subnets: string;
  public_ip: string;
  total_stake: number;
  days_left: number;
  miss_rate_14d: number;
  miss_count_14d: number;
  block_count_14d: number;
}

let cachedData: { data: ValidatorP2P[]; timestamp: number } | null = null;

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
          'X-Data-Source': 'cache',
        },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(UPSTREAM_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Upstream API returned ${response.status}`);
    }

    const data: ValidatorP2P[] = await response.json();
    cachedData = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        'X-Data-Source': 'fresh',
      },
    });
  } catch (error) {
    console.error('[GET /api/validators] Error:', error);

    if (cachedData) {
      return NextResponse.json(cachedData.data, {
        headers: {
          'X-Data-Source': 'error-fallback-cache',
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch validators data' },
      { status: 500 }
    );
  }
}
