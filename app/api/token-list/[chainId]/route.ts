import { NextRequest, NextResponse } from "next/server";

// Token metadata for one EVM chain, from a Token List (the tokenlists.org
// schema: chainId, address, symbol, name, decimals, logoURI per token).
// CoinGecko publishes one per chain; it is fetched here, filtered to the
// chain, keyed by lowercase address, and held for a day. The client uses
// it to name token contracts, scale amounts, and draw logos.

const TOKEN_LISTS: Record<string, string> = {
  "43114": "https://tokens.coingecko.com/avalanche/all.json",
};

interface ListToken {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const url = TOKEN_LISTS[chainId];
  if (!url) {
    return NextResponse.json({ tokens: {} }, { headers: { "Cache-Control": "public, max-age=86400" } });
  }
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "builders-hub-explorer/1.0" },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = (await res.json()) as { tokens?: ListToken[] };
    const tokens: Record<string, TokenInfo> = {};
    for (const t of list.tokens ?? []) {
      if (String(t.chainId) !== chainId || !t.address) continue;
      tokens[t.address.toLowerCase()] = {
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI ?? null,
      };
    }
    return NextResponse.json(
      { tokens, count: Object.keys(tokens).length },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "token list unavailable" },
      { status: 502 },
    );
  }
}
