/* Names for the raw things a query returns. Selectors become function
   names, addresses become token symbols or verified contract names,
   topics become event names. The sources are the ones the explorer
   already trusts: the built-in ABI registry, the Sourcify signature
   database behind /api/signatures, the token list, Sourcify itself for
   verified contracts, the well-known address book, and our contract
   registry (data/contract-registry.json) for C-Chain contracts, their
   protocols and the DEX factories (protocols.ts).

   A selector is 4 bytes, so many names hash to it, and some are mined
   to hit a cheap one (0x00000000). A selector is named by the registry,
   else by the verified code of the contract the row says it was called
   on, else by the signature database only when that name is backed by
   verified code, reads as written for people, and no verified contract
   in the rows says otherwise. */

import { pchainRows, toHexBytes } from "./pchain-ids";
import { LENDING_PROTOCOLS } from "./lending";
import { DEX_CHAIN_ID, DEX_PROTOCOLS, dexContractName } from "./protocols";
import { subnetNames } from "./sources";
import { targetOf } from "./target";
import l1ChainsData from "@/constants/l1-chains.json";
import { getFunctionBySelector, getEventVariantsByTopic } from "@/abi/event-signatures.generated";
import { getVerifiedContractResolvingProxies } from "@/lib/sourcify";
import { toFunctionSelector, type AbiFunction } from "viem";
import { knownAddress } from "@/lib/evm-explorer";
import { getContractInfo, type ContractInfo as RegistryContract } from "@/lib/contracts";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import type { ColumnMeta } from "./clickhouse";
import type { Names } from "./types";
import { HOUR, MINUTE, isAddress, isHash, isSelector } from "./values";

type Row = Record<string, unknown>;

interface TokenInfo {
  symbol: string;
  name: string;
}

interface ContractInfo {
  name: string | null;
  /** selector -> function name from the verified code; null when the code is not verified */
  fns: Map<string, string> | null;
}

const tokenCache = new Map<number, { at: number; ttl: number; tokens: Map<string, TokenInfo> }>();
const contractCache = new Map<string, { at: number; info: ContractInfo }>();
const sigCache = new Map<string, string | null>();

/** the registry's protocol for a contract it knows by address alone; its names are proxy types (ERC1967Proxy), so a
    verified contract's name reads better, and the registry's is the last one tried */
const UNATTRIBUTED = "Infrastructure";

/** a contract the registry lists, as a reader knows it: its protocol, then its name ("Benqi qiUSDC"), or the name
    alone when it already says the protocol ("Benqi Comptroller", "Joe Router V1") */
function registryName(e: RegistryContract): string {
  const protocol = e.protocol.toLowerCase();
  const first = e.name.split(/\s+/)[0].toLowerCase();
  return e.name.toLowerCase().startsWith(protocol) || protocol.split(/\s+/).includes(first) ? e.name : `${e.protocol} ${e.name}`;
}

/** the columns that hold the contract a row's selector was called on, in the order they are trusted */
const CALLED = ["contract", "to_address", "top_contract", "address"];
/** selectors mined for cheap calldata: their signature-database names are rarely the called code's */
const MINED_SELECTOR = /^0x0000/;
/** a name mined to hit a selector, not written for people: a run of digits, or a suffix of mixed case and digits */
const MINED_NAME = /\d{6,}|_(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Z])(?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]{4,}$/;

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

/** the chain's token list by lowercase address, held an hour and a failed read a minute (one bad read once left
    every monitor and name without tokens for the hour); a monitor reads its symbols and decimals too */
export async function tokenList(chainId: number, baseUrl: string): Promise<Map<string, TokenInfo>> {
  const hit = tokenCache.get(chainId);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.tokens;
  const body = await getJson<{ tokens?: Record<string, TokenInfo> }>(`${baseUrl}/api/token-list/${chainId}`, 15_000);
  const tokens = new Map(Object.entries(body?.tokens ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  tokenCache.set(chainId, { at: Date.now(), ttl: body ? HOUR : MINUTE, tokens });
  return tokens;
}

/** the kind of thing a column holds, judged from its values */
function kindOf(values: unknown[]): "selector" | "address" | "topic" | null {
  const strs = values.filter((v): v is string => typeof v === "string");
  if (strs.length === 0) return null;
  if (strs.every((s) => isSelector(s))) return "selector";
  if (strs.every((s) => isAddress(s))) return "address";
  if (strs.every((s) => isHash(s))) return "topic";
  return null;
}

const fnName = (sig: string) => sig.split("(")[0];

/** selector -> function name over a verified ABI */
function abiFunctions(abi: unknown[]): Map<string, string> {
  const fns = new Map<string, string>();
  for (const item of abi as { type?: string; name?: string }[]) {
    if (item?.type !== "function" || !item.name) continue;
    try {
      fns.set(toFunctionSelector(item as AbiFunction), item.name);
    } catch {
      /* a malformed entry names nothing */
    }
  }
  return fns;
}

/** what Sourcify knows of each address, cached for an hour; at most 16 new lookups a call, the first asked first */
async function contractInfos(chainId: number, addrs: string[]): Promise<Map<string, ContractInfo>> {
  const out = new Map<string, ContractInfo>();
  const ask: string[] = [];
  for (const a of new Set(addrs)) {
    const c = contractCache.get(`${chainId}:${a}`);
    if (c && Date.now() - c.at < 3_600_000) out.set(a, c.info);
    else ask.push(a);
  }
  const targets = ask.slice(0, 16);
  const found = await Promise.all(targets.map((a) => withTimeout(getVerifiedContractResolvingProxies(chainId, a).catch(() => null), 6_000, null)));
  targets.forEach((a, i) => {
    const info = { name: found[i]?.name ?? null, fns: found[i]?.abi ? abiFunctions(found[i]!.abi!) : null };
    contractCache.set(`${chainId}:${a}`, { at: Date.now(), info });
    out.set(a, info);
  });
  return out;
}

/* the zero address in a column of tokens is the chain's own coin: Benqi keys its AVAX market by it, and the address
   book's "Null Address" read as a market (the audit's V09: "AVAX (Null Address) accounts for $955k") */
const TOKEN_COLUMN = /(?:^|_)(?:token|asset|underlying|reserve|currency|coin)s?(?:_|$)/i;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function enrichNames(chainId: number, columns: ColumnMeta[], rows: Row[], baseUrl: string): Promise<Names> {
  const names: Names = {};
  if (rows.length === 0) return names;

  // a DEX or lending protocol's slug, as dex_factories or the lending shorthand carries it, reads as the protocol's name
  if (chainId === DEX_CHAIN_ID) {
    const protocols: Record<string, string> = { ...DEX_PROTOCOLS, ...LENDING_PROTOCOLS };
    for (const col of columns) {
      const slugs = rows.map((r) => r[col.name]).filter((v): v is string => typeof v === "string");
      if (slugs.length && slugs.every((v) => Object.hasOwn(protocols, v))) names[col.name] = Object.fromEntries([...new Set(slugs)].map((v) => [v, protocols[v]]));
    }
  }

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

  // each selector with the contracts the rows say it was called on
  const called = CALLED.find((c) => kinds.get(c) === "address");
  const callees = new Map<string, Set<string>>();
  if (called) {
    for (const [col, k] of kinds) {
      if (k !== "selector") continue;
      for (const r of rows) {
        const [s, a] = [r[col], r[called]];
        if (typeof s !== "string" || typeof a !== "string") continue;
        const key = s.toLowerCase();
        if (!callees.has(key)) callees.set(key, new Set());
        callees.get(key)!.add(a.toLowerCase());
      }
    }
  }

  // addresses: the address book, the DEX registry, the contract registry (its tokens after the token list's symbols)
  // and the token list; Sourcify for the rest, below
  const addrMap = new Map<string, string>();
  const unknown: string[] = [];
  if (addresses.size) {
    const tokens = await tokenList(chainId, baseUrl);
    for (const a of addresses) {
      const found = chainId === DEX_CHAIN_ID ? getContractInfo(a) : undefined;
      const listed = found?.protocol === UNATTRIBUTED ? undefined : found;
      const label =
        knownAddress(a)?.label ??
        (chainId === DEX_CHAIN_ID ? dexContractName(a) : null) ??
        (listed && listed.category !== "token" ? registryName(listed) : null) ??
        tokens.get(a)?.symbol ??
        (listed ? registryName(listed) : null);
      if (label) addrMap.set(a, label);
      else unknown.push(a);
    }
  }

  // selectors: the registry, then the called contract's verified code
  const fnMap = new Map<string, string>();
  for (const s of selectors) {
    const hit = getFunctionBySelector(s);
    if (hit) fnMap.set(s, hit.name);
  }
  const unnamed = [...selectors].filter((s) => !fnMap.has(s));
  const infos = await contractInfos(chainId, [...unnamed.flatMap((s) => [...(callees.get(s) ?? [])]), ...unknown]);
  for (const a of unknown) {
    const name = infos.get(a)?.name ?? (chainId === DEX_CHAIN_ID ? getContractInfo(a)?.name : undefined);
    if (name) addrMap.set(a, name);
  }
  // a verified contract without the function says the signature database's name is another function's
  const denied = new Set<string>();
  for (const s of unnamed) {
    const code = [...(callees.get(s) ?? [])].map((a) => infos.get(a)?.fns).filter((f): f is Map<string, string> => !!f);
    const name = code.map((f) => f.get(s)).find(Boolean);
    if (name) fnMap.set(s, name);
    else if (code.length) denied.add(s);
  }

  // then the signature database, and topics: the registry first, then the signature database
  const evMap = new Map<string, string>();
  const askF: string[] = [];
  const askE: string[] = [];
  for (const s of unnamed) {
    if (fnMap.has(s) || denied.has(s) || MINED_SELECTOR.test(s)) continue;
    if (sigCache.has(s)) {
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
    const body = await getJson<{ function?: Record<string, { name: string; verified?: boolean } | null>; event?: Record<string, { name: string } | null> }>(`${baseUrl}/api/signatures?${qs}`, 10_000);
    for (const s of askF) {
      const v = body?.function?.[s];
      // a selector's name only when verified code carries it and a person wrote it
      const name = v?.verified && !MINED_NAME.test(fnName(v.name)) ? fnName(v.name) : null;
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
  if (chainId === DEX_CHAIN_ID) {
    for (const c of columns) {
      if (TOKEN_COLUMN.test(c.name) && rows.some((r) => typeof r[c.name] === "string" && String(r[c.name]).toLowerCase() === ZERO_ADDRESS)) (names[c.name] ??= {})[ZERO_ADDRESS] = "AVAX";
    }
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
  bySubnet.set(PRIMARY_SUBNET_ID.toLowerCase(), "Primary Network");
  const subnetCols = columns.filter((k) => /subnet/i.test(k.name));
  // the validator feed names the L1s the chain catalog does not list
  const unnamed = subnetCols.some((c) => rows.some((r) => typeof r[c.name] === "string" && !bySubnet.has(String(r[c.name]).toLowerCase())));
  if (unnamed) for (const [id, name] of await subnetNames(chainId)) if (!bySubnet.has(id.toLowerCase())) bySubnet.set(id.toLowerCase(), name);
  for (const c of subnetCols) {
    for (const r of rows) {
      const v = r[c.name];
      const name = typeof v === "string" ? bySubnet.get(v.toLowerCase()) : undefined;
      if (name) (names[c.name] ??= {})[String(v).toLowerCase()] = name;
    }
  }
  return names;
}
