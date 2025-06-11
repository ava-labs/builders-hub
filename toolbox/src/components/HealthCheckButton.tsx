import { useState } from "react";
import { Button } from "./Button";
import { nipify } from "./HostInput";

interface HealthCheckResult {
    success: boolean;
    response?: any;
    error?: string;
}

interface HealthCheckButtonProps {
    chainId: string;
    domain: string;
}

const checkNodeHealth = async (chainId: string, domain: string): Promise<HealthCheckResult> => {
    const processedDomain = nipify(domain);
    const baseUrl = "https://" + processedDomain;

    // Create AbortController for 1-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    try {
        const response = await fetch(`${baseUrl}/ext/bc/${chainId}/rpc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_chainId",
                params: [],
                id: 1
            }),
            signal: controller.signal,
        });

        // Clear timeout if request completes successfully
        clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        const data = await response.json();

        if (data.error) {
            return {
                success: false,
                error: `RPC Error: ${data.error.message || data.error}`
            };
        }

        return {
            success: true,
            response: data.result
        };
    } catch (error) {
        // Clear timeout in case of error
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
            return {
                success: false,
                error: 'Request timeout (1 second) - node may still be bootstrapping'
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
};

export const HealthCheckButton = ({ chainId, domain }: HealthCheckButtonProps) => {
    const [isChecking, setIsChecking] = useState(false);
    const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);

    const performHealthCheck = async () => {
        setIsChecking(true);
        setHealthCheckResult(null);

        const result = await checkNodeHealth(chainId, domain);
        setHealthCheckResult(result);

        setIsChecking(false);
    };

    const getButtonClassName = () => {
        let baseClasses = "w-auto transition-colors duration-200";

        if (isChecking) {
            return `${baseClasses} opacity-50`;
        }

        if (healthCheckResult) {
            if (healthCheckResult.success) {
                return `${baseClasses} bg-green-600 hover:bg-green-700 text-white border-green-600`;
            } else {
                return `${baseClasses} bg-red-600 hover:bg-red-700 text-white border-red-600`;
            }
        }

        return baseClasses;
    };

    const getSuccessMessage = () => {
        return `✅ RPC endpoint is healthy and responding!`;
    };

    const getErrorMessage = () => {
        return `❌ RPC endpoint not responding (node may still be bootstrapping)`;
    };

    return (
        <div className="mt-6">
            <div className="flex gap-4 items-center">
                <Button
                    onClick={performHealthCheck}
                    disabled={isChecking}
                    className={getButtonClassName()}
                >
                    {isChecking ? 'Checking...' : 'Check Node Health'}
                </Button>

                {healthCheckResult && (
                    <div className={`text-sm font-medium ${healthCheckResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {healthCheckResult.success ? (
                            <span>{getSuccessMessage()}</span>
                        ) : (
                            <span>{getErrorMessage()}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}; 