import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { prisma } from '@/prisma/prisma';
import { getBlockchainInfo } from '../../../toolbox/src/coreViem/utils/glacier';

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

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

async function validateBuilderHubNodeRequest(request: NextRequest): Promise<{ response: NextResponse | null; userId?: string }> {
  try {
    // Skip authentication in development mode for easier testing
    const isDevelopment = process.env.NODE_ENV === 'development';
    let userId = 'dev-user-id'; // Default for development
    
    if (!isDevelopment) {
      const session = await getAuthSession();    
      if (!session?.user?.id) {
        return {
          response: NextResponse.json(
            { 
              jsonrpc: "2.0",
              error: {
                code: 401,
                message: 'Authentication required'
              },
              id: 1
            },
            { status: 401 }
          )
        };
      }
      userId = session.user.id;
    }
      
    const searchParams = request.nextUrl.searchParams;
    const subnetId = searchParams.get('subnetId');

    if (!subnetId) {
      return {
        response: NextResponse.json(
          { 
            jsonrpc: "2.0",
            error: {
              code: 400,
              message: 'Subnet ID is required'
            },
            id: 1
          },
          { status: 400 }
        )
      };
    }

    // Basic subnet ID format validation (Base58Check format)
    if (subnetId.length < 40 || subnetId.length > 60) {
      return {
        response: NextResponse.json(
          { 
            jsonrpc: "2.0",
            error: {
              code: 400,
              message: 'Invalid subnet ID format'
            },
            id: 1
          },
          { status: 400 }
        )
      };
    }

    return { response: null, userId };
  } catch (error) {
    console.error('Builder Hub request validation failed:', error);
    return {
      response: NextResponse.json(
        { 
          jsonrpc: "2.0",
          error: {
            code: 500,
            message: error instanceof Error ? error.message : 'Failed to validate request'
          },
          id: 1
        },
        { status: 500 }
      )
    };
  }
}

// Create/Add node to subnet
async function handleAddNodeRequest(request: NextRequest, userId: string): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subnetId = searchParams.get('subnetId')!;
    const blockchainId = searchParams.get('blockchainId');

    if (!blockchainId) {
      throw new Error('Blockchain ID is required');
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
    const password = process.env.BUILDER_HUB_PASSWORD;
    if (!password) {
      throw new Error('BUILDER_HUB_PASSWORD not configured');
    }

    const builderHubUrl = `https://multinode-experimental.solokhin.com/node_admin/subnets/add/${subnetId}?password=${password}`;
    
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
      
      const jsonRpcResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        error: {
          code: response.status,
          message: errorMessage
        },
        id: 1
      };
      return NextResponse.json(jsonRpcResponse, { status: response.status });
    }

    if ((data as any).error) {
      const jsonRpcResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        error: {
          code: 400,
          message: (data as any).error || 'Builder Hub registration failed'
        },
        id: 1
      };
      return NextResponse.json(jsonRpcResponse, { status: 400 });
    }

    // Store all nodes in database
    if (data.nodes && data.nodes.length > 0) {
      const rpcUrl = `https://multinode-experimental.solokhin.com/ext/bc/${blockchainId}/rpc`;
      
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
          
          await (prisma as any).nodeRegistration.create({
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
        }
      } catch (dbError) {
        console.error('Failed to store node registration:', dbError);
        throw new Error('Failed to store node registration');
      }

      const jsonRpcResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        result: {
          nodeID: newestNode.nodeInfo.result.nodeID,
          nodePOP: newestNode.nodeInfo.result.nodePOP,
          nodeIndex: newestNode.nodeIndex
        },
        id: 1
      };
      return NextResponse.json(jsonRpcResponse);
    } else {
      throw new Error('No nodes returned from Builder Hub');
    }
      
  } catch (error) {
    console.error('Builder Hub node creation failed:', error);
        
    const jsonRpcResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      error: {
        code: 500,
        message: error instanceof Error ? error.message : 'Failed to create node with Builder Hub'
      },
      id: 1
    };
        
    return NextResponse.json(jsonRpcResponse, { status: 500 });
  }
}

// GET endpoint for adding nodes (creates a new node)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { response: validationResponse, userId } = await validateBuilderHubNodeRequest(request);

  if (validationResponse) {
    return validationResponse;
  }

  if (!userId) {
    return NextResponse.json(
      { 
        jsonrpc: "2.0",
        error: {
          code: 500,
          message: 'Internal error: missing user ID'
        },
        id: 1
      },
      { status: 500 }
    );
  }

  // Apply rate limiting - 3 requests per day per user in production, more lenient in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit((req: NextRequest) => handleAddNodeRequest(req, userId), {
    windowMs: isDevelopment ? 60 * 1000 : 24 * 60 * 60 * 1000, // 1 minute in dev, 24 hours in prod
    maxRequests: isDevelopment ? 100 : 3, // 100 per minute in dev, 3 per day in prod
    identifier: async () => userId // Always use the authenticated user ID for rate limiting
  });
 
  return rateLimitHandler(request);
}

// Handle status requests and delete operations
async function handleBuilderHubApiRequest(request: NextRequest): Promise<NextResponse> {
  try {
    // Skip authentication in development mode for easier testing
    const isDevelopment = process.env.NODE_ENV === 'development';
    let userId = 'dev-user-id'; // Default for development
    
    if (!isDevelopment) {
      const session = await getAuthSession();
      if (!session?.user?.id) {
        return NextResponse.json(
          { 
            jsonrpc: "2.0",
            error: {
              code: 401,
              message: 'Authentication required'
            },
            id: 1
          },
          { status: 401 }
        );
      }
      userId = session.user.id;
    }

    const body = await request.json();
    const { action, subnetId, nodeIndex } = body;

    if (!subnetId) {
      return NextResponse.json(
        { 
          jsonrpc: "2.0",
          error: {
            code: 400,
            message: 'Subnet ID is required'
          },
          id: 1
        },
        { status: 400 }
      );
    }

    // Basic subnet ID format validation
    if (subnetId.length < 40 || subnetId.length > 60) {
      return NextResponse.json(
        { 
          jsonrpc: "2.0",
          error: {
            code: 400,
            message: 'Invalid subnet ID format'
          },
          id: 1
        },
        { status: 400 }
      );
    }

    const password = process.env.BUILDER_HUB_PASSWORD;
    if (!password) {
      return NextResponse.json(
        { 
          jsonrpc: "2.0",
          error: {
            code: 500,
            message: 'BUILDER_HUB_PASSWORD not configured'
          },
          id: 1
        },
        { status: 500 }
      );
    }
    
    let builderHubUrl: string;
    let method: string;

    // Determine the API endpoint based on action
    if (action === 'delete') {
      if (!nodeIndex && nodeIndex !== 0) {
        return NextResponse.json(
          { 
            jsonrpc: "2.0",
            error: {
              code: 400,
              message: 'Node index is required for delete operation'
            },
            id: 1
          },
          { status: 400 }
        );
      }
      
      // First check if the node exists by getting subnet status
      const statusUrl = `https://multinode-experimental.solokhin.com/node_admin/subnets/status/${subnetId}?password=${password}`;
      console.log(`Checking subnet status before delete: ${statusUrl.replace(/password=[^&]*/, 'password=***')}`);
      
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const statusText = await statusResponse.text();
      console.log(`Status before delete: ${statusResponse.status} ${statusText}`);
      
      if (statusResponse.ok) {
        try {
          const statusData = JSON.parse(statusText);
          const nodeExists = statusData.nodes?.some((node: any) => node.nodeIndex === nodeIndex);
          console.log(`Node ${nodeIndex} exists in BuilderHub:`, nodeExists);
          if (!nodeExists) {
            console.log(`Available nodes:`, statusData.nodes?.map((n: any) => n.nodeIndex) || []);
          }
        } catch (e) {
          console.error('Failed to parse status response:', e);
        }
      }
      
      // Proceed with delete - use POST method like create operation
      builderHubUrl = `https://multinode-experimental.solokhin.com/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${password}`;
      method = 'POST';
      console.log(`Delete request: ${method} ${builderHubUrl.replace(/password=[^&]*/, 'password=***')}`);
    } else {
      // Default to status check
      builderHubUrl = `https://multinode-experimental.solokhin.com/node_admin/subnets/status/${subnetId}?password=${password}`;
      method = 'GET';
    }
    
    const response = await fetch(builderHubUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify({}) : undefined
    });

    const rawText = await response.text();
    console.log(`Delete response: ${response.status} ${response.statusText}`);
    console.log(`Response body: ${rawText}`);
    
    let data;
    
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse delete response as JSON:', parseError);
      return NextResponse.json(
        { 
          jsonrpc: "2.0",
          error: {
            code: 500,
            message: `Invalid response from Builder Hub: ${rawText.substring(0, 100)}...`
          },
          id: 1
        },
        { status: 500 }
      );
    }

    // Handle delete operation - update database
    if (action === 'delete' && (response.ok || response.status === 404)) {
      try {
        await (prisma as any).nodeRegistration.updateMany({
          where: {
            user_id: userId,
            subnet_id: subnetId,
            node_index: nodeIndex
          },
          data: {
            status: 'terminated'
          }
        });
        console.log(`Node terminated in database: subnet ${subnetId}, node index ${nodeIndex} (BuilderHub status: ${response.status})`);
      } catch (dbError) {
        console.error('Failed to update node status in database:', dbError);
      }
    }

    // For delete operations, return success if the node was removed from DB (even if 404 from BuilderHub)
    if (action === 'delete' && response.status === 404) {
      return NextResponse.json({
        jsonrpc: "2.0",
        result: {
          success: true,
          message: "Node removed from database (not found in BuilderHub)",
          subnetId: subnetId,
          nodeIndex: nodeIndex
        },
        id: 1
      });
    }

    // Return the exact response from Builder Hub
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to fetch Builder Hub response:', error);
    return NextResponse.json(
      { 
        jsonrpc: "2.0",
        error: {
          code: 500,
          message: error instanceof Error ? error.message : 'Failed to fetch Builder Hub response'
        },
        id: 1
      },
      { status: 500 }
    );
  }
}

// POST endpoint to get the original API response for a subnet with rate limiting
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting - same as GET since both hit external API
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit(handleBuilderHubApiRequest, {
    windowMs: isDevelopment ? 60 * 1000 : 60 * 60 * 1000, // 1 minute in dev, 1 hour in prod
    maxRequests: isDevelopment ? 50 : 10, // 50 per minute in dev, 10 per hour in prod
    identifier: async (req: NextRequest) => {
      if (isDevelopment) {
        // Use IP in development mode for easier testing
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'localhost';
        return ip;
      } else {
        const session = await getAuthSession();
        if (!session?.user?.id) {
          throw new Error('Authentication required for rate limiting');
        }
        return session.user.id;
      }
    }
  });
 
  return rateLimitHandler(request);
} 