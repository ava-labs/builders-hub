import { getGasProfile } from "@/lib/trace-node";
import { traceRoute } from "@/lib/trace-route";

// One transaction's gas profile for the tx page's Gas tab and Gas Charged
// box (lib/trace-node.ts): gas by opcode, the opcodes executed, and gas used
// split into intrinsic gas and execution. The page asks for it apart from
// the trace (components/explorer-v2/evm/useGasProfile.ts). Crawlers, lanes,
// caching and the miss codes: lib/trace-route.ts.

export const GET = traceRoute(getGasProfile, (out) => out.profile);
