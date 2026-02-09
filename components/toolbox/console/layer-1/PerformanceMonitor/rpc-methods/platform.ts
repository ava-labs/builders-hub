import { CheckResult } from "./types";
import { rpcCall } from "./utils";

export async function runPChainTests(baseUrl: string): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const pchainUrl = `${baseUrl}/ext/bc/P`;

    // platform.getHeight
    try {
        const data = await rpcCall(pchainUrl, "platform.getHeight");
        if (data.result && typeof data.result === "object" && "height" in data.result) {
            results.push({
                method: "platform.getHeight",
                expectedValue: "Returns current P-Chain height",
                actualValue: `Height: ${(data.result as { height: string }).height}`,
                status: "ok",
            });
        } else if (data.error) {
            results.push({
                method: "platform.getHeight",
                expectedValue: "Returns current P-Chain height",
                actualValue: data.error.message || "P-Chain not accessible",
                status: "error",
            });
        } else {
            results.push({
                method: "platform.getHeight",
                expectedValue: "Returns current P-Chain height",
                actualValue: "No result returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "platform.getHeight",
            expectedValue: "Returns current P-Chain height",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    // platform.getBlockchains
    try {
        const data = await rpcCall(pchainUrl, "platform.getBlockchains");
        if (data.result && typeof data.result === "object" && "blockchains" in data.result) {
            const blockchains = (data.result as { blockchains: unknown[] }).blockchains;
            results.push({
                method: "platform.getBlockchains",
                expectedValue: "Returns list of blockchains",
                actualValue: `${blockchains.length} blockchain(s) found`,
                status: "ok",
            });
        } else if (data.error) {
            results.push({
                method: "platform.getBlockchains",
                expectedValue: "Returns list of blockchains",
                actualValue: data.error.message || "Failed to get blockchains",
                status: "error",
            });
        } else {
            results.push({
                method: "platform.getBlockchains",
                expectedValue: "Returns list of blockchains",
                actualValue: "No result returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "platform.getBlockchains",
            expectedValue: "Returns list of blockchains",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    // platform.getSubnets (now L1s)
    try {
        const data = await rpcCall(pchainUrl, "platform.getSubnets", {});
        if (data.result && typeof data.result === "object" && "subnets" in data.result) {
            const subnets = (data.result as { subnets: unknown[] }).subnets;
            results.push({
                method: "platform.getSubnets",
                expectedValue: "Returns list of L1s/Subnets",
                actualValue: `${subnets.length} L1(s) found`,
                status: "ok",
            });
        } else if (data.error) {
            results.push({
                method: "platform.getSubnets",
                expectedValue: "Returns list of L1s/Subnets",
                actualValue: data.error.message || "Failed to get subnets",
                status: "error",
            });
        } else {
            results.push({
                method: "platform.getSubnets",
                expectedValue: "Returns list of L1s/Subnets",
                actualValue: "No result returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "platform.getSubnets",
            expectedValue: "Returns list of L1s/Subnets",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    // platform.getCurrentValidators (Primary Network)
    try {
        const data = await rpcCall(pchainUrl, "platform.getCurrentValidators", { subnetID: null });
        if (data.result && typeof data.result === "object" && "validators" in data.result) {
            const validators = (data.result as { validators: unknown[] }).validators;
            results.push({
                method: "platform.getCurrentValidators",
                expectedValue: "Returns Primary Network validators",
                actualValue: `${validators.length} validator(s) active`,
                status: "ok",
            });
        } else if (data.error) {
            results.push({
                method: "platform.getCurrentValidators",
                expectedValue: "Returns Primary Network validators",
                actualValue: data.error.message || "Failed to get validators",
                status: "error",
            });
        } else {
            results.push({
                method: "platform.getCurrentValidators",
                expectedValue: "Returns Primary Network validators",
                actualValue: "No result returned",
                status: "error",
            });
        }
    } catch (err) {
        results.push({
            method: "platform.getCurrentValidators",
            expectedValue: "Returns Primary Network validators",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "error",
        });
    }

    return results;
}
