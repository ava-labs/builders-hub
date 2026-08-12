import { NextRequest, NextResponse } from "next/server";
import { EXPLORER_API_BASE, isPchainNetwork } from "@/lib/pchain-explorer";

// Server-side proxy to the P-chain explorer API (plain HTTP on an IP). The
// browser calls same-origin `/api/pchain/{network}/{...}`; this handler fetches
// `${EXPLORER_API_BASE}/api/{network}/{...}` server-side, sidestepping CORS and
// the HTTPS→HTTP mixed-content block. Mirrors the caching/timeout shape of
// app/api/chain-stats/[chainId]/route.ts.

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8000;
// Live data (lists, stats, addresses) refreshes ~30s upstream and the origin
// bounds its own staleness (sync refresh on cold cache variants), so keep SWR
// short — a long window here re-serves upstream's stale body past its cure.
const CACHE_CONTROL = "public, max-age=10, s-maxage=10, stale-while-revalidate=15";
// tx/{id} and block/{id} are final at acceptance — once the upstream returns a
// 200 the payload never changes, so cache hard and spare the origin box (its
// per-tx queries scan tens of millions of rows; see 2026-07-21 CH diagnosis).
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
  { params }: { params: Promise<{ network: string; path?: string[] }> },
) {
  const { network, path } = await params;

  if (!isPchainNetwork(network)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 404 });
  }

  const resource = (path ?? []).map(encodeURIComponent).join("/");
  const search = req.nextUrl.search; // forward ?limit=, ?before=, ?q=, …
  const upstream = `${EXPLORER_API_BASE}/api/${network}/${resource}${search}`;

  // The stats aggregate is computed lazily upstream: a cold call takes
  // ~15s before its cache makes it instant. Cutting it off at the default
  // 8s guarantees a 504 AND wastes the compute, so the priming request
  // gets a longer leash.
  const timeoutMs = resource === "stats" ? 25_000 : REQUEST_TIMEOUT_MS;

  try {
    const res = await fetchWithTimeout(upstream, timeoutMs);
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
