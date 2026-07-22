import { NextRequest, NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork } from "@/lib/pchain-explorer";

// Server-side proxy to the P-chain explorer API (plain HTTP on an IP). The
// browser calls same-origin `/api/pchain/{network}/{...}`; this handler fetches
// `${EXPLORER_API_BASE}/api/{network}/{...}` server-side, sidestepping CORS and
// the HTTPS→HTTP mixed-content block. Mirrors the caching/timeout shape of
// app/api/chain-stats/[chainId]/route.ts.

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8000;
// Explorer data is either immutable (tx/block) or refreshed ~30s upstream; a
// short shared cache + SWR keeps the origin light without going stale.
const CACHE_CONTROL = "public, max-age=10, s-maxage=10, stale-while-revalidate=60";

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  } finally {
    clearTimeout(id);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ network: string; path?: string[] }> },
) {
  const { network, path } = await params;

  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 404 });
  }

  const resource = (path ?? []).map(encodeURIComponent).join("/");
  const search = req.nextUrl.search; // forward ?limit=, ?before=, ?q=, …
  const upstream = `${EXPLORER_API_BASE}/api/${network}/${resource}${search}`;

  try {
    const res = await fetchWithTimeout(upstream);
    const body = await res.text();
    // Pass through status + body; attach cache headers only on success.
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        ...(res.ok ? { "cache-control": CACHE_CONTROL } : {}),
      },
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "explorer API timeout" : "explorer API unreachable" },
      { status: 504 },
    );
  }
}
