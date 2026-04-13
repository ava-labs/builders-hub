import { z } from 'zod';
import { withApi, ValidationError, successResponse } from '@/lib/api';
import { NODE_ID_REGEX } from '@/lib/api/constants';

const UPSTREAM_BASE = 'https://52.203.183.9.sslip.io/api/validators';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 10_000;

const nodeIdSchema = z.object({
  nodeId: z.string().max(60).regex(NODE_ID_REGEX, 'Invalid Node ID format. Expected format: NodeID-xxx'),
});

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

export const GET = withApi(async (_req, { params }) => {
  const parsed = nodeIdSchema.safeParse(params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const { nodeId } = parsed.data;

  const cached = cachedData.get(nodeId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    const resp = successResponse(cached.data);
    resp.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    resp.headers.set('X-Data-Source', 'cache');
    return resp;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(`${UPSTREAM_BASE}/${encodeURIComponent(nodeId)}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Upstream API returned ${response.status}`);
    }

    const data: ValidatorP2PDetail = await response.json();
    cachedData.set(nodeId, { data, timestamp: Date.now() });

    const resp = successResponse(data);
    resp.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    resp.headers.set('X-Data-Source', 'fresh');
    return resp;
  } catch (error) {
    clearTimeout(timeout);

    const fallback = cachedData.get(nodeId);
    if (fallback) {
      const resp = successResponse(fallback.data);
      resp.headers.set('X-Data-Source', 'error-fallback-cache');
      return resp;
    }

    throw error;
  }
});
