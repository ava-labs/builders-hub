/* Pure helpers over a transaction trace: flatten the call tree, derive
   the balance changes an execution caused (native from the account diff,
   tokens from Transfer logs), and size gas per frame. No React, no fetch;
   the tx page's trace section composes these. */

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
  logs?: { address: string; topics: string[]; data: string; position?: string }[];
  calls?: TraceFrame[];
}

export interface PrestateAccount {
  balance?: string;
  nonce?: number;
  code?: string;
  storage?: Record<string, string>;
}

export interface TraceResponse {
  call: TraceFrame;
  prestate: { pre: Record<string, PrestateAccount>; post: Record<string, PrestateAccount> } | null;
  opcodes: { op: string; gas: number; count: number }[] | null;
  steps: number | null;
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
export function contractsIn(root: TraceFrame): string[] {
  const set = new Set<string>();
  const walk = (f: TraceFrame) => {
    if (f.to) set.add(f.to.toLowerCase());
    for (const l of f.logs ?? []) set.add(l.address.toLowerCase());
    (f.calls ?? []).forEach(walk);
  };
  walk(root);
  return [...set];
}

/** all logs in execution order, with the frame that emitted them */
export function logsIn(root: TraceFrame): { frameId: string; log: NonNullable<TraceFrame["logs"]>[number] }[] {
  const out: { frameId: string; log: NonNullable<TraceFrame["logs"]>[number] }[] = [];
  const walk = (f: TraceFrame, id: string) => {
    // callTracer orders a frame's logs and calls separately; `position`
    // says after which child call a log fired, so interleave on it
    const kids = f.calls ?? [];
    const logs = [...(f.logs ?? [])].sort((a, b) => hexInt(a.position) - hexInt(b.position));
    let li = 0;
    for (let ci = 0; ci <= kids.length; ci++) {
      while (li < logs.length && hexInt(logs[li].position) <= ci && (ci < kids.length || true)) {
        if (hexInt(logs[li].position) > ci) break;
        out.push({ frameId: id, log: logs[li] });
        li++;
      }
      if (ci < kids.length) walk(kids[ci], `${id}.${ci}`);
    }
    while (li < logs.length) out.push({ frameId: id, log: logs[li++] });
  };
  walk(root, "0");
  return out;
}

/* ------------------------------------------------------------------ */
/* Balance changes                                                     */

export interface BalanceChange {
  address: string;
  /** null = the chain's native coin */
  token: string | null;
  delta: bigint;
}

/** native deltas from the account diff, token deltas from Transfer logs */
export function balanceChanges(t: TraceResponse): BalanceChange[] {
  const out = new Map<string, BalanceChange>();
  const add = (address: string, token: string | null, delta: bigint) => {
    if (delta === 0n) return;
    const k = `${address}:${token ?? "native"}`;
    const cur = out.get(k);
    if (cur) cur.delta += delta;
    else out.set(k, { address, token, delta });
  };
  if (t.prestate) {
    const { pre, post } = t.prestate;
    for (const a of new Set([...Object.keys(pre), ...Object.keys(post)])) {
      const b0 = hexBig(pre[a]?.balance);
      const b1 = post[a]?.balance !== undefined ? hexBig(post[a].balance) : b0;
      if (post[a] && post[a].balance !== undefined) add(a.toLowerCase(), null, b1 - b0);
    }
  }
  for (const { log } of logsIn(t.call)) {
    if ((log.topics[0] ?? "").toLowerCase() !== ERC20_TRANSFER_TOPIC || log.topics.length !== 3 || log.data.length < 66) continue;
    const from = `0x${log.topics[1].slice(26)}`.toLowerCase();
    const to = `0x${log.topics[2].slice(26)}`.toLowerCase();
    const amount = hexBig(log.data.slice(0, 66));
    add(from, log.address.toLowerCase(), -amount);
    add(to, log.address.toLowerCase(), amount);
  }
  return [...out.values()].filter((c) => c.delta !== 0n);
}

/* ------------------------------------------------------------------ */
/* Storage changes                                                     */

export interface StorageChange {
  contract: string;
  slot: string;
  before: string | null;
  after: string | null;
}

export function storageChanges(t: TraceResponse): StorageChange[] {
  if (!t.prestate) return [];
  const { pre, post } = t.prestate;
  const out: StorageChange[] = [];
  for (const [a, acct] of Object.entries(post)) {
    const slots = new Set([...Object.keys(acct.storage ?? {}), ...Object.keys(pre[a]?.storage ?? {})]);
    for (const s of slots) {
      const before = pre[a]?.storage?.[s] ?? null;
      const after = acct.storage?.[s] ?? null;
      if (before !== after) out.push({ contract: a.toLowerCase(), slot: s, before, after });
    }
  }
  return out;
}

/** a 32-byte word as the friendliest thing it can be: an address if it
 *  looks like one, a small integer if it is one, else the hex */
export function wordLabel(word: string | null): string {
  if (!word) return "∅";
  const w = word.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  if (/^0{24}[0-9a-f]{40}$/.test(w) && !/^0{64}$/.test(w) && !/^0{40}/.test(w.slice(24))) return `0x${w.slice(24)}`;
  try {
    const n = BigInt(`0x${w}`);
    if (n < 10n ** 30n) return n.toLocaleString("en-US");
  } catch {
    /* fall through */
  }
  return `0x${w.slice(0, 8)}…${w.slice(-6)}`;
}
