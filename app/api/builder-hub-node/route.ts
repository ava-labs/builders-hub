import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { prisma } from '@/prisma/prisma';
import { getBlockchainInfo } from '../../../toolbox/src/coreViem/utils/glacier';

interface JsonRpcResponse {
  jsonrpc: string;
  result?: {
    nodeID: string;
    nodePOP: {
      publicKey: string;
      proofOfPossession: string;
    };
  };
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

async function validateBuilderHubNodeRequest(request: NextRequest): Promise<{ response: NextResponse | null; userId?: string }> {
  try {
    // Always require authentication, even in development
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

    return { response: null, userId: session.user.id };
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

async function handleBuilderHubNodeRequest(request: NextRequest, userId: string): Promise<NextResponse> {
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

    // Check if user already has a node for this subnet
    try {
      const existingNode = await (prisma as any).nodeRegistration.findUnique({
        where: {
          user_id_subnet_id: {
            user_id: userId,
            subnet_id: subnetId
          }
        }
      });

      if (existingNode) {
        throw new Error('You already have a node registered for this subnet');
      }
    } catch (dbError) {
      console.error('Database check failed:', dbError);
      throw new Error('Failed to check existing registrations');
    }

    // Make the request to Builder Hub API
    const password = process.env.BUILDER_HUB_PASSWORD;
    const builderHubUrl = `https://multinode-experimental.solokhin.com/node_admin/registerSubnet/${subnetId}?password=${password}`;
    
    const response = await fetch(builderHubUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const rawText = await response.text();
    let data;
    
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(`Invalid response from Builder Hub: ${rawText.substring(0, 100)}...`);
    }

    if (!response.ok) {
      const jsonRpcResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        error: {
          code: response.status,
          message: data.message || `Builder Hub API error ${response.status}: ${response.statusText}`
        },
        id: 1
      };
      return NextResponse.json(jsonRpcResponse, { status: response.status });
    }

    if (data.error) {
      const jsonRpcResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        error: {
          code: 400,
          message: data.error.message || 'Builder Hub registration failed'
        },
        id: 1
      };
      return NextResponse.json(jsonRpcResponse, { status: 400 });
    }

    if (data.result) {
      // Store node registration in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const rpcUrl = `https://multinode-experimental.solokhin.com/ext/bc/${blockchainId}/rpc`;

      // Store in database
      try {
        await (prisma as any).nodeRegistration.create({
          data: {
            user_id: userId,
            subnet_id: subnetId,
            blockchain_id: blockchainId,
            node_id: data.result.nodeID,
            public_key: data.result.nodePOP.publicKey,
            proof_of_possession: data.result.nodePOP.proofOfPossession,
            rpc_url: rpcUrl,
            chain_name: chainName,
            expires_at: expiresAt,
            status: 'active'
          }
        });
        console.log('Node registration stored in database with chain name:', chainName);
      } catch (dbError) {
        console.error('Failed to store node registration:', dbError);
        throw new Error('Failed to store node registration');
      }

      const jsonRpcResponse: JsonRpcResponse = {
        jsonrpc: "2.0",
        result: data.result,
        id: 1
      };
      return NextResponse.json(jsonRpcResponse);
    } else {
      throw new Error('Unexpected response format from Builder Hub');
    }
      
  } catch (error) {
    console.error('Builder Hub registration failed:', error);
        
    const jsonRpcResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      error: {
        code: 500,
        message: error instanceof Error ? error.message : 'Failed to register subnet with Builder Hub'
      },
      id: 1
    };
        
    return NextResponse.json(jsonRpcResponse, { status: 500 });
  }
}

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
  const rateLimitHandler = rateLimit((req: NextRequest) => handleBuilderHubNodeRequest(req, userId), {
    windowMs: isDevelopment ? 60 * 1000 : 24 * 60 * 60 * 1000, // 1 minute in dev, 24 hours in prod
    maxRequests: isDevelopment ? 100 : 3, // 100 per minute in dev, 3 per day in prod
    identifier: async () => userId // Always use the authenticated user ID for rate limiting
  });
 
  return rateLimitHandler(request);
}

async function handleBuilderHubApiRequest(request: NextRequest): Promise<NextResponse> {
  try {
    // Always require authentication
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

    const body = await request.json();
    const { subnetId } = body;

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

    // Make the request to Builder Hub API to get the original response
    const password = process.env.BUILDER_HUB_PASSWORD;
    const builderHubUrl = `https://multinode-experimental.solokhin.com/node_admin/registerSubnet/${subnetId}?password=${password}`;
    
    const response = await fetch(builderHubUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const rawText = await response.text();
    let data;
    
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
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
    identifier: async () => {
      const session = await getAuthSession();
      if (!session?.user?.id) {
        throw new Error('Authentication required for rate limiting');
      }
      return session.user.id;
    }
  });
 
  return rateLimitHandler(request);
} 