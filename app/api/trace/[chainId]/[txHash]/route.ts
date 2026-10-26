import { getTrace } from "@/lib/trace-node";
import { traceRoute } from "@/lib/trace-route";

// One transaction's execution trace for the tx page (lib/trace-node.ts):
// the call tree and the state diff. A trace without its state diff is
// cached for a few minutes only: a later ask can get the whole trace.
// Crawlers, lanes, caching and the miss codes: lib/trace-route.ts.

export const GET = traceRoute(getTrace, (out) => out.trace, (out) => out.trace.prestate !== null);
