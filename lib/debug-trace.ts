/* The trace configs this site sends to a debug node. The C-Chain and Fuji
   debug nodes are shared and token-authenticated. With no tracer named, a
   node runs the struct logger, which keeps every opcode step in memory (up
   to ~450 MB for one large tx) and has OOM-killed the node. So every
   debug_trace* call names a native tracer and a node-side timeout. */

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

/** the accounts and storage slots the tx changed, before and after */
export function prestateDiff() {
  return { tracer: "prestateTracer", tracerConfig: { diffMode: true }, timeout: TRACE_TIMEOUT };
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
