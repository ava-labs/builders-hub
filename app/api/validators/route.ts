import { withApi, InternalError, successResponse } from '@/lib/api';

const UPSTREAM_URL = 'https://52.203.183.9.sslip.io/api/validators';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 10_000;

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

export const GET = withApi(async () => {
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    const resp = successResponse(cachedData.data);
    resp.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    resp.headers.set('X-Data-Source', 'cache');
    return resp;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(UPSTREAM_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new InternalError(`Upstream API returned ${response.status}`);
    }

    const data: ValidatorP2P[] = await response.json();
    cachedData = { data, timestamp: Date.now() };

    const resp = successResponse(data);
    resp.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    resp.headers.set('X-Data-Source', 'fresh');
    return resp;
  } catch (error) {
    clearTimeout(timeout);

    if (cachedData) {
      const resp = successResponse(cachedData.data);
      resp.headers.set('X-Data-Source', 'error-fallback-cache');
      return resp;
    }

    throw error;
  }
});
