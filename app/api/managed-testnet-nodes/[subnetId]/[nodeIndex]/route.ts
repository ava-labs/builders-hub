import { NextRequest, NextResponse } from 'next/server';
import { getUserId, validateSubnetId, jsonOk, jsonError } from '../../utils';
import { prisma } from '@/prisma/prisma';
import { ManagedTestnetNodesServiceURLs } from '../../constants';
import { extractServiceErrorMessage } from '../../utils';

/**
 * GET /api/managed-testnet-nodes/[subnetId]/[nodeIndex]
 * Returns a specific node (DB-only) for the authenticated user.
 */
async function handleGetNode(subnetId: string, nodeIndex: number): Promise<NextResponse> {
  const auth = await getUserId();
  if (auth.error) return auth.error;
  if (!auth.userId) return jsonError(401, 'Authentication required');
  const userId = auth.userId;

  if (!validateSubnetId(subnetId)) {
    return jsonError(400, 'Invalid subnet ID format');
  }

  try {
    // Only use our database for node info
    const nodeRegistration = await prisma.nodeRegistration.findFirst({
      where: {
        user_id: userId,
        subnet_id: subnetId,
        node_index: nodeIndex,
        status: 'active'
      }
    });

    if (!nodeRegistration) {
      return jsonError(404, 'Node not found or you do not have access to it');
    }

    return jsonOk({ node: nodeRegistration });

  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'Failed to fetch node', error);
  }
}

/**
 * DELETE /api/managed-testnet-nodes/[subnetId]/[nodeIndex]
 * Deletes a node from the external Builder Hub first, then marks the DB record as terminated.
 */
async function handleDeleteNode(subnetId: string, nodeIndex: number): Promise<NextResponse> {
  const auth = await getUserId();
  if (auth.error) return auth.error;
  if (!auth.userId) return jsonError(401, 'Authentication required');
  const userId = auth.userId;

  if (!validateSubnetId(subnetId)) {
    return jsonError(400, 'Invalid subnet ID format');
  }

  try {
    // First verify the user owns this node
    const nodeRegistration = await prisma.nodeRegistration.findFirst({
      where: {
        user_id: userId,
        subnet_id: subnetId,
        node_index: nodeIndex,
        status: 'active'
      }
    });

    // Attempt to delete from Builder Hub (even if no local record) then, if local exists, mark terminated
    const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
    if (!password) {
      return jsonError(503, 'Builder Hub service is not configured');
    }
    
    try {
      const response = await fetch(ManagedTestnetNodesServiceURLs.deleteNode(subnetId, nodeIndex, password), {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok || response.status === 404) {
        if (nodeRegistration) {
          await prisma.nodeRegistration.updateMany({
            where: {
              user_id: userId,
              subnet_id: subnetId,
              node_index: nodeIndex
            },
            data: { status: 'terminated' }
          });
        }

        // Return success even if no local record existed
        return jsonOk({
          success: true,
          deletedExternally: response.status !== 404,
          message: response.status === 404
            ? 'Node was already deleted / expired in Builder Hub. It is now removed from your account.'
            : 'Node deleted in Builder Hub and removed from your account.',
          node: nodeRegistration ? {
            subnet_id: subnetId,
            node_index: nodeIndex,
            status: 'terminated'
          } : undefined
        });
      }

      const message = await extractServiceErrorMessage(response) || 'Failed to delete node from Builder Hub.';
      return jsonError(502, message);

    } catch (hubError) {
      console.error('Builder Hub request failed:', hubError);
      return jsonError(503, 'Builder Hub was unreachable.', hubError);
    }

  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'Failed to delete node', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subnetId: string; nodeIndex: string }> }
): Promise<NextResponse> {
  const { subnetId, nodeIndex } = await params;
  
  const parsedIndex = parseInt(nodeIndex, 10);
  if (Number.isNaN(parsedIndex) || parsedIndex < 0) {
    return jsonError(400, 'Invalid node index format');
  }

  return handleGetNode(subnetId, parsedIndex);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subnetId: string; nodeIndex: string }> }
): Promise<NextResponse> {
  const { subnetId, nodeIndex } = await params;
  
  const parsedIndex = parseInt(nodeIndex, 10);
  if (Number.isNaN(parsedIndex) || parsedIndex < 0) {
    return jsonError(400, 'Invalid node index format');
  }

  return handleDeleteNode(subnetId, parsedIndex);
}
