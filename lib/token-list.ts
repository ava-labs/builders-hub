"use client";

import { useEffect, useState } from "react";
import { getAddress } from "viem";

/* Token metadata on the client: the chain's Token List (via
   /api/token-list, cached a day) held once per session, plus the ERC-20
   decoding the explorer needs to read a transfer off calldata or a log.
   Logos fall back to the Trust Wallet assets repo, which is keyed by the
   checksummed address, when the list has none. */

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
}

export type TokenMap = Map<string, TokenInfo>;

const cache = new Map<string, TokenMap>();
const pending = new Map<string, Promise<TokenMap>>();

async function loadTokenList(chainId: string): Promise<TokenMap> {
  const hit = cache.get(chainId);
  if (hit) return hit;
  let p = pending.get(chainId);
  if (!p) {
    p = fetch(`/api/token-list/${chainId}`)
      .then((r) => (r.ok ? r.json() : { tokens: {} }))
      .then((body: { tokens?: Record<string, TokenInfo> }) => {
        const map: TokenMap = new Map(Object.entries(body.tokens ?? {}));
        cache.set(chainId, map);
        return map;
      })
      .catch(() => new Map<string, TokenInfo>())
      .finally(() => pending.delete(chainId));
    pending.set(chainId, p);
  }
  return p;
}

/** the chain's token map; empty until loaded, then stable for the session */
export function useTokenList(chainId: string | number | undefined): TokenMap {
  const key = chainId == null ? "" : String(chainId);
  const [map, setMap] = useState<TokenMap>(() => (key && cache.get(key)) || new Map());
  useEffect(() => {
    if (!key) return;
    const hit = cache.get(key);
    if (hit) {
      setMap(hit);
      return;
    }
    let live = true;
    void loadTokenList(key).then((m) => live && setMap(m));
    return () => {
      live = false;
    };
  }, [key]);
  return map;
}

/** Trust Wallet's per-address logo, for tokens the list does not carry */
export function trustWalletLogo(address: string, chainId: string | number): string | null {
  const slug: Record<string, string> = { "43114": "avalanchec" };
  const chain = slug[String(chainId)];
  if (!chain) return null;
  try {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${getAddress(address)}/logo.png`;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* ERC-20 decoding                                                     */

export const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SEL_TRANSFER = "0xa9059cbb";
const SEL_TRANSFER_FROM = "0x23b872dd";

const word = (hex: string, i: number) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
const wordAddr = (w: string) => `0x${w.slice(24)}`;

/** transfer(to, amount) / transferFrom(from, to, amount) off calldata */
export function decodeErc20Call(input: string): { from?: string; to: string; amount: bigint } | null {
  if (!input || input.length < 10) return null;
  const sel = input.slice(0, 10).toLowerCase();
  const data = `0x${input.slice(10)}`;
  try {
    if (sel === SEL_TRANSFER && data.length >= 2 + 128) {
      return { to: wordAddr(word(data, 0)), amount: BigInt(`0x${word(data, 1)}`) };
    }
    if (sel === SEL_TRANSFER_FROM && data.length >= 2 + 192) {
      return { from: wordAddr(word(data, 0)), to: wordAddr(word(data, 1)), amount: BigInt(`0x${word(data, 2)}`) };
    }
  } catch {
    /* malformed calldata */
  }
  return null;
}

export interface Erc20TransferLog {
  token: string;
  from: string;
  to: string;
  amount: bigint;
  logIndex: number;
}

/** Transfer(from, to, value) events among a receipt's logs (ERC-20 only:
 *  three topics and 32 bytes of data; ERC-721 puts the id in a 4th topic) */
export function decodeTransferLogs(
  logs: { logIndex: number; address: string; topics: string[]; data: string }[],
): Erc20TransferLog[] {
  const out: Erc20TransferLog[] = [];
  for (const l of logs) {
    if ((l.topics[0] ?? "").toLowerCase() !== ERC20_TRANSFER_TOPIC || l.topics.length !== 3) continue;
    if (!l.data || l.data.length < 66) continue;
    try {
      out.push({
        token: l.address.toLowerCase(),
        from: wordAddr(l.topics[1].slice(2)),
        to: wordAddr(l.topics[2].slice(2)),
        amount: BigInt(l.data.slice(0, 66)),
        logIndex: l.logIndex,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

/** amount in token units, adaptive precision: "1,250,000", "100.00", "0.0042" */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const v = Number(whole) + Number(frac) / Number(base);
  let text: string;
  if (v >= 1_000_000) text = v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  else if (v >= 1000) text = v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  else if (v >= 1) text = v.toFixed(2);
  else if (v >= 0.0001) text = v.toFixed(4);
  else if (v > 0) text = "<0.0001";
  else text = "0";
  return neg ? `-${text}` : text;
}

/* ------------------------------------------------------------------ */
/* Prices: DefiLlama by way of /api/token-price, batched per address set */

const priceCache = new Map<string, { at: number; usd: number | null }>();
const PRICE_TTL_MS = 60_000;

/** USD per token for the given contracts; entries appear as they resolve */
export function useTokenPrices(chainId: string | number | undefined, addresses: string[]): Map<string, number> {
  const key = chainId == null ? "" : String(chainId);
  const wanted = [...new Set(addresses.map((a) => a.toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))].sort();
  const setKey = wanted.join(",");
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!key || !setKey) return;
    const now = Date.now();
    const missing = wanted.filter((a) => {
      const hit = priceCache.get(`${key}:${a}`);
      return !hit || now - hit.at > PRICE_TTL_MS;
    });
    if (!missing.length) return;
    let live = true;
    fetch(`/api/token-price/${key}?addresses=${missing.join(",")}`)
      .then((r) => (r.ok ? r.json() : { prices: {} }))
      .then((body: { prices?: Record<string, number> }) => {
        const at = Date.now();
        for (const a of missing) priceCache.set(`${key}:${a}`, { at, usd: body.prices?.[a] ?? null });
        if (live) setTick((t) => t + 1);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setKey]);

  const out = new Map<string, number>();
  for (const a of wanted) {
    const hit = priceCache.get(`${key}:${a}`);
    if (hit?.usd) out.set(a, hit.usd);
  }
  return out;
}

/** token amount × USD price → "$1,234.56"; undefined without a price */
export function usdOfToken(amount: bigint, decimals: number, usd: number | undefined): string | undefined {
  if (!usd) return undefined;
  const v = (Number(amount) / 10 ** decimals) * usd;
  if (!Number.isFinite(v) || v === 0) return undefined;
  if (v < 0.01) return "<$0.01";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** plain number of USD, for sums */
export function usdValue(amount: bigint, decimals: number, usd: number | undefined): number {
  if (!usd) return 0;
  const v = (Number(amount) / 10 ** decimals) * usd;
  return Number.isFinite(v) ? v : 0;
}

export function formatUsd(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v > 0 && v < 0.01) return "<$0.01";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** a unit price for display: "$11.03", "$0.0009", "<$0.0001"; never 1.39e-7 */
export function formatPriceUsd(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) return "—";
  if (p >= 1) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return "<$0.0001";
}
