import "server-only";
import { redis } from "@/lib/redis";
import { anchored, runQuery } from "./clickhouse";
import { nameRows } from "./enrich";
import { PCHAIN_EXAMPLES, examplesFor } from "./examples";
import { fixedRecipe } from "./fixed";
import { cardOf, type ScanCard } from "./scan-card";
import { isFuji, targetOf } from "./target";

/* The landing page's live cards. A scan runs each suggestion's fixed SQL once, one query after the other (the
   database key allows two in flight), and keeps what each card shows (scan-card.ts) in Redis. The C-Chain, the
   P-Chain and the network are scanned on a schedule; an L1 is scanned when a reader opens its page and its scan
   is old. No model is asked, and the page never waits on a scan: a card with no kept figure shows its question. */

export interface Scan {
  /** unix ms the scan ended */
  at: number;
  /** each suggestion's card, by its question; a suggestion whose run failed or found nothing has none */
  cards: Record<string, ScanCard>;
}

/** a scan is fresh this long: a schedule's period, and the least time between two scans of one L1 */
export const SCAN_FRESH_MS = 15 * 60_000;
/** a scan is kept this long, so a card keeps a figure through a failed run or two */
const KEEP_S = 6 * 3600;
const PREFIX = "explorer-query:scan:v1:";
/** one instance's copy, so a page read costs Redis one get a minute at most */
const LOCAL_MS = 60_000;
const local = new Map<number, { read: number; scan: Scan | null }>();
/** the scans this instance runs now: a second request for the same chain joins the first */
const running = new Map<number, Promise<Scan>>();

/** the kept scan of a chain, or null when none is kept or Redis is not set */
export async function getScan(chainId: number): Promise<Scan | null> {
  const hit = local.get(chainId);
  if (hit && Date.now() - hit.read < LOCAL_MS) return hit.scan;
  let scan: Scan | null = null;
  try {
    const r = await redis();
    const raw = r ? await r.get(PREFIX + chainId) : null;
    scan = raw ? (JSON.parse(raw) as Scan) : null;
  } catch {
    scan = hit?.scan ?? null;
  }
  local.set(chainId, { read: Date.now(), scan });
  return scan;
}

/** every suggestion of a chain, run once: its cards, kept for the page. A run that fails leaves the card it had */
export function scanChain(chainId: number, symbol: string, baseUrl: string): Promise<Scan> {
  const open = running.get(chainId);
  if (open) return open;
  const run = (async () => {
    const before = (await getScan(chainId))?.cards ?? {};
    const cards: Record<string, ScanCard> = {};
    // the P-Chain has its own suggestions: examplesFor names an EVM chain's
    const groups = isFuji(chainId) ? [] : targetOf(chainId).kind === "pchain" ? PCHAIN_EXAMPLES : examplesFor(chainId);
    for (const { q } of groups.flatMap((g) => g.items)) {
      const recipe = fixedRecipe(chainId, q, symbol);
      if (!recipe) continue;
      try {
        const ran = await anchored(recipe.sql, chainId);
        const result = await runQuery(ran.sql, chainId);
        const names = await nameRows(chainId, result.columns, result.rows, baseUrl).catch(() => ({}));
        const card = cardOf(recipe, result, names, symbol, ran.anchor);
        if (card) cards[q] = card;
      } catch (e) {
        console.warn("[explorer-query] scan failed:", chainId, q, e instanceof Error ? e.message.slice(0, 160) : e);
        if (before[q]) cards[q] = before[q];
      }
    }
    const scan: Scan = { at: Date.now(), cards };
    local.set(chainId, { read: Date.now(), scan });
    try {
      const r = await redis();
      if (r) await r.set(PREFIX + chainId, JSON.stringify(scan), { EX: KEEP_S });
    } catch {
      /* this instance still serves its own copy */
    }
    return scan;
  })();
  running.set(chainId, run);
  void run.finally(() => running.delete(chainId)).catch(() => undefined);
  return run;
}
