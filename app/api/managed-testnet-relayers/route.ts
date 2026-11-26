import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/json-body';
import { getUserId, jsonOk, jsonError, relayerUrlError } from './utils';
import { RelayerServiceURLs } from './constants';
import { Relayer } from './types';
import { reserveDailyProvision, retryAfterSeconds } from '@/server/services/provision-quota';

/* A relayer config names two chain IDs and the two URLs that the relayer service connects to. The service gets
   these four fields and no other key. An ID is base58 text of an ID's length, and a URL is a public http(s) or
   ws(s) address: the service runs inside the cluster, so it must not be sent to a private or local host. */
const MAX_CONFIGS = 10;
const chainId = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{30,60}$/);
const createRelayerSchema = z.object({
  configs: z
    .array(
      z.strictObject({
        subnetId: chainId,
        blockchainId: chainId,
        rpcUrl: z.string().max(500),
        wsUrl: z.string().max(500),
      }),
    )
    .min(1)
    .max(MAX_CONFIGS),
});

/**
 * GET /api/managed-testnet-relayers
 * Lists all active relayers from the Builder Hub API.
 */
async function handleGetRelayers(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
  if (!password) {
    return jsonError(503, 'Relayer service is not configured');
  }

  try {
    const response = await fetch(RelayerServiceURLs.list(), {
      method: 'GET',
      headers: {
        'x-admin-password': password,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[Relayers] Fetch failed (status: ${response.status})`);
      return jsonError(502, 'Failed to fetch relayers from Builder Hub');
    }

    const data = await response.json();
    
    // Handle both array response and object with relayers property
    let allRelayers: any[] = [];
    if (Array.isArray(data)) {
      allRelayers = data;
    } else if (data && Array.isArray(data.relayers)) {
      allRelayers = data.relayers;
    } else if (data && typeof data === 'object') {
      // If it's an object with keys as relayer IDs, convert to array
      allRelayers = Object.values(data);
    }
    
    // Map API response to our Relayer interface
    const mappedRelayers = allRelayers.map((item: any) => ({
      relayerId: item.relayerId || item.address || item.id || item.relayer_id || '',
      label: item.label || '',
      configs: item.configs || [],
      port: item.port || 0,
      createdAt: item.createdAt || item.created_at || item.dateCreated || '',
      expiresAt: item.expiresAt || item.expires_at || item.expiresAt || '',
      health: item.health || null
    }));
    
    // Filter relayers by userId label (case-insensitive to be safe)
    const relayers = mappedRelayers.filter((relayer: Relayer) => 
      relayer.label && relayer.label.toLowerCase() === userId?.toLowerCase()
    );
    
    console.log(`[Relayers] Total from API: ${allRelayers.length}, Filtered for user ${userId}: ${relayers.length}`);
    
    return jsonOk({ relayers, total: relayers.length });

  } catch (error) {
    console.error('[Relayers] Fetch error');
    return jsonError(500, 'Failed to fetch relayers');
  }
}

/**
 * POST /api/managed-testnet-relayers
 * Creates a new managed relayer by calling Builder Hub API.
 */
async function handleCreateRelayer(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
  if (!password) {
    return jsonError(503, 'Relayer service is not configured');
  }

  try {
    const body = await readJsonBody(request, createRelayerSchema);
    if (!body) {
      return jsonError(400, 'Send 1 to 10 configs, each with subnetId, blockchainId, rpcUrl and wsUrl');
    }
    const { configs } = body;

    for (const config of configs) {
      const urlError = relayerUrlError(config);
      if (urlError) return jsonError(400, urlError);
    }

    // Daily cap per account (MANAGED_TESTNET_RELAYERS_DAILY_CREATES), counted on every attempt sent to the service.
    const quota = await reserveDailyProvision(userId!, 'managed-testnet-relayer');
    if (!quota.allowed) {
      const response = jsonError(429, quota.message);
      response.headers.set('retry-after', retryAfterSeconds(quota.resetAt));
      return response;
    }

    // Make the request to Builder Hub API to create relayer
    const response = await fetch(RelayerServiceURLs.create(), {
      method: 'POST',
      headers: {
        'x-admin-password': password,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        configs,
        label: userId
      })
    });

    if (!response.ok) {
      console.error(`[Relayers] Create failed (status: ${response.status})`);
      if (response.status === 429) {
        return jsonError(429, 'Rate limit exceeded. Please wait before creating again.');
      }
      return jsonError(502, 'Failed to create relayer in Builder Hub');
    }

    const data = await response.json();
    console.log('[Relayers] Created relayer successfully');
    return jsonOk({ relayer: data }, 201);

  } catch (error) {
    console.error('[Relayers] Create error');
    return jsonError(500, 'Failed to create relayer');
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGetRelayers(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCreateRelayer(request);
}

