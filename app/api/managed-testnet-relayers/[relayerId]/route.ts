import { NextRequest, NextResponse } from 'next/server';
import { getUserId, jsonOk, jsonError, extractServiceErrorMessage } from '../utils';
import { RelayerServiceURLs } from '../constants';

/**
 * DELETE /api/managed-testnet-relayers/[relayerId]
 * Deletes a relayer from the Builder Hub API.
 */
async function handleDeleteRelayer(relayerId: string, request: NextRequest): Promise<NextResponse> {
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
      return jsonError(403, 'Forbidden: You do not have permission to delete this relayer');
    }

    // URL encode the relayerId to handle special characters
    const encodedRelayerId = encodeURIComponent(relayerId);
    const deleteUrl = RelayerServiceURLs.delete(encodedRelayerId, password);
    
    console.log(`[Relayers] Deleting relayer ${relayerId} (encoded: ${encodedRelayerId})`);
    console.log(`[Relayers] Request URL: ${deleteUrl}`);
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log(`[Relayers] Delete response status: ${response.status}`);

    if (response.ok || response.status === 404) {
      return jsonOk({
        success: true,
        message: response.status === 404
          ? 'Relayer was already deleted or expired in Builder Hub.'
          : 'Relayer deleted successfully.'
      });
    }

    const message = await extractServiceErrorMessage(response) || 'Failed to delete relayer from Builder Hub.';
    return jsonError(502, message);

  } catch (hubError) {
    console.error('Builder Hub request failed:', hubError);
    return jsonError(503, 'Builder Hub was unreachable.', hubError);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ relayerId: string }> }
): Promise<NextResponse> {
  const { relayerId } = await params;
  return handleDeleteRelayer(relayerId, request);
}

