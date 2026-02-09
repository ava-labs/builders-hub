import { CheckResult } from "./types";

export async function runAdminTests(baseUrl: string): Promise<CheckResult[]> {
    const adminMethods = [
        { name: "admin.alias", params: { alias: "myAlias", endpoint: "bc/X" } },
        { name: "admin.aliasChain", params: { chain: "sV6o671RtkGBcno1FiaDbVcFv2sG5aVXMZYzKdP4VQAWmJQnM", alias: "myBlockchainAlias" } },
        { name: "admin.getChainAliases", params: { chain: "sV6o671RtkGBcno1FiaDbVcFv2sG5aVXMZYzKdP4VQAWmJQnM" } },
        { name: "admin.getLoggerLevel", params: { loggerName: "C" } },
        { name: "admin.loadVMs", params: {} },
        { name: "admin.lockProfile", params: {} },
        { name: "admin.memoryProfile", params: {} },
        { name: "admin.setLoggerLevel", params: { loggerName: "C", logLevel: "DEBUG", displayLevel: "INFO" } },
        { name: "admin.startCPUProfiler", params: {} },
        { name: "admin.stopCPUProfiler", params: {} },
    ];

    const results: CheckResult[] = [];

    for (const method of adminMethods) {
        try {
            const response = await fetch(`${baseUrl}/ext/admin`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method.name, params: method.params }),
            });
            const data = await response.json();

            if (data.error) {
                results.push({
                    method: method.name,
                    expectedValue: "Error (API secured)",
                    actualValue: data.error.message || JSON.stringify(data.error),
                    status: "ok",
                });
            } else {
                results.push({
                    method: method.name,
                    expectedValue: "Error (API secured)",
                    actualValue: "Admin API is accessible",
                    status: "error",
                });
            }
        } catch (err) {
            results.push({
                method: method.name,
                expectedValue: "Error (API secured)",
                actualValue: err instanceof Error ? err.message : "Request failed",
                status: "ok",
            });
        }
    }

    return results;
}
