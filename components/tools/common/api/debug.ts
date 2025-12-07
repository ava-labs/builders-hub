import { decodeErrorResult } from "viem";
import { Abi } from "viem";

const debugTraceAndDecode = async (txHash: string, rpcUrl: string, abi: Abi): Promise<string> => {
  try {
    const traceResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "debug_traceTransaction",
        params: [txHash, { tracer: "callTracer" }],
        id: 1,
      }),
    });

    const trace = await traceResponse.json();

    // The error selector is in the output field
    const errorSelector = trace.result.output;
    if (errorSelector && errorSelector.startsWith("0x")) {
      try {
        const errorResult = decodeErrorResult({
          abi,
          data: errorSelector,
        });
        return `${errorResult.errorName}${errorResult.args ? ": " + errorResult.args.join(", ") : ""}`;
      } catch (e) {
        return `Unknown error selector: ${errorSelector}`;
      }
    }
    return "No error selector found in trace";
  } catch (error: any) {
    return error.message || "Failed to get revert reason";
  }
};

export { debugTraceAndDecode };
