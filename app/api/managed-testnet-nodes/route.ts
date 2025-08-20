import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { prisma } from '@/prisma/prisma';
import { getBlockchainInfo } from '../../../toolbox/src/coreViem/utils/glacier';
import { builderHubUrls } from './constants';

interface NodeInfo {
  nodeIndex: number;
  nodeInfo: {
    result: {
      nodeID: string;
      nodePOP: {
        publicKey: string;
        proofOfPossession: string;
      };
    };
  };
  dateCreated: number;
  expiresAt: number;
}

interface SubnetStatusResponse {
  subnetId: string;
  nodes: NodeInfo[];
}

interface CreateNodeRequest {
  subnetId: string;
  blockchainId: string;
}

async function getUserId(): Promise<{ userId: string | null; error?: NextResponse }> {
  // Skip authentication in development mode for easier testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    return { userId: 'dev-user-id' };
  }
  
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please sign in to access managed testnet nodes'
        },
        { status: 401 }
      )
    };
  }
  
  return { userId: session.user.id };
}

function validateSubnetId(subnetId: string): boolean {
  return subnetId.length >= 40 && subnetId.length <= 60;
}

// GET /api/managed-testnet-nodes/nodes - List all user nodes
async function handleGetNodes(): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
    const nodeRegistrations = await (prisma as any).nodeRegistration.findMany({
      where: {
        user_id: userId,
        status: 'active'
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const nodes = nodeRegistrations.map((node: any) => ({
      id: node.id,
      subnet_id: node.subnet_id,
      blockchain_id: node.blockchain_id,
      node_id: node.node_id,
      node_index: node.node_index,
      rpc_url: node.rpc_url,
      chain_name: node.chain_name,
      created_at: node.created_at,
      expires_at: node.expires_at,
      status: node.status
    }));

    return NextResponse.json({
      nodes: nodes,
      total: nodes.length
    });

  } catch (error) {
    console.error('Failed to fetch node registrations:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to fetch node registrations'
      },
      { status: 500 }
    );
  }
}

// POST /api/managed-testnet-nodes/nodes - Create new node
async function handleCreateNode(request: NextRequest): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  try {
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

    // Fetch chain information to get the chain name
    let chainName: string | null = null;
    try {
      const blockchainInfo = await getBlockchainInfo(blockchainId);
      chainName = blockchainInfo.blockchainName || null;
      console.log(`Fetched chain name: ${chainName} for blockchain ID: ${blockchainId}`);
    } catch (chainInfoError) {
      console.warn(`Failed to fetch chain info for ${blockchainId}:`, chainInfoError);
      // Continue without chain name - it's optional
    }

    // Make the request to Builder Hub API to add node
    const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
    if (!password) {
      throw new Error('MANAGED_TESTNET_NODE_SERVICE_PASSWORD not configured');
    }

    const builderHubUrl = builderHubUrls.addNode(subnetId, password);
    
    const response = await fetch(builderHubUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({})
    });

    const rawText = await response.text();
    let data: SubnetStatusResponse;
    
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(`Invalid response from Builder Hub: ${rawText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      console.error(`Builder Hub API error: ${response.status} ${response.statusText}`);
      const errorMessage = (data as any).error || 
                          (data as any).message || 
                          `Builder Hub API error ${response.status}: ${response.statusText}`;
      
      return NextResponse.json(
        {
          error: 'External service error',
          message: errorMessage
        },
        { status: response.status }
      );
    }

    if ((data as any).error) {
      return NextResponse.json(
        {
          error: 'Builder Hub error',
          message: (data as any).error || 'Builder Hub registration failed'
        },
        { status: 400 }
      );
    }

    // Store the new node in database
    if (data.nodes && data.nodes.length > 0) {
      const rpcUrl = builderHubUrls.rpcEndpoint(blockchainId);
      
      // Find the newest node (highest nodeIndex) as it's likely the one we just created
      const newestNode = data.nodes.reduce((latest, current) => 
        current.nodeIndex > latest.nodeIndex ? current : latest
      );

      try {
        // Check if this node already exists for this user
        const existingNode = await (prisma as any).nodeRegistration.findFirst({
          where: {
            user_id: userId,
            subnet_id: subnetId,
            node_index: newestNode.nodeIndex
          }
        });

        if (!existingNode) {
          const expiresAt = new Date(newestNode.expiresAt);
          
          const createdNode = await (prisma as any).nodeRegistration.create({
            data: {
              user_id: userId,
              subnet_id: subnetId,
              blockchain_id: blockchainId,
              node_id: newestNode.nodeInfo.result.nodeID,
              node_index: newestNode.nodeIndex,
              public_key: newestNode.nodeInfo.result.nodePOP.publicKey,
              proof_of_possession: newestNode.nodeInfo.result.nodePOP.proofOfPossession,
              rpc_url: rpcUrl,
              chain_name: chainName,
              expires_at: expiresAt,
              created_at: new Date(newestNode.dateCreated),
              status: 'active'
            }
          });
          
          console.log(`Node registration stored for subnet ${subnetId} with node index: ${newestNode.nodeIndex}`);

          return NextResponse.json({
            node: {
              id: createdNode.id,
              subnet_id: subnetId,
              blockchain_id: blockchainId,
              node_id: newestNode.nodeInfo.result.nodeID,
              node_index: newestNode.nodeIndex,
              rpc_url: rpcUrl,
              chain_name: chainName,
              created_at: createdNode.created_at,
              expires_at: expiresAt,
              status: 'active'
            },
            builder_hub_response: {
              nodeID: newestNode.nodeInfo.result.nodeID,
              nodePOP: newestNode.nodeInfo.result.nodePOP,
              nodeIndex: newestNode.nodeIndex
            }
          }, { status: 201 });
        } else {
          return NextResponse.json({
            error: 'Conflict',
            message: 'Node already exists for this user'
          }, { status: 409 });
        }
      } catch (dbError) {
        console.error('Failed to store node registration:', dbError);
        throw new Error('Failed to store node registration');
      }
    } else {
      throw new Error('No nodes returned from Builder Hub');
    }
      
  } catch (error) {
    console.error('Failed to create node:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to create node'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit(handleGetNodes, {
    windowMs: isDevelopment ? 60 * 1000 : 60 * 1000, // 1 minute window
    maxRequests: isDevelopment ? 100 : 60, // 100 per minute in dev, 60 per minute in prod
    identifier: async () => {
      const { userId } = await getUserId();
      return userId || 'anonymous';
    }
  });

  return rateLimitHandler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit((req: NextRequest) => handleCreateNode(req), {
    windowMs: isDevelopment ? 60 * 1000 : 24 * 60 * 60 * 1000, // 1 minute in dev, 24 hours in prod
    maxRequests: isDevelopment ? 100 : 3, // 100 per minute in dev, 3 per day in prod
    identifier: async () => {
      const { userId } = await getUserId();
      return userId || 'anonymous';
    }
  });

  return rateLimitHandler(request);
}
