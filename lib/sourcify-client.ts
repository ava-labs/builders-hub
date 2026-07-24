"use client";

import { useEffect, useState } from "react";
import {
  decodeEventLog as viemDecodeEventLog,
  decodeFunctionData,
  toEventSelector,
  toFunctionSelector,
  type Abi,
  type AbiEvent,
  type AbiFunction,
} from "viem";

/* ------------------------------------------------------------------ */
/* Client side of the Sourcify integration: fetch verification through */
/* the same-origin proxy (/api/sourcify) and decode calldata/logs with  */
/* the verified ABI. The decoders return the exact shapes of the local  */
/* generated registry (abi/event-signatures.generated.ts), so they can  */
/* slot in as fallbacks behind it without touching any rendering.       */
/* ------------------------------------------------------------------ */

export interface SourcifyContract {
  match: "match" | "exact_match";
  name: string | null;
  compilerVersion: string | null;
  language: string | null;
  verifiedAt: string | null;
  abi: Abi | null;
  /** Present when the address is a proxy — the server merged the
   *  implementation's ABI into `abi` already. */
  proxy?: { implementation: string; implementationName: string | null };
}

/* One promise per contract per session — every caller shares the same
   in-flight request and the same answer, hit or miss. Settled values also
   land in a synchronous cache so render paths can read them without
   waiting an effect tick (no hex → name swap on screen). */
const inFlight = new Map<string, Promise<SourcifyContract | null>>();
const resolved = new Map<string, SourcifyContract | null>();

function contractKey(chainId: number | string, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

export function fetchVerifiedContract(
  chainId: number | string,
  address: string,
): Promise<SourcifyContract | null> {
  const key = contractKey(chainId, address);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/sourcify/${chainId}/${address.toLowerCase()}`);
      if (!res.ok) return null;
      const body = await res.json();
      if (!body?.verified) return null;
      return body as SourcifyContract;
    } catch {
      return null;
    }
  })().then((value) => {
    resolved.set(key, value);
    return value;
  });
  inFlight.set(key, promise);
  return promise;
}

/**
 * Resolve a batch of contracts BEFORE committing fresh rows to state, so
 * labelled rows paint labelled on their first frame. Capped: a slow
 * Sourcify can only ever hold fresh data back by `capMs` — after that the
 * rows land unlabelled and the names fade in when they arrive. Already-
 * resolved contracts (the steady-state poll case) pass through instantly.
 */
export async function prewarmContractNames(
  chainId: number | string,
  addresses: Array<string | null | undefined>,
  capMs = 400,
): Promise<void> {
  const pending = Array.from(new Set(addresses.filter(Boolean).map((a) => a!.toLowerCase())))
    .filter((a) => !resolved.has(contractKey(chainId, a)))
    .slice(0, 24);
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(pending.map((a) => fetchVerifiedContract(chainId, a))),
    new Promise<void>((r) => setTimeout(r, capMs)),
  ]);
}

/**
 * Verified-contract names for a rolling set of addresses — built for live
 * tx streams, where rows come and go every poll. Resolved names accumulate
 * across renders (a scrolled-off contract stays labelled when it returns),
 * and the session-level fetch cache means each contract costs one request
 * ever, no matter how many polls repeat it.
 */
export function useContractNames(
  chainId: number | string,
  addresses: Array<string | null | undefined>,
): Map<string, string> {
  // Names are read SYNCHRONOUSLY from the resolved cache on every render:
  // rows whose contracts were prewarmed (prewarmContractNames) paint
  // labelled on their first frame, with no hex → name swap. State exists
  // only to re-render when a straggler resolves after the cap.
  const [, setTick] = useState(0);
  const unique = Array.from(new Set(addresses.filter(Boolean).map((a) => a!.toLowerCase()))).sort();
  // the sorted unique set as a string key: polls that shuffle row order
  // without changing the visible contracts don't re-run the effect
  const key = unique.join(",");

  useEffect(() => {
    if (!key) return;
    const missing = key
      .split(",")
      .filter((a) => !resolved.has(contractKey(chainId, a)))
      .slice(0, 24);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((a) => fetchVerifiedContract(chainId, a))).then(() => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key, chainId]);

  const names = new Map<string, string>();
  for (const a of unique) {
    const c = resolved.get(contractKey(chainId, a));
    if (c?.name) names.set(a, c.name);
  }
  return names;
}

/**
 * Full verified-contract records (name + ABI) for a set of addresses — the
 * same resolution path and session cache as useContractNames, but hands
 * back the whole record so callers can also decode calldata against the
 * verified ABI (method pills in tx tables).
 */
export function useVerifiedContracts(
  chainId: number | string,
  addresses: Array<string | null | undefined>,
): Map<string, SourcifyContract> {
  const [, setTick] = useState(0);
  const unique = Array.from(new Set(addresses.filter(Boolean).map((a) => a!.toLowerCase()))).sort();
  const key = unique.join(",");

  useEffect(() => {
    if (!key) return;
    const missing = key
      .split(",")
      .filter((a) => !resolved.has(contractKey(chainId, a)))
      .slice(0, 24);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((a) => fetchVerifiedContract(chainId, a))).then(() => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key, chainId]);

  const contracts = new Map<string, SourcifyContract>();
  for (const a of unique) {
    const c = resolved.get(contractKey(chainId, a));
    if (c) contracts.set(a, c);
  }
  return contracts;
}

/* Selector → function-name maps, memoized per ABI object: the tx lists
   re-render every second (ticking ages), and toFunctionSelector hashes —
   compute each ABI's map once, not per row per frame. */
const abiSelectorNames = new WeakMap<Abi, Map<string, string>>();

/** Function name for a 4-byte selector from a verified ABI — name lookup
 *  only, no arg decode, so it works when the feed carries just the
 *  selector instead of full calldata. */
export function functionNameFromAbi(
  abi: Abi | null | undefined,
  selector: string | null | undefined,
): string | null {
  if (!abi || !selector || selector.length < 10) return null;
  let map = abiSelectorNames.get(abi);
  if (!map) {
    map = new Map();
    for (const item of abi) {
      if (item.type === "function") {
        try {
          map.set(toFunctionSelector(item as AbiFunction), item.name);
        } catch {
          /* malformed entry — skip */
        }
      }
    }
    abiSelectorNames.set(abi, map);
  }
  return map.get(selector.slice(0, 10).toLowerCase()) ?? null;
}

/* ---- value formatting: match the generated registry's plain-string
        params so both decode paths render identically ---- */
function formatArg(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(formatArg).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    return `(${Object.values(value).map(formatArg).join(", ")})`;
  }
  return String(value ?? "");
}

export interface DecodedEvent {
  name: string;
  signature: string;
  params: Array<{ name: string; type: string; value: string; indexed: boolean }>;
}

/** Decode a log with a verified ABI. Null when the ABI doesn't know the
 *  event — callers fall back to "Unknown Event" exactly as before. */
export function decodeEventWithAbi(
  abi: Abi | null | undefined,
  log: { topics: string[]; data: string },
): DecodedEvent | null {
  if (!abi || !log.topics?.length) return null;
  const event = abi.find(
    (item): item is AbiEvent =>
      item.type === "event" && toEventSelector(item) === log.topics[0].toLowerCase(),
  );
  if (!event) return null;
  try {
    const { args } = viemDecodeEventLog({
      abi: [event],
      topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      data: log.data as `0x${string}`,
      strict: false,
    });
    const named = args !== undefined && !Array.isArray(args);
    return {
      name: event.name,
      signature: `${event.name}(${event.inputs.map((i) => i.type).join(",")})`,
      params: event.inputs.map((input, i) => ({
        name: input.name || `param${i}`,
        type: input.type,
        indexed: input.indexed ?? false,
        value: formatArg(
          named ? (args as Record<string, unknown>)[input.name ?? ""] : (args as unknown[])?.[i],
        ),
      })),
    };
  } catch {
    return null;
  }
}

export interface DecodedFunction {
  name: string;
  signature: string;
  selector: string;
  params: Array<{ name: string; type: string; value: string }>;
}

/** Decode tx calldata with a verified ABI. Null when the selector isn't
 *  in the ABI (e.g. a proxy whose implementation holds the function). */
export function decodeFunctionWithAbi(
  abi: Abi | null | undefined,
  input: string,
): DecodedFunction | null {
  if (!abi || !input || input === "0x" || input.length < 10) return null;
  const selector = input.slice(0, 10).toLowerCase();
  const fn = abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && toFunctionSelector(item) === selector,
  );
  if (!fn) return null;
  try {
    const { args } = decodeFunctionData({ abi: [fn], data: input as `0x${string}` });
    return {
      name: fn.name,
      signature: `${fn.name}(${fn.inputs.map((i) => i.type).join(",")})`,
      selector,
      params: fn.inputs.map((inp, i) => ({
        name: inp.name || `param${i}`,
        type: inp.type,
        value: formatArg((args as unknown[])?.[i]),
      })),
    };
  } catch {
    return null;
  }
}
