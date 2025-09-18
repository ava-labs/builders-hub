import { NextRequest, NextResponse } from 'next/server';
import { rateLimited, getUserId, validateSubnetId, jsonOk, jsonError } from './utils';
import { builderHubAddNode, selectNewestNode, createDbNode, getUserNodes } from './service';
import { getBlockchainInfo } from '../../../components/toolbox/coreViem/utils/glacier';
import { CreateNodeRequest, SubnetStatusResponse } from './types';
import { prisma } from '@/prisma/prisma';
import { SUBNET_EVM_VM_ID } from '@/constants/console';

// Types moved to ./types

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

    const body: CreateNodeRequest = await request.json();
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

    // Fetch chain information and enforce Subnet EVM VM check
    const blockchainInfo = await getBlockchainInfo(blockchainId);
    const chainName: string | null = blockchainInfo.blockchainName || null;
    if (blockchainInfo.vmId !== SUBNET_EVM_VM_ID) {
      return jsonError(400, `Unsupported VM for this service. Expected Subnet EVM (vmID ${SUBNET_EVM_VM_ID}), got ${blockchainInfo.vmId}.`);
    }

    // Make the request to Builder Hub API to add node
    const data: SubnetStatusResponse = await builderHubAddNode(subnetId);

    // Store the new node in database
    if (data.nodes && data.nodes.length > 0) {
      const newestNode = selectNewestNode(data.nodes);
      const createdNode = await createDbNode({ userId: userId!, subnetId, blockchainId, newestNode, chainName });
      if (!createdNode) return jsonError(409, 'Node already exists for this user (active)');
      return jsonOk({
        node: createdNode,
        builder_hub_response: {
          nodeID: newestNode.nodeInfo.result.nodeID,
          nodePOP: newestNode.nodeInfo.result.nodePOP,
          nodeIndex: newestNode.nodeIndex
        }
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
 * Account-only removal: marks a node as terminated by its DB id when node_index is unknown.
 * Used to clean up nodes that were created before we had the node_index field.
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

    await prisma.nodeRegistration.update({ where: { id }, data: { status: 'terminated' } });
    return jsonOk({ success: true, message: 'Node removed from your account.' });
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : 'Failed to remove node');
  }
}
