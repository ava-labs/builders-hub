import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ingestGetro } from '@/server/services/ecosystemCareers/ingestGetro';

// Vercel function: scrapes jobs.avax.network into our Postgres so the public
// /ecosystem-careers pages can render from the DB. Mirrors the auth pattern
// used by app/api/validator-alerts/check/route.ts — accepts either the
// Vercel CRON_SECRET (Bearer) or an explicit operator API key.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  // Vercel's cron service hits the endpoint with GET; we also accept POST for
  // manual invocations.
  return handle(req);
}

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('x-api-key');
  const isVercelCron =
    !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isApiKey =
    !!process.env.ECOSYSTEM_JOBS_API_KEY &&
    apiKey === process.env.ECOSYSTEM_JOBS_API_KEY;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ingestGetro();
    revalidatePath('/ecosystem-careers');
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('scrape-ecosystem-jobs failed:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
