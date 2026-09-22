"use client";

import { useEffect, useState } from "react";
import { fetchHeaderRange, isExecuted, type Head } from "./useHeadStream";
import type { Phase } from "./LiveBoards";

/* Where one block stands in Continuous Execution, from the RPC: the
   header that settled it (the first later header whose settledHeight
   reaches it) and how long that took from its own timestamp. Polls
   while the block is still in flight, stops once settled. */

export interface BlockLifecycle {
  phase: Phase;
  /** the block's own millisecond timestamp (ACP-226) */
  timestampMs: number | null;
  /** the block that settled this one, and the wall time it took */
  settledBy: number | null;
  settleMs: number | null;
  /** whether the RPC has answered at all */
  ready: boolean;
  /** false for blocks sealed before Continuous Execution activated: their
   *  headers carry no settledHeight and they were final on acceptance */
  supported: boolean;
}

const IDLE: BlockLifecycle = {
  phase: "accepted",
  timestampMs: null,
  settledBy: null,
  settleMs: null,
  ready: false,
  supported: true,
};

// settlement lands ~6 blocks out at 1 s spacing and later when the chain
// idles; 16 headers covers every gap seen in practice in one batch
const LOOKAHEAD = 16;

export function useBlockLifecycle(rpcUrl: string | undefined, number: number | null): BlockLifecycle {
  const [state, setState] = useState<BlockLifecycle>(IDLE);

  useEffect(() => {
    if (!rpcUrl || number === null) {
      setState(IDLE);
      return;
    }
    setState(IDLE);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const look = async () => {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]);
        const heads = await fetchHeaderRange(rpcUrl, number, LOOKAHEAD, signal);
        const self: Head | null = heads[0];
        if (!self) throw new Error("no header");
        if (self.settledHeight === null) {
          setState({ ...IDLE, phase: "settled", timestampMs: self.timestampMs, ready: true, supported: false });
          return; // pre-activation block: nothing to watch
        }
        const settler = heads.find((h) => h && h.settledHeight !== null && h.settledHeight >= number) ?? null;
        if (settler) {
          setState({
            phase: "settled",
            timestampMs: self.timestampMs,
            settledBy: settler.number,
            settleMs: settler.timestampMs - self.timestampMs,
            ready: true,
            supported: true,
          });
          return; // final
        }
        const executed = await isExecuted(rpcUrl, number, signal);
        setState({
          phase: executed ? "executed" : "accepted",
          timestampMs: self.timestampMs,
          settledBy: null,
          settleMs: null,
          ready: true,
          supported: true,
        });
      } catch {
        /* keep the last reading */
      }
      if (!controller.signal.aborted) timer = setTimeout(look, 1_500);
    };
    void look();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [rpcUrl, number]);

  return state;
}
