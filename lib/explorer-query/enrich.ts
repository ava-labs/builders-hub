/* Names for the raw things a query returns. Selectors become function
   names, addresses become token symbols or verified contract names,
   topics become event names. The sources are the ones the explorer
   already trusts: the built-in ABI registry, the Sourcify signature
   database behind /api/signatures, the token list, Sourcify itself for
   verified contracts, and the well-known address book. */

import { pchainRows, toHexBytes } from "./pchain-ids";
import { targetOf } from "./target";
import l1ChainsData from "@/constants/l1-chains.json";
import { getFunctionBySelector, getEventVariantsByTopic } from "@/abi/event-signatures.generated";
import { getVerifiedContractResolvingProxies } from "@/lib/sourcify";
import { knownAddress } from "@/lib/evm-explorer";
import type { ColumnMeta } from "./clickhouse";
import type { Names } from "./types";

type Row = Record<string, unknown>;

const SELECTOR = /^0x[0-9a-fA-F]{8}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TOPIC = /^0x[0-9a-fA-F]{64}$/;

interface TokenInfo {
  symbol: string;
  name: string;
}

const tokenCache = new Map<number, { at: number; tokens: Map<string, TokenInfo> }>();
const contractCache = new Map<string, { at: number; name: string | null }>();
const sigCache = new Map<string, string | null>();

async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

async function tokenList(chainId: number, baseUrl: string): Promise<Map<string, TokenInfo>> {
  const hit = tokenCache.get(chainId);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.tokens;
  const body = await getJson<{ tokens?: Record<string, TokenInfo> }>(`${baseUrl}/api/token-list/${chainId}`, 15_000);
  const tokens = new Map(Object.entries(body?.tokens ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  tokenCache.set(chainId, { at: Date.now(), tokens });
  return tokens;
}

/** the kind of thing a column holds, judged from its values */
function kindOf(values: unknown[]): "selector" | "address" | "topic" | null {
  const strs = values.filter((v): v is string => typeof v === "string");
  if (strs.length === 0) return null;
  if (strs.every((s) => SELECTOR.test(s))) return "selector";
  if (strs.every((s) => ADDRESS.test(s))) return "address";
  if (strs.every((s) => TOPIC.test(s))) return "topic";
  return null;
}

const fnName = (sig: string) => sig.split("(")[0];

export async function enrichNames(chainId: number, columns: ColumnMeta[], rows: Row[], baseUrl: string): Promise<Names> {
  const names: Names = {};
  if (rows.length === 0) return names;

  const selectors = new Set<string>();
  const addresses = new Set<string>();
  const topics = new Set<string>();
  const kinds = new Map<string, "selector" | "address" | "topic">();
  for (const col of columns) {
    const k = kindOf(rows.slice(0, 400).map((r) => r[col.name]));
    if (!k) continue;
    kinds.set(col.name, k);
    for (const r of rows) {
      const v = r[col.name];
      if (typeof v !== "string") continue;
      const lower = v.toLowerCase();
      if (k === "selector") selectors.add(lower);
      else if (k === "address") addresses.add(lower);
      else topics.add(lower);
    }
  }
  if (kinds.size === 0) return names;

  // selectors and topics: the registry first, then the signature database
  const fnMap = new Map<string, string>();
  const evMap = new Map<string, string>();
  const askF: string[] = [];
  const askE: string[] = [];
  for (const s of selectors) {
    const hit = getFunctionBySelector(s);
    if (hit) fnMap.set(s, hit.name);
    else if (sigCache.has(s)) {
      const c = sigCache.get(s);
      if (c) fnMap.set(s, c);
    } else askF.push(s);
  }
  for (const t of topics) {
    const hit = getEventVariantsByTopic(t)?.[0];
    if (hit) evMap.set(t, hit.name);
    else if (sigCache.has(t)) {
      const c = sigCache.get(t);
      if (c) evMap.set(t, c);
    } else askE.push(t);
  }
  if (askF.length || askE.length) {
    const qs = new URLSearchParams();
    if (askF.length) qs.set("function", askF.slice(0, 100).join(","));
    if (askE.length) qs.set("event", askE.slice(0, 100).join(","));
    const body = await getJson<{ function?: Record<string, { name: string } | null>; event?: Record<string, { name: string } | null> }>(`${baseUrl}/api/signatures?${qs}`, 10_000);
    for (const s of askF) {
      const v = body?.function?.[s];
      const name = v ? fnName(v.name) : null;
      sigCache.set(s, name);
      if (name) fnMap.set(s, name);
    }
    for (const t of askE) {
      const v = body?.event?.[t];
      const name = v ? fnName(v.name) : null;
      sigCache.set(t, name);
      if (name) evMap.set(t, name);
    }
  }

  // addresses: the address book, the token list, then Sourcify for a few
  const addrMap = new Map<string, string>();
  if (addresses.size) {
    const tokens = await tokenList(chainId, baseUrl);
    const unknown: string[] = [];
    for (const a of addresses) {
      const label = knownAddress(a)?.label ?? tokens.get(a)?.symbol;
      if (label) addrMap.set(a, label);
      else {
        const c = contractCache.get(`${chainId}:${a}`);
        if (c && Date.now() - c.at < 3_600_000) {
          if (c.name) addrMap.set(a, c.name);
        } else unknown.push(a);
      }
    }
    const targets = unknown.slice(0, 16);
    const found = await Promise.all(targets.map((a) => withTimeout(getVerifiedContractResolvingProxies(chainId, a).catch(() => null), 6_000, null)));
    targets.forEach((a, i) => {
      const name = found[i]?.name ?? null;
      contractCache.set(`${chainId}:${a}`, { at: Date.now(), name });
      if (name) addrMap.set(a, name);
    });
  }

  for (const [col, k] of kinds) {
    const src = k === "selector" ? fnMap : k === "address" ? addrMap : evMap;
    const out: Record<string, string> = {};
    for (const r of rows) {
      const v = r[col];
      if (typeof v !== "string") continue;
      const label = src.get(v.toLowerCase());
      if (label) out[v.toLowerCase()] = label;
    }
    if (Object.keys(out).length) names[col] = out;
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* drill templates                                                     */

const PLACEHOLDER = /\{\{\s*([A-Za-z_]\w*)\s*(?::(bytes|raw))?\s*\}\}/g;

/** a template's placeholders replaced with one row's values as SQL literals */
export function fillDrill(template: string, row: Row): { ok: true; sql: string } | { ok: false; error: string } {
  let error: string | null = null;
  const sql = template.replace(PLACEHOLDER, (_m, col: string, mode?: string) => {
    const v = row[col];
    if (v === undefined || v === null) {
      error = `the row has no value for {{${col}}}`;
      return "NULL";
    }
    if (mode === "bytes") {
      const hex = typeof v === "string" ? toHexBytes(v) : null;
      if (hex === null) {
        error = `{{${col}:bytes}} needs a 0x hex string, a CB58 id, a NodeID or a bech32 address, got ${JSON.stringify(v).slice(0, 60)}`;
        return "NULL";
      }
      return `unhex('${hex}')`;
    }
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (mode === "raw") {
      if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return v;
      error = `{{${col}:raw}} needs a number, got ${JSON.stringify(v).slice(0, 60)}`;
      return "NULL";
    }
    return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  });
  return error ? { ok: false, error } : { ok: true, sql };
}

/** the same, for a title a person reads: names where the server found them */
export function fillTitle(template: string, row: Row, names: Names): string {
  return template.replace(PLACEHOLDER, (_m, col: string) => {
    const v = row[col];
    if (v === undefined || v === null) return "?";
    const s = String(v);
    return names[col]?.[s.toLowerCase()] ?? (/^0x[0-9a-fA-F]{20,}$/.test(s) ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);
  });
}

/** names for any target's rows: the EVM lookups above, or on the P-Chain
    bech32 addresses and L1 names for subnet ids */
export async function nameRows(chainId: number, columns: ColumnMeta[], rows: Row[], baseUrl: string): Promise<Names> {
  const target = targetOf(chainId);
  if (target.kind === "evm") return enrichNames(chainId, columns, rows, baseUrl);
  pchainRows(rows, columns, target.hrp ?? "avax");
  const names: Names = {};
  const bySubnet = new Map((l1ChainsData as { subnetId?: string; chainName: string }[]).filter((c) => c.subnetId).map((c) => [c.subnetId!.toLowerCase(), c.chainName]));
  for (const c of columns.filter((k) => /subnet/i.test(k.name))) {
    for (const r of rows) {
      const v = r[c.name];
      const name = typeof v === "string" ? bySubnet.get(v.toLowerCase()) : undefined;
      if (name) (names[c.name] ??= {})[String(v).toLowerCase()] = name;
    }
  }
  return names;
}
