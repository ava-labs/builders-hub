import { NextRequest, NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork } from "@/lib/pchain-explorer";

// Same-origin proxy to the C-chain atomic-tx endpoints (/evm-api/{chainId}/atomic-*) (plain HTTP on an IP —
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
    const upstream = await fetch(`${EXPLORER_API_BASE}/evm-api/${network === "fuji" ? 43113 : 43114}/${resource}${qs}`, {
      cache: "no-store", signal: controller.signal, headers: { accept: "application/json" },
    });
    const body = await upstream.text();
    const immutable = resource.startsWith("tx/") || resource.startsWith("block/");
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": "application/json",
        "cache-control": immutable
          ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
          : "public, max-age=10, s-maxage=10, stale-while-revalidate=15",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream timeout" }, { status: 504 });
  } finally {
    clearTimeout(t);
  }
}
