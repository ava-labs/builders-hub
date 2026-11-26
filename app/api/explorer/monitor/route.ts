import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { clientBucket } from "@/lib/net/clientIp";
import { checkedSpec, monitorTokens, readMonitor } from "@/lib/explorer-query/monitor-feed";

/* A Query monitor's feed (lib/explorer-query/monitor.ts): POST { spec, from? } reads the chain's RPC from block
   `from` (or the last few minutes) to the head, and answers the moves it holds, newest first. The page asks every
   few seconds while it shows the monitor; readers of the same monitor share one read. */

// spec is checked whole by checkedSpec; from is a block number, as a number or as its digits
const bodySchema = z.object({
  spec: z.unknown().optional(),
  from: z.union([z.number(), z.string()]).nullish(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// per client per instance: a monitor reads every few seconds, and a reader may keep a few open
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 90;
const seen = new Map<string, { n: number; t: number }>();

function allow(key: string): boolean {
  const now = Date.now();
  const s = seen.get(key);
  if (!s || now - s.t > WINDOW_MS) {
    seen.set(key, { n: 1, t: now });
    if (seen.size > 5_000) for (const [k, v] of seen) if (now - v.t > WINDOW_MS) seen.delete(k);
    return true;
  }
  s.n += 1;
  return s.n <= MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const body = await readJsonBody(req, bodySchema);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const spec = checkedSpec(body.spec);
  if (!spec) return NextResponse.json({ error: "not a monitor this chain can read" }, { status: 400 });
  const from = body.from === undefined || body.from === null ? null : Number(body.from);
  if (from !== null && (!Number.isInteger(from) || from < 0)) return NextResponse.json({ error: "from is a block number" }, { status: 400 });
  if (!allow(clientBucket(req))) return NextResponse.json({ error: "Too many reads. The monitor tries again shortly." }, { status: 429 });
  try {
    const tokens = spec.token ? undefined : await monitorTokens(spec.chainId, siteBaseUrl());
    const read = await readMonitor(spec, from, tokens);
    return NextResponse.json(read, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[POST /api/explorer/monitor]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The chain's RPC did not answer. The monitor tries again shortly." }, { status: 502 });
  }
}
