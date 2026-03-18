import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonOk, jsonError } from './utils';
import { RelayerServiceURLs } from './constants';
import { CreateRelayerRequest, Relayer } from './types';

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
    const response = await fetch(RelayerServiceURLs.list(password), {
      method: 'GET',
      headers: {
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
    const body: CreateRelayerRequest = await request.json();
    const { configs } = body;

    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      return jsonError(400, 'Configs array is required and must not be empty');
    }

    // Validate configs
    for (const config of configs) {
      if (!config.subnetId || !config.blockchainId || !config.rpcUrl || !config.wsUrl) {
        return jsonError(400, 'Each config must have subnetId, blockchainId, rpcUrl, and wsUrl');
      }
    }

    // Make the request to Builder Hub API to create relayer
    const response = await fetch(RelayerServiceURLs.create(password), {
      method: 'POST',
      headers: {
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

