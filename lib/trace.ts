/* Pure helpers over a transaction trace: flatten the call tree, derive the
   token balance changes from Transfer logs, and size gas per frame. The
   trace is stats-api's (/evm-api/{chain}/tx/{hash}/trace; lib/trace-stats.ts).
   No React, no fetch; the tx page's trace section and the chat compose these.

   The indexed trace holds no per-frame error and no link from a log to the
   frame that emitted it. So only the top frame of a reverted tx carries an
   error, and the logs stay a flat list in log index order. */

import { ERC20_TRANSFER_TOPIC } from "@/lib/token-list";

export interface TraceFrame {
  type: string;
  from: string;
  to?: string;
  input: string;
  output?: string;
  value?: string;
  gas: string;
  gasUsed: string;
  error?: string;
  revertReason?: string;
  calls?: TraceFrame[];
}

export interface TraceLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
}

export interface TraceResponse {
  call: TraceFrame;
  /** every log the tx emitted, in log index order */
  logs: TraceLog[];
}

export const hexInt = (v: string | undefined): number => (v ? parseInt(v, 16) : 0);
export const hexBig = (v: string | undefined): bigint => {
  if (!v || v === "0x") return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
};

/** a frame with its place in the tree */
export interface FlatFrame {
  id: string; // path, e.g. "0.1.2"
  depth: number;
  frame: TraceFrame;
  /** direct children ids, for collapse */
  children: string[];
  /** this frame's gas as a share of the root's */
  share: number;
  /** gas spent by this frame itself, not by its children */
  selfGas: number;
}

export function flatten(root: TraceFrame): FlatFrame[] {
  const total = Math.max(1, hexInt(root.gasUsed));
  const out: FlatFrame[] = [];
  const walk = (f: TraceFrame, id: string, depth: number) => {
    const kids = f.calls ?? [];
    const gas = hexInt(f.gasUsed);
    const childGas = kids.reduce((acc, k) => acc + hexInt(k.gasUsed), 0);
    out.push({
      id,
      depth,
      frame: f,
      children: kids.map((_, i) => `${id}.${i}`),
      share: gas / total,
      selfGas: Math.max(0, gas - childGas),
    });
    kids.forEach((k, i) => walk(k, `${id}.${i}`, depth + 1));
  };
  walk(root, "0", 0);
  return out;
}

/** every distinct contract the execution touched */
export function contractsIn(t: TraceResponse): string[] {
  const set = new Set<string>();
  const walk = (f: TraceFrame) => {
    if (f.to) set.add(f.to.toLowerCase());
    (f.calls ?? []).forEach(walk);
  };
  walk(t.call);
  for (const l of t.logs) set.add(l.address.toLowerCase());
  return [...set];
}

/* ------------------------------------------------------------------ */
/* Balance changes                                                     */

export interface BalanceChange {
  address: string;
  /** the token contract */
  token: string;
  delta: bigint;
}

/** token deltas from the tx's Transfer logs. A reverted call keeps no logs,
 *  so these are the moves that held. Native coin deltas are not here: the
 *  trace rows do not say which inner calls reverted */
export function balanceChanges(t: Pick<TraceResponse, "logs">): BalanceChange[] {
  const out = new Map<string, BalanceChange>();
  const add = (address: string, token: string, delta: bigint) => {
    if (delta === 0n) return;
    const k = `${address}:${token}`;
    const cur = out.get(k);
    if (cur) cur.delta += delta;
    else out.set(k, { address, token, delta });
  };
  for (const log of t.logs) {
    if ((log.topics[0] ?? "").toLowerCase() !== ERC20_TRANSFER_TOPIC || log.topics.length !== 3 || log.data.length < 66) continue;
    const from = `0x${log.topics[1].slice(26)}`.toLowerCase();
    const to = `0x${log.topics[2].slice(26)}`.toLowerCase();
    const amount = hexBig(log.data.slice(0, 66));
    add(from, log.address.toLowerCase(), -amount);
    add(to, log.address.toLowerCase(), amount);
  }
  return [...out.values()].filter((c) => c.delta !== 0n);
}
