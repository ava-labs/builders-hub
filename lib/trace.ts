/* Pure helpers over a transaction trace: build the call tree from the
   ingestion pipeline's rows (raw_traces, raw_logs; lib/trace-clickhouse.ts),
   flatten it, derive the token balance changes from Transfer logs, and size
   gas per frame. No React, no fetch; the tx page's trace section and the
   chat compose these.

   The rows hold no per-frame error and no link from a log to the frame
   that emitted it. So only the top frame of a reverted tx carries an error
   (with the reason its output holds), and the logs stay a flat list in
   log index order. */

import { decodeAbiParameters } from "viem";
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

/** one row of the trace query: a frame (kind 0) or a log (kind 1). Bytes
 *  and addresses are lower-case hex without 0x; value is a decimal string */
export interface TraceRow {
  kind: number;
  /** a frame's trace_address joined with dots ("" for the top frame), or a log's index */
  pos: string;
  type: string;
  /** a frame's sender, or a log's emitter */
  src: string;
  dst: string;
  /** the frame has no target (a failed creation) */
  no_to: number | boolean;
  value: string;
  gas: number;
  gas_used: number;
  /** a frame's input, or a log's data */
  input: string;
  /** a frame's output, or a log's topics joined with commas */
  output: string;
  ok: boolean;
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

const PANICS: Record<number, string> = {
  0x01: "assert failed",
  0x11: "arithmetic overflow",
  0x12: "division by zero",
  0x21: "invalid enum value",
  0x22: "bad storage byte array",
  0x31: "pop on an empty array",
  0x32: "array index out of bounds",
  0x41: "out of memory",
  0x51: "call to an uninitialized function",
};

/** the reason a reverted call's output holds: an Error(string) message, a
 *  Panic(uint256) code, or a custom error's selector. Null for an empty
 *  output, which is also what an out-of-gas stop leaves */
export function revertReason(output: string | undefined): string | null {
  const hex = (output ?? "").toLowerCase();
  if (hex.length < 10) return null;
  const sel = hex.slice(0, 10);
  const body = `0x${hex.slice(10)}` as `0x${string}`;
  try {
    if (sel === "0x08c379a0") return decodeAbiParameters([{ type: "string" }], body)[0];
    if (sel === "0x4e487b71") {
      const code = Number(decodeAbiParameters([{ type: "uint256" }], body)[0]);
      return `panic 0x${code.toString(16).padStart(2, "0")}${PANICS[code] ? ` (${PANICS[code]})` : ""}`;
    }
  } catch {
    /* not the shape its selector says: name the selector */
  }
  return `custom error ${sel}`;
}

const path = (pos: string): number[] => (pos === "" ? [] : pos.split(".").map(Number));

/** a frame's place before another's: depth-first, parents before children */
function byPath(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/** the call tree and the logs from the trace query's rows, or null when
 *  the rows hold no top frame. A frame whose parent is missing hangs under
 *  its nearest ancestor that is there, so no frame is lost */
export function traceFromRows(rows: TraceRow[]): TraceResponse | null {
  const frames = rows
    .filter((r) => Number(r.kind) === 0)
    .map((r) => ({ r, p: path(r.pos) }))
    .sort((a, b) => byPath(a.p, b.p));
  if (frames.length === 0 || frames[0].p.length !== 0) return null;

  const byPos = new Map<string, TraceFrame>();
  for (const { r, p } of frames) {
    const value = BigInt(r.value || "0");
    const f: TraceFrame = {
      type: r.type,
      from: `0x${r.src}`,
      to: r.no_to === true || Number(r.no_to) === 1 ? undefined : `0x${r.dst}`,
      input: `0x${r.input}`,
      output: `0x${r.output}`,
      value: `0x${value.toString(16)}`,
      gas: `0x${Number(r.gas).toString(16)}`,
      gasUsed: `0x${Number(r.gas_used).toString(16)}`,
    };
    if (p.length > 0) {
      let up = p.slice(0, -1);
      while (up.length > 0 && !byPos.has(up.join("."))) up = up.slice(0, -1);
      const parent = byPos.get(up.join("."))!;
      (parent.calls ??= []).push(f);
    }
    byPos.set(r.pos, f);
  }

  const call = byPos.get("")!;
  if (!frames[0].r.ok) {
    call.error = "execution reverted";
    const reason = revertReason(call.output);
    if (reason) call.revertReason = reason;
  }

  const logs = rows
    .filter((r) => Number(r.kind) === 1)
    .map((r) => ({ address: `0x${r.src}`, topics: r.output ? r.output.split(",").map((t) => `0x${t}`) : [], data: `0x${r.input}`, logIndex: Number(r.pos) }))
    .sort((a, b) => a.logIndex - b.logIndex);
  return { call, logs };
}

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
