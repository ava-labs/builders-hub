import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { prisma } from '@/prisma/prisma';
import { builderHubUrls } from '../../constants';

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

function validateNodeIndex(nodeIndex: string): { valid: boolean; index?: number } {
  const index = parseInt(nodeIndex, 10);
  if (isNaN(index) || index < 0) {
    return { valid: false };
  }
  return { valid: true, index };
}

// GET /api/managed-testnet-nodes/[subnetId]/[nodeIndex] - Get specific node
async function handleGetNode(subnetId: string, nodeIndex: number): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  if (!validateSubnetId(subnetId)) {
    return NextResponse.json(
      { 
        error: 'Bad request',
        message: 'Invalid subnet ID format'
      },
      { status: 400 }
    );
  }

  try {
    // First check our database for the node
    const nodeRegistration = await (prisma as any).nodeRegistration.findFirst({
      where: {
        user_id: userId,
        subnet_id: subnetId,
        node_index: nodeIndex,
        status: 'active'
      }
    });

    if (!nodeRegistration) {
      return NextResponse.json(
        { 
          error: 'Not found',
          message: 'Node not found or you do not have access to it'
        },
        { status: 404 }
      );
    }

    // Get real-time status from Builder Hub
    const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
    if (!password) {
      // Return database info without real-time status
      return NextResponse.json({
        node: {
          id: nodeRegistration.id,
          subnet_id: nodeRegistration.subnet_id,
          blockchain_id: nodeRegistration.blockchain_id,
          node_id: nodeRegistration.node_id,
          node_index: nodeRegistration.node_index,
          rpc_url: nodeRegistration.rpc_url,
          chain_name: nodeRegistration.chain_name,
          created_at: nodeRegistration.created_at,
          expires_at: nodeRegistration.expires_at,
          status: nodeRegistration.status
        }
      });
    }

    // Fetch real-time status from Builder Hub
    try {
      const builderHubUrl = builderHubUrls.nodeStatus(subnetId, password);
      
      const response = await fetch(builderHubUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      let realTimeData = null;
      if (response.ok) {
        const rawText = await response.text();
        try {
          const data = JSON.parse(rawText);
          // Find our specific node in the response
          const nodeInHub = data.nodes?.find((n: any) => n.nodeIndex === nodeIndex);
          if (nodeInHub) {
            realTimeData = {
              builder_hub_status: 'active',
              expires_at_hub: new Date(nodeInHub.expiresAt),
              node_info: nodeInHub.nodeInfo
            };
          }
        } catch (parseError) {
          console.warn('Failed to parse Builder Hub response:', parseError);
        }
      }

      return NextResponse.json({
        node: {
          id: nodeRegistration.id,
          subnet_id: nodeRegistration.subnet_id,
          blockchain_id: nodeRegistration.blockchain_id,
          node_id: nodeRegistration.node_id,
          node_index: nodeRegistration.node_index,
          rpc_url: nodeRegistration.rpc_url,
          chain_name: nodeRegistration.chain_name,
          created_at: nodeRegistration.created_at,
          expires_at: nodeRegistration.expires_at,
          status: nodeRegistration.status,
          real_time_data: realTimeData
        }
      });

    } catch (hubError) {
      console.warn('Failed to fetch real-time status from Builder Hub:', hubError);
      // Return database info without real-time status
      return NextResponse.json({
        node: {
          id: nodeRegistration.id,
          subnet_id: nodeRegistration.subnet_id,
          blockchain_id: nodeRegistration.blockchain_id,
          node_id: nodeRegistration.node_id,
          node_index: nodeRegistration.node_index,
          rpc_url: nodeRegistration.rpc_url,
          chain_name: nodeRegistration.chain_name,
          created_at: nodeRegistration.created_at,
          expires_at: nodeRegistration.expires_at,
          status: nodeRegistration.status
        }
      });
    }

  } catch (error) {
    console.error('Failed to fetch node:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to fetch node'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/managed-testnet-nodes/[subnetId]/[nodeIndex] - Delete specific node
async function handleDeleteNode(subnetId: string, nodeIndex: number): Promise<NextResponse> {
  const { userId, error } = await getUserId();
  if (error) return error;

  if (!validateSubnetId(subnetId)) {
    return NextResponse.json(
      { 
        error: 'Bad request',
        message: 'Invalid subnet ID format'
      },
      { status: 400 }
    );
  }

  try {
    // First verify the user owns this node
    const nodeRegistration = await (prisma as any).nodeRegistration.findFirst({
      where: {
        user_id: userId,
        subnet_id: subnetId,
        node_index: nodeIndex,
        status: 'active'
      }
    });

    if (!nodeRegistration) {
      return NextResponse.json(
        { 
          error: 'Not found',
          message: 'Node not found or you do not have access to it'
        },
        { status: 404 }
      );
    }

    // Attempt to delete from Builder Hub
    const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
    if (!password) {
      return NextResponse.json(
        { 
          error: 'Service unavailable',
          message: 'Builder Hub service is not configured'
        },
        { status: 503 }
      );
    }

    const builderHubUrl = builderHubUrls.deleteNode(subnetId, nodeIndex, password);
    
    try {
      const response = await fetch(builderHubUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({})
      });

      // Handle Builder Hub response
      let builderHubSuccess = false;
      if (response.ok) {
        builderHubSuccess = true;
      } else if (response.status === 404) {
        // Node already deleted from Builder Hub, but we should still update our database
        builderHubSuccess = true;
        console.log(`Node ${nodeIndex} not found in Builder Hub, but updating local database`);
      } else {
        const rawText = await response.text();
        console.error(`Builder Hub delete failed: ${response.status} ${response.statusText} - ${rawText}`);
        // Continue to update database even if Builder Hub fails
        builderHubSuccess = false;
      }

      // Update our database regardless of Builder Hub response
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

      console.log(`Node terminated in database for subnet ${subnetId}, node index ${nodeIndex}`);

      return NextResponse.json({
        success: true,
        message: builderHubSuccess 
          ? 'Node successfully deleted from Builder Hub and database'
          : 'Node removed from database (Builder Hub deletion may have failed)',
        node: {
          subnet_id: subnetId,
          node_index: nodeIndex,
          status: 'terminated'
        }
      });

    } catch (hubError) {
      console.error('Builder Hub request failed:', hubError);
      
      // Still update our database even if Builder Hub is unreachable
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

        return NextResponse.json({
          success: true,
          message: 'Node removed from database (Builder Hub was unreachable)',
          node: {
            subnet_id: subnetId,
            node_index: nodeIndex,
            status: 'terminated'
          }
        });
      } catch (dbError) {
        console.error('Failed to update database after Builder Hub error:', dbError);
        throw dbError;
      }
    }

  } catch (error) {
    console.error('Failed to delete node:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to delete node'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { subnetId: string; nodeIndex: string } }
): Promise<NextResponse> {
  const { subnetId, nodeIndex } = params;
  
  const nodeIndexValidation = validateNodeIndex(nodeIndex);
  if (!nodeIndexValidation.valid) {
    return NextResponse.json(
      { 
        error: 'Bad request',
        message: 'Invalid node index format'
      },
      { status: 400 }
    );
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit(
    () => handleGetNode(subnetId, nodeIndexValidation.index!),
    {
      windowMs: isDevelopment ? 60 * 1000 : 60 * 1000, // 1 minute window
      maxRequests: isDevelopment ? 100 : 30, // 100 per minute in dev, 30 per minute in prod
      identifier: async () => {
        const { userId } = await getUserId();
        return `${userId || 'anonymous'}-get-${subnetId}-${nodeIndex}`;
      }
    }
  );

  return rateLimitHandler(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { subnetId: string; nodeIndex: string } }
): Promise<NextResponse> {
  const { subnetId, nodeIndex } = params;
  
  const nodeIndexValidation = validateNodeIndex(nodeIndex);
  if (!nodeIndexValidation.valid) {
    return NextResponse.json(
      { 
        error: 'Bad request',
        message: 'Invalid node index format'
      },
      { status: 400 }
    );
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit(
    () => handleDeleteNode(subnetId, nodeIndexValidation.index!),
    {
      windowMs: isDevelopment ? 60 * 1000 : 60 * 60 * 1000, // 1 minute in dev, 1 hour in prod
      maxRequests: isDevelopment ? 50 : 10, // 50 per minute in dev, 10 per hour in prod
      identifier: async () => {
        const { userId } = await getUserId();
        return `${userId || 'anonymous'}-delete-${subnetId}-${nodeIndex}`;
      }
    }
  );

  return rateLimitHandler(request);
}
