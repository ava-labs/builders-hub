"use client";

import { useEffect, useMemo, useState } from "react";
import { SOFT_READ, isOk, statusOf } from "@/lib/explorer-soft-status";
import type { GasProfile, TraceResponse } from "@/lib/trace";

/* One transaction's gas profile (gas by opcode, the opcodes executed, and
   gas used split into intrinsic gas and execution), for the tx page. The
   trace route answers these as null: the debug node gives them from a
   second replay with a JS tracer (lib/debug-trace.ts), so the page asks for
   them once the trace is in, and only where it shows them:

   - the Gas tab: when it opens, or when the pointer or the focus comes to
     it first, so the table is often in by the time the tab opens;
   - the Gas Charged box, for a tx charged half its gas limit (ACP-194's
     floor), which shows the gas execution used.

   The Gas tab asks in the "gesture" lane of the node budget
   (lib/trace-gate.ts), the Gas Charged box in the "open" lane. When the
   budget is spent ("later") the tab says the node is busy, and the page
   asks again, in the gesture lane, on each next tap, click or key, as
   useTrace does. The profile joins the trace object, in the fields the
   trace has for it. */

export type GasState = "idle" | "loading" | "ready" | "later" | "none";

const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

export function useGasProfile(
  chainId: string,
  hash: string,
  trace: TraceResponse | null,
  want: { tab: boolean; floor: boolean },
): { trace: TraceResponse | null; state: GasState } {
  const key = `${chainId}:${hash}`;
  // the asks for this tx: n counts them, gesture names the lane
  const [ask, setAsk] = useState<{ key: string; n: number; gesture: boolean } | null>(null);
  const [got, setGot] = useState<{ key: string; profile: GasProfile | null; state: GasState } | null>(null);
  const asked = ask?.key === key ? ask : null;
  const ready = trace !== null;

  useEffect(() => {
    if (ready && !asked && (want.tab || want.floor)) setAsk({ key, n: 1, gesture: want.tab });
  }, [ready, asked, key, want.tab, want.floor]);

  useEffect(() => {
    if (!asked) return;
    const settle = (profile: GasProfile | null, state: GasState) => setGot({ key: asked.key, profile, state });
    settle(null, "loading");
    const controller = new AbortController();
    // one ask per refusal: a tap's pointerdown and touchend both land here
    const again = () => setAsk((a) => (a === asked ? { key: asked.key, n: asked.n + 1, gesture: true } : a));
    let waiting = false;
    fetch(`/api/trace/${chainId}/${hash}/gas`, {
      headers: { ...SOFT_READ.headers, ...(asked.gesture ? { "x-trace-lane": "gesture" } : {}) },
      signal: controller.signal,
    })
      .then(async (r) => {
        const status = statusOf(r);
        if (status === 429 || status === 503) {
          // a spent budget is no failure: the tab says so, and the next gesture asks again
          settle(null, "later");
          waiting = true;
          for (const g of GESTURES) window.addEventListener(g, again, { once: true, passive: true });
          return;
        }
        if (!isOk(r)) return settle(null, "none");
        settle((await r.json()) as GasProfile, "ready");
      })
      .catch(() => !controller.signal.aborted && settle(null, "none"));
    return () => {
      controller.abort();
      if (waiting) for (const g of GESTURES) window.removeEventListener(g, again);
    };
  }, [asked, chainId, hash]);

  const mine = got?.key === key ? got : null;
  const profile = mine?.profile ?? null;
  const merged = useMemo(() => (trace && profile ? { ...trace, ...profile } : trace), [trace, profile]);
  return { trace: merged, state: mine?.state ?? "idle" };
}
