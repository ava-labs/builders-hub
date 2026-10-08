import { NextRequest, NextResponse, after } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { QueryBusyError, runQuery } from "@/lib/explorer-query/clickhouse";
import { getContractInfo } from "@/lib/contracts";
import { knownAddress } from "@/lib/evm-explorer";
import { softStatus } from "@/lib/explorer-soft-status";
import { DAY } from "@/lib/explorer-query/values";
import {
  BURNERS_CHAINS,
  burnDays,
  burnWindow,
  burnersSql,
  codeKind,
  parseBurners,
  type BurnDays,
  type BurnerRow,
  type GasBurners,
} from "@/lib/gas-burners";

// The C-Chain's top AVAX burners over ?days=1|7|30|90 complete UTC days (a
// longer ask gets 90): one query on the stats API's query service. A window
// of complete days does not change until the next UTC day begins, so a board
// is kept in memory until then, and the CDN keeps it up to an hour. A board
// is kept only when the index holds its whole last day. After midnight the
// day before's board stands for up to STALE_MS while the new one is read. A
// read that fails, or that finds the last day unfinished, is not tried again
// for RETRY_MS: the query service's key is shared. A busy service (it runs
// two ad-hoc queries at once) is waited out in the request, and is not a
// failed read. The receivers' kinds come from one eth_getCode batch on the
// chain's public RPC.

export const dynamic = "force-dynamic";
// a 90-day read takes about 14 s, more when the query service is busy, and the reads after a response run in after()
export const maxDuration = 120;

const STALE_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const RPC_TIMEOUT_MS = 5_000;
// the waits before each new try while the query service is busy: its other readers finish in seconds
const BUSY_WAITS_MS = [5_000, 10_000, 15_000];

/* the last complete board of each window, and the last unfinished one */
const complete = new Map<BurnDays, GasBurners>();
const partial = new Map<BurnDays, GasBurners>();
const inflight = new Map<string, Promise<void>>();
/* when a window's read last started without a complete board after it, and when a board's kinds were last read */
const triedAt = new Map<string, number>();
const kindsAt = new Map<BurnDays, number>();

const RPC_URLS = new Map(
  (l1ChainsData as { chainId: string; rpcUrl?: string }[]).flatMap((c) => (c.rpcUrl ? [[Number(c.chainId), c.rpcUrl] as const] : [])),
);

/** each address's kind from one eth_getCode batch; an empty map when the read fails */
async function kindsOf(rpcUrl: string | undefined, addresses: string[]): Promise<Map<string, "contract" | "account" | null>> {
  const kinds = new Map<string, "contract" | "account" | null>();
  if (!rpcUrl || addresses.length === 0) return kinds;
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(addresses.map((a, id) => ({ jsonrpc: "2.0", id, method: "eth_getCode", params: [a, "latest"] }))),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      cache: "no-store",
    });
    const replies = res.ok ? ((await res.json()) as { id: number; result?: unknown }[]) : [];
    for (const r of Array.isArray(replies) ? replies : []) {
      const a = addresses[r.id];
      if (a) kinds.set(a, codeKind(r.result));
    }
  } catch {
    // a kind is a label: the board stands without it
  }
  return kinds;
}

/** a board with a receiver whose kind could not be read */
const kindless = (b: GasBurners) => b.burners.some((r) => r.target && r.targetKind === null);

/** the board with the kinds it lacks, read again */
async function withKinds(chainId: number, board: GasBurners): Promise<GasBurners> {
  const missing = [...new Set(board.burners.flatMap((r) => (r.target && r.targetKind === null ? [r.target] : [])))];
  const kinds = await kindsOf(RPC_URLS.get(chainId), missing);
  if (kinds.size === 0) return board;
  return { ...board, burners: board.burners.map((r) => (r.target && r.targetKind === null ? { ...r, targetKind: kinds.get(r.target) ?? null } : r)) };
}

/** the query's rows, after the waits of BUSY_WAITS_MS while the query service is busy */
async function query(sql: string) {
  for (let tried = 0; ; tried += 1) {
    try {
      return await runQuery(sql);
    } catch (error) {
      if (!(error instanceof QueryBusyError) || tried >= BUSY_WAITS_MS.length) throw error;
      await new Promise((r) => setTimeout(r, BUSY_WAITS_MS[tried]));
    }
  }
}

async function build(chainId: number, days: BurnDays, win: ReturnType<typeof burnWindow>): Promise<{ board: GasBurners; done: boolean }> {
  const result = await query(burnersSql(chainId, win.start, win.end));
  const { complete: done, ...parsed } = parseBurners(result.rows as unknown as BurnerRow[]);
  const board: GasBurners = {
    chainId,
    days,
    from: win.from,
    to: win.to,
    ...parsed,
    burners: parsed.burners.map((b) => ({
      ...b,
      targetName: b.target ? (getContractInfo(b.target)?.protocol ?? knownAddress(b.target, chainId)?.label ?? null) : null,
    })),
  };
  return { board: await withKinds(chainId, board), done };
}

/** reads a window's board once: a read in flight is joined, and a window tried in the last RETRY_MS is not read */
function read(chainId: number, days: BurnDays, win: ReturnType<typeof burnWindow>): Promise<void> {
  const key = `${days}:${win.to}`;
  const running = inflight.get(key);
  if (running) return running;
  const now = Date.now();
  if (now - (triedAt.get(key) ?? -Infinity) < RETRY_MS) return Promise.resolve();
  for (const k of triedAt.keys()) if (!k.endsWith(win.to)) triedAt.delete(k);
  triedAt.set(key, now);
  kindsAt.set(days, now);
  const p = build(chainId, days, win)
    .then(({ board, done }) => {
      // a slow read of an older window must not replace a newer board
      const boards = done ? complete : partial;
      const kept = boards.get(days);
      if (!kept || kept.to <= board.to) boards.set(days, board);
      if (done) triedAt.delete(key);
    })
    .catch((error) => {
      // a service still busy after the waits is not a failed read: the next request reads again
      if (error instanceof QueryBusyError) triedAt.delete(key);
      console.error("[GET /api/explorer/burners] read failed:", error);
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** the CDN keeps a final board until the next UTC day begins, and never more than an hour; a board that can change, a minute */
function cacheControl(now: number, final: boolean): string {
  const nextDay = Math.ceil(now / DAY) * DAY;
  const sMaxAge = final ? Math.max(60, Math.min(3600, Math.floor((nextDay - now) / 1000))) : 60;
  return `public, max-age=60, s-maxage=${sMaxAge}, stale-while-revalidate=3600`;
}

function reply(board: GasBurners, now: number, final: boolean, source: string) {
  return NextResponse.json(board, { headers: { "Cache-Control": cacheControl(now, final), "X-Data-Source": source } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId: raw } = await params;
  const chainId = Number(raw);
  if (!BURNERS_CHAINS.has(chainId)) {
    return NextResponse.json({ error: `no burner board for chain '${raw}'` }, softStatus(req, 404));
  }
  const asked = Number(req.nextUrl.searchParams.get("days") ?? 7);
  const days = burnDays(Number.isFinite(asked) ? asked : 7);
  const now = Date.now();
  const win = burnWindow(days, new Date(now));
  const hit = complete.get(days);

  if (hit?.to === win.to) {
    // a board whose kinds could not be read tries them again, and the CDN keeps it for a minute until they come
    const missing = kindless(hit);
    if (missing && now - (kindsAt.get(days) ?? 0) >= RETRY_MS) {
      kindsAt.set(days, now);
      after(() => withKinds(chainId, hit).then((b) => complete.get(days) === hit && complete.set(days, b)));
    }
    return reply(hit, now, !missing, "cache");
  }
  const reading = read(chainId, days, win);
  // the day before's board, while the new day's is read
  const today = Date.parse(`${win.to}T00:00:00Z`) + DAY;
  if (hit && Date.parse(`${hit.to}T00:00:00Z`) === today - 2 * DAY && now - today < STALE_MS) {
    // the read goes on after the response, so the platform keeps the instance until it ends
    after(() => reading);
    return reply(hit, now, false, "stale");
  }
  await reading;
  const fresh = complete.get(days);
  if (fresh?.to === win.to) return reply(fresh, now, !kindless(fresh), "fresh");
  // the index has not reached the end of the last day: the board as far as it goes, for a minute
  const part = partial.get(days);
  if (part?.to === win.to) return reply(part, now, false, "partial");
  return NextResponse.json({ error: "the top burners could not be read" }, softStatus(req, 502, { "cache-control": "no-store" }));
}
