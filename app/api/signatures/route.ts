import { NextRequest, NextResponse } from "next/server";

// Names for 4-byte selectors and 32-byte event topics the app has no ABI
// for, from Sourcify's signature database (the openchain dataset). One
// batched GET upstream, held in memory: a selector's name never changes.
// Collisions exist (gas-mined names), so entries backed by a verified
// contract win and the client is told which ones were not.

const UPSTREAM = "https://api.4byte.sourcify.dev/signature-database/v1/lookup";

interface Entry {
  name: string;
  filtered: boolean;
  hasVerifiedContract: boolean;
}
interface Upstream {
  ok: boolean;
  result: { function?: Record<string, Entry[] | null>; event?: Record<string, Entry[] | null> };
}

export interface SignatureHit {
  name: string;
  verified: boolean;
}

const cache = new Map<string, SignatureHit | null>();

const pick = (entries: Entry[] | null | undefined): SignatureHit | null => {
  if (!entries?.length) return null;
  const good = entries.filter((e) => !e.filtered);
  const best = good.find((e) => e.hasVerifiedContract) ?? good[0] ?? entries[0];
  return { name: best.name, verified: !!best.hasVerifiedContract };
};

export async function GET(req: NextRequest) {
  const fns = [...new Set((req.nextUrl.searchParams.get("function") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^0x[0-9a-f]{8}$/.test(s)))].slice(0, 100);
  const evs = [...new Set((req.nextUrl.searchParams.get("event") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^0x[0-9a-f]{64}$/.test(s)))].slice(0, 100);

  const out: { function: Record<string, SignatureHit | null>; event: Record<string, SignatureHit | null> } = { function: {}, event: {} };
  const needF = fns.filter((s) => !cache.has(`f:${s}`));
  const needE = evs.filter((s) => !cache.has(`e:${s}`));

  if (needF.length || needE.length) {
    try {
      const qs = new URLSearchParams({ filter: "true" });
      if (needF.length) qs.set("function", needF.join(","));
      if (needE.length) qs.set("event", needE.join(","));
      const res = await fetch(`${UPSTREAM}?${qs}`, { headers: { "user-agent": "builders-hub-explorer/1.0" }, signal: AbortSignal.timeout(8_000) });
      if (res.ok) {
        const body = (await res.json()) as Upstream;
        for (const s of needF) cache.set(`f:${s}`, pick(body.result.function?.[s]));
        for (const s of needE) cache.set(`e:${s}`, pick(body.result.event?.[s]));
      }
    } catch {
      /* unknowns stay unknown this time; nothing is cached as a miss */
    }
  }
  for (const s of fns) out.function[s] = cache.get(`f:${s}`) ?? null;
  for (const s of evs) out.event[s] = cache.get(`e:${s}`) ?? null;
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
}
