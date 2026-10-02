import { NextRequest, NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork } from "@/lib/pchain-explorer";
import { softStatus } from "@/lib/explorer-soft-status";

// Same-origin proxy to the X-chain explorer API (plain HTTP on an IP —
// see app/api/pchain/.../route.ts for why the browser can't call it direct).
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ network: string; path?: string[] }> },
) {
  const { network, path } = await params;
  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: "unknown network" }, { status: 404 });
  }
  const resource = (path ?? []).map(encodeURIComponent).join("/");
  const qs = req.nextUrl.search;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(`${EXPLORER_API_BASE}/x-api/${network}/${resource}${qs}`, {
      cache: "no-store", signal: controller.signal, headers: { accept: "application/json" },
    });
    const body = await upstream.text();
    const immutable = resource.startsWith("tx/") || resource.startsWith("block/");
    // only a success is kept: a tx the indexer has not reached yet is asked again
    return new NextResponse(
      body,
      softStatus(req, upstream.status, {
        "content-type": "application/json",
        ...(upstream.ok
          ? {
              "cache-control": immutable
                ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
                : "public, max-age=10, s-maxage=10, stale-while-revalidate=15",
            }
          : {}),
      }),
    );
  } catch {
    return NextResponse.json({ error: "upstream timeout" }, softStatus(req, 504));
  } finally {
    clearTimeout(t);
  }
}
