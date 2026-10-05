import { NextResponse } from "next/server";
import { toReleases, type AvalancheGoRelease, type GitHubRelease } from "@/lib/avalanchego-releases";

/* AvalancheGo's recent stable releases, for the validators page's upgrade
   target. GitHub allows 60 unauthenticated calls an hour per IP, so the
   list is held for 30 minutes here and at the edge. */

const RELEASES_URL = "https://api.github.com/repos/ava-labs/avalanchego/releases?per_page=30";
const CACHE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;
const CACHE_CONTROL = "public, max-age=900, s-maxage=1800, stale-while-revalidate=86400";

let cached: { releases: AvalancheGoRelease[]; at: number } | null = null;

/* The token only lifts the rate limit: the repository is public, so a
   token GitHub rejects falls back to an anonymous call. */
async function fetchReleases(): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "Avalanche-Builders-Hub" };
  const token = process.env.GITHUB_TOKEN;
  const call = (h: Record<string, string>) => fetch(RELEASES_URL, { headers: h, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!token) return call(headers);
  const res = await call({ ...headers, Authorization: `Bearer ${token}` });
  return res.status === 401 ? call(headers) : res;
}

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ releases: cached.releases }, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "cache" } });
  }
  try {
    const res = await fetchReleases();
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const releases = toReleases((await res.json()) as GitHubRelease[]);
    if (releases.length === 0) throw new Error("GitHub returned no stable releases");
    cached = { releases, at: Date.now() };
    return NextResponse.json({ releases }, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "fresh" } });
  } catch (error) {
    console.error("[GET /api/avalanchego-releases] Error:", error);
    if (cached) {
      // no-store: a degraded answer must not be pinned at the edge
      return NextResponse.json({ releases: cached.releases }, { headers: { "Cache-Control": "no-store", "X-Data-Source": "error-fallback-cache" } });
    }
    return NextResponse.json({ error: "Failed to fetch AvalancheGo releases" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
