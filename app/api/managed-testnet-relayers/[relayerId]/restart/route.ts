import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonOk, jsonError, extractServiceErrorMessage } from '../../utils';
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
      const message = await extractServiceErrorMessage(listResponse) || 'Failed to verify relayer ownership';
      return jsonError(502, message);
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
    
    console.log(`[Relayers] Restarting relayer ${relayerId} (encoded: ${encodedRelayerId})`);
    console.log(`[Relayers] Request URL: ${restartUrl}`);
    
    const response = await fetch(restartUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log(`[Relayers] Restart response status: ${response.status}`);
    
    // Log response body for debugging
    const responseText = await response.text();
    console.log(`[Relayers] Restart response body: ${responseText}`);
    
    // Try to parse as JSON
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
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

    // Handle Bad Request with detailed error
    if (response.status === 400) {
      const errorMsg = responseData.error || responseData.message || responseText || 'Bad Request';
      console.error(`[Relayers] Bad Request: ${errorMsg}`);
      return jsonError(400, `Bad Request: ${errorMsg}`);
    }

    const message = responseData.error || responseData.message || responseText || 'Failed to restart relayer.';
    console.error(`[Relayers] Restart failed (${response.status}): ${message}`);
    return jsonError(502, message);

  } catch (hubError) {
    console.error('[Relayers] Restart request failed:', hubError);
    return jsonError(503, 'Builder Hub was unreachable.', hubError);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ relayerId: string }> }
): Promise<NextResponse> {
  const { relayerId } = await context.params;
  return handleRestartRelayer(relayerId, request);
}

