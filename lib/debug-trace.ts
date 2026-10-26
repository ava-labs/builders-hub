/* The trace configs this site sends to a debug node. The C-Chain and Fuji
   debug nodes are shared and token-authenticated. With no tracer named, a
   node runs the struct logger, which keeps every opcode step in memory (up
   to ~450 MB for one large tx) and has OOM-killed the node. So every
   debug_trace* call names a native tracer, or the one JS tracer below,
   whose memory does not grow with the steps, and a node-side timeout. */

import type { GasProfile } from "@/lib/trace";

/** the node stops a trace after this long. It is coreth's default too; it is
 *  set so a change on the node side cannot make it longer */
export const TRACE_TIMEOUT = "5s";

export interface CallTracerConfig {
  tracer: "callTracer";
  tracerConfig: { withLog: boolean; onlyTopCall: boolean };
  timeout: string;
}

/** the call tree, with each frame's logs when withLog is set */
export function callTracer(opts: { withLog?: boolean; onlyTopCall?: boolean } = {}): CallTracerConfig {
  return {
    tracer: "callTracer",
    tracerConfig: { withLog: opts.withLog === true, onlyTopCall: opts.onlyTopCall === true },
    timeout: TRACE_TIMEOUT,
  };
}

/** the call tree with logs and the state diff from ONE replay of the tx:
 *  the answer is { callTracer, prestateTracer }. If either tracer fails,
 *  the whole call fails */
export function muxTrace() {
  return {
    tracer: "muxTracer",
    tracerConfig: { callTracer: { withLog: true, onlyTopCall: false }, prestateTracer: { diffMode: true } },
    timeout: TRACE_TIMEOUT,
  };
}

/** a client's trace config as a callTracer config, or null when it asks for
 *  another tracer. Only the two callTracer options pass, so a client cannot
 *  set the struct logger, a JS tracer, a timeout or a reexec depth */
export function clientCallTracer(cfg: unknown): CallTracerConfig | null {
  if (!cfg || typeof cfg !== "object") return null;
  const c = cfg as { tracer?: unknown; tracerConfig?: { withLog?: unknown; onlyTopCall?: unknown } };
  if (c.tracer !== "callTracer") return null;
  return callTracer({ withLog: c.tracerConfig?.withLog === true, onlyTopCall: c.tracerConfig?.onlyTopCall === true });
}

/* The gas tracer: what the struct logger gave the Gas tab, with none of its
   memory. It runs in the node's JS engine (goja) at every opcode step and
   keeps a fixed set of numbers: per opcode (at most 256 of them) its step
   count, the gas its steps cost, and its name, read once; the step count;
   and the gas of the first and the last top-level (depth 1) step, with the
   last one's cost. A step adds to these numbers and keeps nothing else.
   `seen` lists the opcodes in the order they first ran, the order the
   struct log had. result() adds what ctx holds of the tx: the gas limit,
   the gas used, the top call's kind, its error and the length of its
   output, and whether the tx was a plain call to an account with no code.
   The names are libevm's JS tracer API (eth/tracers/js/goja.go). */
export const GAS_TRACER = `{
  count: [], cost: [], name: [], seen: [],
  steps: 0, first: -1, last: 0, lastCost: 0,
  step: function (log) {
    var op = log.op.toNumber();
    var cost = log.getCost();
    if (this.count[op] === undefined) {
      this.count[op] = 0;
      this.cost[op] = 0;
      this.name[op] = log.op.toString();
      this.seen.push(op);
    }
    this.count[op]++;
    this.cost[op] += cost;
    this.steps++;
    if (log.getDepth() === 1) {
      var gas = log.getGas();
      if (this.first < 0) this.first = gas;
      this.last = gas;
      this.lastCost = cost;
    }
  },
  fault: function () {},
  result: function (ctx, db) {
    var ops = [];
    for (var i = 0; i < this.seen.length; i++) {
      var op = this.seen[i];
      ops.push({ op: this.name[op], count: this.count[op], gas: this.cost[op] });
    }
    var top = this.first < 0 ? null : { first: this.first, last: this.last, cost: this.lastCost };
    var error = ctx.error || null;
    var plain = !top && ctx.type === "CALL" && !error && !isPrecompiled(ctx.to) && db.getCode(ctx.to).length === 0;
    return {
      limit: ctx.gas, used: ctx.gasUsed, steps: this.steps, ops: ops, top: top,
      create: ctx.type === "CREATE", error: error, out: ctx.output ? ctx.output.length : 0, plain: plain
    };
  }
}`;

/** what GAS_TRACER answers */
export interface GasTracerResult {
  /** the tx gas limit */
  limit: number;
  /** the limit less the gas left at the end: since Helicon, the gas
   *  charged (ACP-194), which can be more than the EVM used */
  used: number;
  steps: number;
  /** per opcode, in the order each first ran */
  ops: { op: string; count: number; gas: number }[];
  /** the first top-level step's gas, and the last one's gas and cost; null
   *  when the tx ran no code */
  top: { first: number; last: number; cost: number } | null;
  /** the tx created a contract */
  create: boolean;
  /** the top call's error: "execution reverted", or a halt such as
   *  "invalid opcode: INVALID" or "out of gas" */
  error: string | null;
  /** the bytes the top call returned: for a creation, the code it stores */
  out: number;
  /** a call that ran no code: no error, to an account with no code that
   *  is not a precompile. A stateful precompile (warp) is missing from
   *  libevm's precompile list, but has code (0x01), so the code check
   *  covers it */
  plain: boolean;
}

/** the gas profile from one replay of the tx (GAS_TRACER) */
export function gasTracer() {
  return { tracer: GAS_TRACER, timeout: TRACE_TIMEOUT };
}

/** what a creation pays per byte of the code it stores */
const CODE_DEPOSIT_GAS = 200;

/** the gas tracer's answer as the tx page reads it: the opcodes by gas,
 *  and gas used split into intrinsic gas and execution (gasSplit) */
export function gasProfile(r: GasTracerResult): GasProfile {
  const opcodes = [...r.ops].sort((a, b) => b.gas - a.gas);
  return { opcodes, steps: r.steps, gas: r.limit ? gasSplit(r) : null };
}

/** Gas used, split by the struct log's rules: the first top-level step
 *  starts with the limit less intrinsic gas, and the last one ends with
 *  what is left. Two costs fall outside the steps, and are added here: the
 *  code a creation stores, and the gas a halt burns (an error other than a
 *  revert takes all the gas left). The EVM's figure (r.used) is the check:
 *  since Helicon it is the gas charged, at least half the limit, so where
 *  it is that floor, gas used can be less. Before Apricot Phase 1 a refund
 *  could make it less. Null where the split cannot be told exactly. */
function gasSplit(r: GasTracerResult): GasProfile["gas"] {
  const { limit } = r;
  const floor = r.used === Math.ceil(limit / 2);
  // a plain call ran no code, so all its gas is intrinsic, and the EVM's
  // figure is it; at the floor that figure is the charge, which says nothing
  // of the access list. Any other call with no step (a precompile, a
  // failure) has gas that no step shows
  if (!r.top) return r.plain && !floor ? { limit, intrinsic: r.used, execution: 0, refund: 0, used: r.used } : null;
  const intrinsic = limit - r.top.first;
  if (r.error && r.error !== "execution reverted") return { limit, intrinsic, execution: r.used - intrinsic, refund: 0, used: r.used };
  const execution = r.top.first - (r.top.last - r.top.cost) + (r.create && !r.error ? CODE_DEPOSIT_GAS * r.out : 0);
  const sum = intrinsic + execution;
  if (r.used <= 0 || r.used === sum || (r.used > sum && floor)) return { limit, intrinsic, execution, refund: 0, used: sum };
  // more than the steps show, and not the floor: the EVM's figure stands
  if (r.used > sum) return { limit, intrinsic, execution: r.used - intrinsic, refund: 0, used: r.used };
  return { limit, intrinsic, execution, refund: sum - r.used, used: r.used };
}
