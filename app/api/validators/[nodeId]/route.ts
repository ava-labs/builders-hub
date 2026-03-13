import { NextResponse } from 'next/server';

const UPSTREAM_BASE = 'https://52.203.183.9.sslip.io/api/validators';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 15000;

export interface ValidatorP2PDetail {
  node_id: string;
  current_p50_uptime: number;
  bench_observers: number;
  weight: number;
  delegator_weight: number;
  delegator_count: number;
  delegation_fee: number;
  potential_reward: number;
  version: string;
  public_ip: string;
  days_left: number;
  miss_rate_14d: number;
  missed_14d: number;
  proposed_14d: number;
  uptime_details: {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
  };
  uptime: { bucket: string; p50_uptime: number }[];
  bench: { bucket: string; bench_total: number }[];
  blocks: { hour: string; proposed: number; missed: number }[];
  slots: { slot: number; cnt: number }[];
}

interface CacheEntry {
  data: ValidatorP2PDetail;
  timestamp: number;
}

const cachedData = new Map<string, CacheEntry>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;

    if (!nodeId || !nodeId.startsWith('NodeID-')) {
      return NextResponse.json(
        { error: 'Invalid Node ID format. Expected format: NodeID-xxx' },
        { status: 400 }
      );
    }

    const cached = cachedData.get(nodeId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
          'X-Data-Source': 'cache',
        },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(
      `${UPSTREAM_BASE}/${encodeURIComponent(nodeId)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Upstream API returned ${response.status}`);
    }

    const data: ValidatorP2PDetail = await response.json();
    cachedData.set(nodeId, { data, timestamp: Date.now() });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        'X-Data-Source': 'fresh',
      },
    });
  } catch (error) {
    console.error('[GET /api/validators/[nodeId]] Error:', error);
    const { nodeId } = await params;
    const cached = cachedData.get(nodeId);

    if (cached) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Data-Source': 'error-fallback-cache' },
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch validator details' },
      { status: 500 }
    );
  }
}
