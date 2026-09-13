import { NextRequest, NextResponse } from "next/server";
import { STATS_API_BASE } from "@/lib/stats-api";
import { normalizeMessageId, type IcmMessage } from "@/lib/icm-message";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8000;

const FINAL_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const PENDING_CACHE = "public, max-age=30, s-maxage=30, stale-while-revalidate=120";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const id = normalizeMessageId(messageId);
  if (!id) {
    return NextResponse.json(
      { error: "messageId must be 32 hex bytes, with or without a 0x prefix" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${STATS_API_BASE}/icm-api/message/${id}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (res.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }

    const body = (await res.json()) as IcmMessage;
    const final = body.status === "executed" || body.status === "executionFailed";
    return NextResponse.json(body, {
      headers: { "Cache-Control": final ? FINAL_CACHE : PENDING_CACHE },
    });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
