import { CheckResult } from "./types";
import { rpcCall } from "./utils";

export async function runDebugTests(evmRpcUrl: string): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // debug_traceBlockByNumber - check if enabled
    try {
        const data = await rpcCall(evmRpcUrl, "debug_traceBlockByNumber", ["latest"]);
        if (data.error) {
            results.push({
                method: "debug_traceBlockByNumber",
                expectedValue: "Enabled or disabled",
                actualValue: "Disabled (restricted)",
                status: "ok",
            });
        } else {
            results.push({
                method: "debug_traceBlockByNumber",
                expectedValue: "Enabled or disabled",
                actualValue: "Enabled",
                status: "info",
            });
        }
    } catch (err) {
        results.push({
            method: "debug_traceBlockByNumber",
            expectedValue: "Enabled or disabled",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "ok",
        });
    }

    // trace_block - check if enabled
    try {
        const data = await rpcCall(evmRpcUrl, "trace_block", ["latest"]);
        if (data.error) {
            results.push({
                method: "trace_block",
                expectedValue: "Enabled or disabled",
                actualValue: "Disabled (restricted)",
                status: "ok",
            });
        } else {
            results.push({
                method: "trace_block",
                expectedValue: "Enabled or disabled",
                actualValue: "Enabled",
                status: "info",
            });
        }
    } catch (err) {
        results.push({
            method: "trace_block",
            expectedValue: "Enabled or disabled",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "ok",
        });
    }

    return results;
}
