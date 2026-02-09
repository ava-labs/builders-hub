import { CheckResult } from "./types";

export async function runMetricsTest(baseUrl: string): Promise<CheckResult[]> {
    try {
        const response = await fetch(`${baseUrl}/ext/metrics`);
        const text = await response.text();
        const hasMetrics = text.includes("avalanche_") || text.includes("network_") || text.includes("vm_");

        if (hasMetrics) {
            return [{
                method: "GET /ext/metrics",
                expectedValue: "Error (API restricted)",
                actualValue: "Metrics API is publicly accessible",
                status: "error",
            }];
        } else {
            return [{
                method: "GET /ext/metrics",
                expectedValue: "Error (API restricted)",
                actualValue: "Metrics API properly secured",
                status: "ok",
            }];
        }
    } catch (err) {
        return [{
            method: "GET /ext/metrics",
            expectedValue: "Error (API restricted)",
            actualValue: err instanceof Error ? err.message : "Request failed",
            status: "ok",
        }];
    }
}
