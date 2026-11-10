import { NextResponse, after } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { redis } from "@/lib/redis";
import { SCAN_FRESH_MS, getScan, scanChain } from "@/lib/explorer-query/scan";
import { NETWORK_ID, NETWORK_SLUG, isFuji, targetOf } from "@/lib/explorer-query/target";

/* The Query landing page's live cards (lib/explorer-query/scan.ts).
   GET ?chainId= answers the kept cards of one chain: a read of what a
   scan stored, never a query. GET with the cron's secret and no chain
   scans the C-Chain, the P-Chain and the network, one after the other
   (vercel.json runs it every 15 minutes). An L1 has no schedule: a read
   of its cards starts its scan once the response is out, when the kept
   one is old and no other instance is at it. A scheduled chain gets the
   same scan from a read only when its schedule missed two runs, or when
   no scan is kept (a preview deployment runs no schedule). */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** the chains a schedule scans */
const SCHEDULED = [43114, 1, NETWORK_ID];
const LOCK = "explorer-query:scan-lock:";

/** the native token of a chain, as the query route names it */
function symbolOf(chainId: number): string | null {
  if (chainId === NETWORK_ID || targetOf(chainId).kind === "pchain") return "AVAX";
  const chain = (l1ChainsData as { chainId: string; networkToken?: { symbol?: string } }[]).find((c) => c.chainId === String(chainId));
  return chain ? (chain.networkToken?.symbol ?? "AVAX") : null;
}

/** whether this instance may scan the chain now: one scan of a chain in a period, across every instance */
async function claim(chainId: number): Promise<boolean> {
  try {
    const r = await redis();
    // with no Redis there is nowhere to keep a scan for the next reader: none is run
    return !!r && (await r.set(LOCK + chainId, "1", { NX: true, EX: Math.round(SCAN_FRESH_MS / 1000) })) === "OK";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("chainId");
  const baseUrl = siteBaseUrl();

  if (raw === null) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const done: Record<string, number> = {};
    for (const id of SCHEDULED) done[String(id)] = Object.keys((await scanChain(id, "AVAX", baseUrl)).cards).length;
    return NextResponse.json({ scanned: done });
  }

  const chainId = raw === NETWORK_SLUG ? NETWORK_ID : Number(raw);
  const symbol = raw === NETWORK_SLUG || /^\d+$/.test(raw) ? symbolOf(chainId) : null;
  // Fuji has no live cards: its page shows the questions
  if (!symbol || isFuji(chainId)) return NextResponse.json({ at: null, cards: {} });
  const scan = await getScan(chainId);
  // a scheduled chain waits two periods, so a read never races a schedule that runs on time
  const fresh = SCHEDULED.includes(chainId) ? 2 * SCAN_FRESH_MS : SCAN_FRESH_MS;
  if (!scan || Date.now() - scan.at > fresh) {
    after(async () => {
      if (await claim(chainId)) await scanChain(chainId, symbol, baseUrl).catch(() => undefined);
    });
  }
  return NextResponse.json({ at: scan?.at ?? null, cards: scan?.cards ?? {} }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
