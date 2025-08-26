import { NextRequest, NextResponse } from 'next/server';
import { rateLimited, getUserId, validateSubnetId, jsonOk, jsonError } from './utils';
import { builderHubAddNode, selectNewestNode, createDbNode, getUserNodes } from './service';
import { getBlockchainInfo } from '../../../toolbox/src/coreViem/utils/glacier';
import { CreateNodeRequest, SubnetStatusResponse } from './types';

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

    // Fetch chain information to get the chain name (optional)
    let chainName: string | null = null;
    try {
      const blockchainInfo = await getBlockchainInfo(blockchainId);
      chainName = blockchainInfo.blockchainName || null;
    } catch {}

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
