"use client";

import { useEffect, useState } from "react";
import { targetOf, type TargetHeader } from "@/lib/gas-target-math";

/* The live read of utilization against ACP-176's gas target: the last
   blocks' reserved gas per second over the head's target per second. */

const POLL_MS = 12_000;

export async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

interface Header extends TargetHeader {
  timestamp: string;
  timestampMilliseconds?: string;
  gasLimit: string;
}

const msOfHeader = (h: Header) => (h.timestampMilliseconds ? parseInt(h.timestampMilliseconds, 16) : parseInt(h.timestamp, 16) * 1000);

/** the last blocks' reserved gas per second, as a percent of the head's target, refreshed live */
export function useLiveTargetPct(rpcUrl: string | undefined, evmChainId: number, blocks: number): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!rpcUrl) return;
    let cancelled = false;
    const load = async () => {
      try {
        const fh = (await rpcCall(rpcUrl, "eth_feeHistory", [`0x${blocks.toString(16)}`, "latest", []])) as {
          oldestBlock: string;
          gasUsedRatio: number[];
        };
        const oldest = parseInt(fh.oldestBlock, 16);
        const n = fh.gasUsedRatio.length;
        const [before, head] = (await Promise.all([
          rpcCall(rpcUrl, "eth_getBlockByNumber", [`0x${Math.max(0, oldest - 1).toString(16)}`, false]),
          rpcCall(rpcUrl, "eth_getBlockByNumber", [`0x${(oldest + n - 1).toString(16)}`, false]),
        ])) as [Header, Header];
        const target = targetOf(head, evmChainId);
        const seconds = (msOfHeader(head) - msOfHeader(before)) / 1000;
        if (cancelled || target === null || seconds <= 0) return;
        const reserved = fh.gasUsedRatio.reduce((s, r) => s + r, 0) * parseInt(head.gasLimit, 16);
        setPct((reserved / seconds / target) * 100);
      } catch {
        // the last reading stands
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [rpcUrl, evmChainId, blocks]);
  return pct;
}
