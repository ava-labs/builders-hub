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
}

/* One promise per contract per session — every caller shares the same
   in-flight request and the same answer, hit or miss. */
const inFlight = new Map<string, Promise<SourcifyContract | null>>();

export function fetchVerifiedContract(
  chainId: number | string,
  address: string,
): Promise<SourcifyContract | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
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
  })();
  inFlight.set(key, promise);
  return promise;
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
  const [names, setNames] = useState<Map<string, string>>(new Map());
  // the sorted unique set as a string key: polls that shuffle row order
  // without changing the visible contracts don't re-run the effect
  const key = Array.from(new Set(addresses.filter(Boolean).map((a) => a!.toLowerCase())))
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const addrs = key.split(",").slice(0, 24);
    Promise.all(addrs.map(async (a) => [a, await fetchVerifiedContract(chainId, a)] as const)).then(
      (entries) => {
        if (cancelled) return;
        setNames((prev) => {
          const next = new Map(prev);
          for (const [a, c] of entries) if (c?.name) next.set(a, c.name);
          return next;
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, chainId]);

  return names;
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
