import { CheckResult } from "./types";
import { rpcCall } from "./utils";

export async function runEVMTests(evmRpcUrl: string): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // eth_chainId
    try {
        const data = await rpcCall(evmRpcUrl, "eth_chainId");
        if (data.result) {
            results.push({
                method: "eth_chainId",
                expectedValue: "Returns chain ID (hex)",
                actualValue: String(data.result),
                status: "ok",
            });
        } else {
            results.push({
                method: "eth_chainId",
                expectedValue: "Returns chain ID (hex)",
                actualValue: data.error?.message || "No result returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "eth_chainId",
            expectedValue: "Returns chain ID (hex)",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    // eth_blockNumber
    try {
        const data = await rpcCall(evmRpcUrl, "eth_blockNumber");
        if (data.result) {
            results.push({
                method: "eth_blockNumber",
                expectedValue: "Returns latest block number (hex)",
                actualValue: String(data.result),
                status: "ok",
            });
        } else {
            results.push({
                method: "eth_blockNumber",
                expectedValue: "Returns latest block number (hex)",
                actualValue: data.error?.message || "No result returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "eth_blockNumber",
            expectedValue: "Returns latest block number (hex)",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    // eth_getBlockByNumber
    try {
        const data = await rpcCall(evmRpcUrl, "eth_getBlockByNumber", ["latest", false]);
        if (data.result && typeof data.result === "object" && "number" in data.result) {
            const blockNum = Number(BigInt((data.result as { number: string }).number));
            results.push({
                method: "eth_getBlockByNumber",
                expectedValue: "Returns block object",
                actualValue: `Block #${blockNum}`,
                status: "ok",
            });
        } else {
            results.push({
                method: "eth_getBlockByNumber",
                expectedValue: "Returns block object",
                actualValue: data.error?.message || "No block returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "eth_getBlockByNumber",
            expectedValue: "Returns block object",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    return results;
}
