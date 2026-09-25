import { NextRequest, NextResponse } from "next/server";
import { COMPILE_TIMEOUT_MS } from "@/lib/verification/solc";
import { deleteJobsOlderThan, failStalledJobs } from "@/lib/verification/store";

/*
 * Housekeeping for the verification job table, run on a schedule from
 * vercel.json.
 *
 * Two jobs, both about not leaving callers or rows stranded:
 *  - a job whose instance was recycled mid-compile would otherwise stay
 *    "running" forever, and its poller would loop forever with it;
 *  - completed jobs are only interesting while someone is polling them,
 *    so a week is generous. The verifications themselves are permanent;
 *    it is only the receipts that expire.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const JOB_RETENTION_DAYS = 7;
/** Generous slack over the compile ceiling before declaring a job lost. */
const STALL_AFTER_MS = COMPILE_TIMEOUT_MS + 10 * 60 * 1000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-api-key") === secret
  );
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await failStalledJobs(STALL_AFTER_MS);
    const deleted = await deleteJobsOlderThan(JOB_RETENTION_DAYS);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("[verification] cleanup failed", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
