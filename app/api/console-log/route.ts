import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

// GET /api/console-log - Get user's console logs
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();    

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }
    const logs = await prisma.consoleLog.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: 'desc' },
      take: 100 // Limit to last 100 items
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching console logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/console-log - Add new log entry
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }
    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'No body provided.' }, { status: 400 });
    }
    if (!body.status || !body.actionPath) {
      return NextResponse.json({ error: 'Status and actionPath are required.' }, { status: 400 });
    }
    const { status, actionPath, data } = body;

    const logEntry = await prisma.consoleLog.create({
      data: {
        user_id: session?.user.id,
        status,
        action_path: actionPath,
        data
      }
    });
    return NextResponse.json(logEntry);
  } catch (error) {
    console.error('Error adding console log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Log deletion is disabled for audit / metric purposes
