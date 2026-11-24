import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  rateLimited,
  getUserId,
  validateSubnetId,
  validateBlockchainId,
  isLiveRegistration,
  jsonOk,
  jsonError,
} from './utils';
import {
  builderHubAddNode,
  builderHubDeleteNode,
  createDbNode,
  getUserNodes,
  ManagedTestnetNodeServiceRequestError,
  selectNewestNode,
} from './service';
import { getBlockchainInfo } from '../../../components/toolbox/coreViem/utils/glacier';
import { SubnetStatusResponse } from './types';
import { prisma } from '@/prisma/prisma';
import { readJsonBody } from '@/lib/api/json-body';
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import { reserveDailyProvision, retryAfterSeconds } from '@/server/services/provision-quota';

// Types moved to ./types

const createNodeSchema = z.object({
  subnetId: z.string().optional(),
  blockchainId: z.string().optional(),
});

/**
 * GET /api/managed-testnet-nodes
 * Lists all active nodes for the authenticated user from the database.
 */
async function handleGetNodes(): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const nodes = await getUserNodes(userId!);
    return jsonOk({ nodes, total: nodes.length });

  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'Failed to fetch node registrations', error);
  }
}

/**
 * POST /api/managed-testnet-nodes
 * Creates a new managed node for a subnet by calling Builder Hub, then stores
 * the node in the database. Enforces a 3-day expiration window in DB.
 */
async function handleCreateNode(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    // Enforce max 3 active nodes per user
    const activeNodes = await getUserNodes(userId!);
    if (activeNodes.length >= 3) {
      return jsonError(429, 'You already have 3 active nodes. Delete one or wait for expiry.');
    }

    const body = await readJsonBody(request, createNodeSchema);
    if (!body) {
      return NextResponse.json(
        {
          error: 'Bad request',
          message: 'Invalid request body'
        },
        { status: 400 }
      );
    }
    const { subnetId, blockchainId } = body;

    if (!subnetId || !blockchainId) {
      return NextResponse.json(
        {
          error: 'Bad request',
          message: 'Both subnetId and blockchainId are required'
        },
        { status: 400 }
      );
    }

    if (!validateSubnetId(subnetId)) {
      return NextResponse.json(
        {
          error: 'Bad request',
          message: 'Invalid subnet ID format'
        },
        { status: 400 }
      );
    }

    if (!validateBlockchainId(blockchainId)) {
      return NextResponse.json(
        {
          error: 'Bad request',
          message: 'Invalid blockchain ID format'
        },
        { status: 400 }
      );
    }

    // Fetch chain information and enforce Subnet EVM VM check
    const blockchainInfo = await getBlockchainInfo(blockchainId);
    const chainName: string | null = blockchainInfo.blockchainName || null;
    if (blockchainInfo.vmId !== SUBNET_EVM_VM_ID) {
      return jsonError(400, `Unsupported VM for this service. Expected Subnet EVM (vmID ${SUBNET_EVM_VM_ID}), got ${blockchainInfo.vmId}.`);
    }

    // Daily cap per account (MANAGED_TESTNET_NODES_DAILY_CREATES), counted on
    // every attempt sent to the node service, so deleting and re-creating
    // nodes cannot get around the 3-active limit above.
    const quota = await reserveDailyProvision(userId!, 'managed-testnet-node');
    if (!quota.allowed) {
      const response = jsonError(429, quota.message);
      response.headers.set('retry-after', retryAfterSeconds(quota.resetAt));
      return response;
    }

    // Make the request to Builder Hub API to add node. Pass blockchainId
    // and chainName so the slot's assignment is registered with both.
    const data: SubnetStatusResponse = await builderHubAddNode(subnetId, blockchainId, chainName);

    // Store the new node in database
    if (data.nodes && data.nodes.length > 0) {
      const newestNode = selectNewestNode(data.nodes);
      const createdNode = await createDbNode({ userId: userId!, subnetId, blockchainId, newestNode, chainName });
      if (!createdNode) {
        try {
          await builderHubDeleteNode(subnetId, newestNode.nodeIndex);
        } catch (rollbackError) {
          console.error('Failed to roll back managed node assignment:', rollbackError);
        }
        return jsonError(409, 'Node already exists for this user (active)');
      }

      return jsonOk({
        node: createdNode,
        builder_hub_response: {
          nodeID: newestNode.nodeInfo.result.nodeID,
          nodePOP: newestNode.nodeInfo.result.nodePOP,
          nodeIndex: newestNode.nodeIndex
        },
      }, 201);
    } else {
      return jsonError(502, 'No nodes returned from Builder Hub');
    }

  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'Failed to create node', error);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGetNodes();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCreateNode(request);
}

/**
 * DELETE /api/managed-testnet-nodes?id=NODE_DB_ID
 * Removes a node by its DB id. When the row has node_index, delete the
 * external managed-node assignment first so the service frees that subnet
 * slot. Legacy rows without node_index can only be removed from the account.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;
  if (!userId) return jsonError(401, 'Authentication required');

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return jsonError(400, 'Missing node id');

  try {
    const record = await prisma.nodeRegistration.findFirst({ where: { id, user_id: userId } });
    if (!record) return jsonError(404, 'Node not found');

    if (record.node_index !== null && record.node_index !== undefined) {
      try {
        // Only a live registration still holds its slot in the node service.
        const deletedExternally = isLiveRegistration(record)
          ? (await builderHubDeleteNode(record.subnet_id, record.node_index)).deletedExternally
          : false;
        await prisma.nodeRegistration.update({ where: { id }, data: { status: 'terminated' } });
        return jsonOk({
          success: true,
          deletedExternally,
          message: deletedExternally
            ? 'Node deleted in Builder Hub and removed from your account.'
            : 'Node was already deleted / expired in Builder Hub. It is now removed from your account.',
        });
      } catch (hubError) {
        const status = hubError instanceof ManagedTestnetNodeServiceRequestError ? hubError.status : 500;
        const message = hubError instanceof Error ? hubError.message : 'Failed to delete node from Builder Hub.';
        return jsonError(status, message, hubError);
      }
    }

    await prisma.nodeRegistration.update({ where: { id }, data: { status: 'terminated' } });
    return jsonOk({
      success: true,
      deletedExternally: false,
      message: 'Node removed from your account. This legacy record had no node index to delete externally.',
    });
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : 'Failed to remove node');
  }
}
