import { NextRequest, NextResponse } from "next/server";
import { EVM_API_BASE } from "@/lib/evm-explorer";

// Server-side proxy to the EVM chain explorer API (plain HTTP on an IP). The
// browser calls same-origin `/api/evm/{chainId}/{...}`; this handler fetches
// `${EVM_API_BASE}/evm-api/{chainId}/{...}` server-side, sidestepping CORS and
// the HTTPS→HTTP mixed-content block. Mirrors app/api/pchain/[network]/[...path].
//
// Keyed on chainId (not network) because /evm-api is chain-scoped: the layout
// resolves (network, slug) → chainId from l1-chains.json and the client passes
// the numeric id straight through.

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8000;
// Live data (lists, stats, addresses) refreshes ~30s upstream; a short shared
// cache + SWR keeps the origin light without going stale.
const CACHE_CONTROL = "public, max-age=10, s-maxage=10, stale-while-revalidate=60";
// tx/{hash} and block/{id} are final at acceptance — once the upstream returns
// a 200 the payload never changes, so cache hard and spare the origin box.
const IMMUTABLE_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

function cacheControlFor(resource: string): string {
  return resource.startsWith("tx/") || resource.startsWith("block/")
    ? IMMUTABLE_CACHE_CONTROL
    : CACHE_CONTROL;
}

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // cache: "no-store"
    // we actually want CDN layer cached via the response headers
    return await fetch(url, { cache: "no-store", signal: controller.signal, headers: { accept: "application/json" } });
  } finally {
    clearTimeout(id);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string; path?: string[] }> },
) {
  const { chainId, path } = await params;

  if (!/^\d+$/.test(chainId)) {
    return NextResponse.json({ error: `invalid chainId '${chainId}'` }, { status: 400 });
  }

  const resource = (path ?? []).map(encodeURIComponent).join("/");
  const search = req.nextUrl.search; // forward ?limit=, ?before=, ?q=, …
  const upstream = `${EVM_API_BASE}/evm-api/${chainId}/${resource}${search}`;

  try {
    const res = await fetchWithTimeout(upstream);
    const body = await res.text();
    // Pass through status + body; attach cache headers only on success.
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        ...(res.ok ? { "cache-control": cacheControlFor(resource) } : {}),
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
