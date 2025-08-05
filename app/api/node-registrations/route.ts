import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { rateLimit } from '@/lib/rateLimit';
import { prisma } from '@/prisma/prisma';

async function handleNodeRegistrationsRequest(request: NextRequest): Promise<NextResponse> {
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

    // Fetch user's node registrations
    let nodeRegistrations: any[] = [];
    
    try {
      nodeRegistrations = await (prisma as any).nodeRegistration.findMany({
        where: {
          user_id: userId,
          status: 'active'
        },
        orderBy: {
          created_at: 'desc'
        }
      });
    } catch (dbError) {
      console.error('Database query failed:', dbError);
      if (isDevelopment) {
        console.log('Continuing with empty list in development mode');
        nodeRegistrations = [];
      } else {
        throw new Error('Failed to fetch node registrations');
      }
    }

    // Calculate time remaining for each node
    const nodesWithTimeRemaining = nodeRegistrations.map((node: any) => {
      const now = new Date();
      const timeRemaining = node.expires_at.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
      const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));
      
      return {
        id: node.id,
        subnet_id: node.subnet_id,
        blockchain_id: node.blockchain_id,
        node_id: node.node_id,
        rpc_url: node.rpc_url,
        chain_name: node.chain_name,
        created_at: node.created_at,
        expires_at: node.expires_at,
        status: node.status,
        time_remaining: {
          days: daysRemaining,
          hours: hoursRemaining,
          expired: timeRemaining <= 0
        }
      };
    });

    return NextResponse.json({
      jsonrpc: "2.0",
      result: {
        nodes: nodesWithTimeRemaining,
        total: nodesWithTimeRemaining.length
      },
      id: 1
    });

  } catch (error) {
    console.error('Failed to fetch node registrations:', error);
    return NextResponse.json(
      { 
        jsonrpc: "2.0",
        error: {
          code: 500,
          message: error instanceof Error ? error.message : 'Failed to fetch node registrations'
        },
        id: 1
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting - more generous for read operations
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rateLimitHandler = rateLimit(handleNodeRegistrationsRequest, {
    windowMs: isDevelopment ? 60 * 1000 : 60 * 1000, // 1 minute window in both dev and prod
    maxRequests: isDevelopment ? 100 : 60, // 100 per minute in dev, 60 per minute in prod
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