import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    let userId = 'dev-user-id';

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
    let nodeRegistrations = [];
    
    try {
      nodeRegistrations = await prisma.nodeRegistration.findMany({
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
        console.log('Continuing with empty list in development');
      } else {
        throw new Error('Failed to fetch node registrations');
      }
      nodeRegistrations = [];
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