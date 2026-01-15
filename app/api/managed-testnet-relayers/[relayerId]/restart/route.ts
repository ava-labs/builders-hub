import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonOk, jsonError } from '../../utils';
import { RelayerServiceURLs } from '../../constants';

/**
 * POST /api/managed-testnet-relayers/[relayerId]/restart
 * Restarts a relayer. Note: The external service also has rate limiting.
 */
async function handleRestartRelayer(relayerId: string, request: NextRequest): Promise<NextResponse> {
  const auth = await getUserId();
  if (auth.error) return auth.error;
  if (!auth.userId) return jsonError(401, 'Authentication required');

  const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
  if (!password) {
    return jsonError(503, 'Relayer service is not configured');
  }

  try {
    // First verify the relayer belongs to the user by fetching the list
    const listResponse = await fetch(RelayerServiceURLs.list(password), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!listResponse.ok) {
      console.error(`[Relayers] Failed to verify relayer ownership (status: ${listResponse.status})`);
      return jsonError(502, 'Failed to verify relayer ownership');
    }

    const listData = await listResponse.json();
    let allRelayers: any[] = [];
    if (Array.isArray(listData)) {
      allRelayers = listData;
    } else if (listData && Array.isArray(listData.relayers)) {
      allRelayers = listData.relayers;
    } else if (listData && typeof listData === 'object') {
      allRelayers = Object.values(listData);
    }

    // Find the relayer and verify it belongs to the user
    const relayer = allRelayers.find((r: any) => {
      const rId = r.relayerId || r.address || r.id || r.relayer_id || '';
      return rId === relayerId || rId.toLowerCase() === relayerId.toLowerCase();
    });

    if (!relayer) {
      return jsonError(404, 'Relayer not found');
    }

    // Verify ownership by checking the label matches userId
    const relayerLabel = relayer.label || '';
    if (relayerLabel.toLowerCase() !== auth.userId.toLowerCase()) {
      return jsonError(403, 'Forbidden: You do not have permission to restart this relayer');
    }

    // URL encode the relayerId to handle special characters
    const encodedRelayerId = encodeURIComponent(relayerId);
    const restartUrl = RelayerServiceURLs.restart(encodedRelayerId, password);
    
    console.log(`[Relayers] Restarting relayer ${encodedRelayerId}`);
    
    const response = await fetch(restartUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log(`[Relayers] Restart response status: ${response.status}`);

    if (response.ok) {
      let responseData = {};
      try {
        const responseText = await response.text();
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        // Ignore parsing errors, return success anyway
      }
      return jsonOk({
        success: true,
        message: 'Relayer restarted successfully.',
        data: responseData
      });
    }

    // Handle rate limiting from the external service
    if (response.status === 429) {
      return jsonError(429, 'Rate limit exceeded. Please wait before restarting again.');
    }

    // Handle Bad Request with generic message
    if (response.status === 400) {
      console.error(`[Relayers] Bad Request (status: ${response.status})`);
      return jsonError(400, 'Bad Request');
    }

    // Generic error message for any other failure
    console.error(`[Relayers] Restart failed (status: ${response.status})`);
    return jsonError(502, 'Failed to restart relayer.');

  } catch (hubError) {
    console.error('[Relayers] Restart request failed');
    return jsonError(503, 'Builder Hub was unreachable.');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ relayerId: string }> }
): Promise<NextResponse> {
  const { relayerId } = await context.params;
  return handleRestartRelayer(relayerId, request);
}

