"use client";

import { useEffect, useState } from "react";

/* An L1 seat's balance, drawn down to now. The P-Chain debits a seat's
   continuous fee only when a block moves chain time, so a balance it
   reports is the balance as of its last block. From then on the seat
   burns the fee price each second. The node page reads one seat and
   anchors it to the block it was read at; the chains panel reads a whole
   set and anchors it to the fee state's chain time. Both draw it down
   the same way. */

export interface SettledBalance {
  /** nAVAX, as of settledAt */
  balance: number;
  /** unix seconds of the chain time the balance was settled at */
  settledAt: number;
  /** nAVAX the seat burns per second */
  price: number;
}

/** the balance the chain will debit at its next block: the settled figure less the fee burned since, a second at a time */
export function balanceAt(s: SettledBalance, now: number): number {
  return Math.max(0, s.balance - s.price * Math.max(0, Math.floor(now - s.settledAt)));
}

/** unix seconds, ticking once a second while `on` */
export function useSecondClock(on: boolean): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}
