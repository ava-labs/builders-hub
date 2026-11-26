import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { readJsonBody } from '@/lib/api/json-body';
import { consumeQuota } from '@/lib/verification/limits';

// data is free content that the Json column stores as sent: a transaction's result, of a size.
const MAX_DATA_CHARS = 100_000;
const createLogSchema = z.object({
  status: z.string().max(64).optional(),
  actionPath: z.string().max(300).optional(),
  data: z
    .unknown()
    .refine((data) => data === undefined || JSON.stringify(data).length <= MAX_DATA_CHARS)
    .optional(),
});
// a Console action writes one or two entries; an account cannot delete an entry
const LOGS_PER_HOUR = { limit: 600, windowMs: 60 * 60 * 1000 };

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
    const body = await readJsonBody(req, createLogSchema);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { status, actionPath, data } = body;
    if (!status || !actionPath) {
      return NextResponse.json({ error: 'Status and actionPath are required.' }, { status: 400 });
    }
    const quota = await consumeQuota(`console-log:${session.user.id}`, LOGS_PER_HOUR);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: 'Too many log entries. Try again later.' },
        { status: 429, headers: { 'retry-after': String(quota.retryAfterSeconds) } },
      );
    }

    const logEntry = await prisma.consoleLog.create({
      data: {
        user_id: session?.user.id,
        status,
        action_path: actionPath,
        data: data as Prisma.InputJsonValue | undefined
      }
    });

    return NextResponse.json(logEntry);
  } catch (error) {
    console.error('Error adding console log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Log deletion is disabled for audit / metric purposes
