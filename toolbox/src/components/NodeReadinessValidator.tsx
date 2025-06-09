import { useState } from "react";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { nipify } from "./HostInput";

interface NodeReadinessValidatorProps {
    // Required: parameters to generate the check command
    chainId: string;
    domain: string;

    // Optional: use debug trace instead of basic eth_chainId
    isDebugTrace?: boolean;

    // Optional: show health check button
    showHealthCheck?: boolean;

    // Action button configuration (optional)
    buttonText?: string;
    buttonClassName?: string;
    onAction?: () => void;

    // Immediate action on checkbox change (optional)
    onBootstrapCheckChange?: (checked: boolean) => void;

    // Additional content (like images, etc.)
    children?: React.ReactNode;
}

interface HealthCheckResult {
    success: boolean;
    response?: any;
    error?: string;
}

const generateCheckNodeCommand = (chainId: string, domain: string, isDebugTrace: boolean = false) => {
    const processedDomain = nipify(domain);
    let baseUrl;

    if (processedDomain.startsWith("127.0.0.1")) {
        baseUrl = "http://" + processedDomain;
    } else {
        baseUrl = "https://" + processedDomain;
    }

    const method = isDebugTrace ? "debug_traceBlockByNumber" : "eth_chainId";
    const params = isDebugTrace ? '["latest", {}]' : '[]';

    return `curl -X POST --data '{ 
  "jsonrpc":"2.0", "method":"${method}", "params":${params}, "id":1 
}' -H 'content-type:application/json;' \\
${baseUrl}/ext/bc/${chainId}/rpc`;
};

const checkNodeHealth = async (chainId: string, domain: string, isDebugTrace: boolean = false): Promise<HealthCheckResult> => {
    const processedDomain = nipify(domain);
    let baseUrl;

    if (processedDomain.startsWith("127.0.0.1")) {
        baseUrl = "http://" + processedDomain;
    } else {
        baseUrl = "https://" + processedDomain;
    }

    const method = isDebugTrace ? "debug_traceBlockByNumber" : "eth_chainId";
    const params = isDebugTrace ? ["latest", {}] : [];

    try {
        const response = await fetch(`${baseUrl}/ext/bc/${chainId}/rpc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: method,
                params: params,
                id: 1
            }),
        });

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
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
};

export const NodeReadinessValidator = ({
    chainId,
    domain,
    isDebugTrace = false,
    showHealthCheck = false,
    buttonText,
    buttonClassName = "w-1/3",
    onAction,
    onBootstrapCheckChange,
    children
}: NodeReadinessValidatorProps) => {
    const [bootstrapChecked, setBootstrapChecked] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);
    const [debugHealthResult, setDebugHealthResult] = useState<HealthCheckResult | null>(null);
    const [isCheckingDebug, setIsCheckingDebug] = useState(false);

    const handleButtonClick = () => {
        if (!bootstrapChecked || !onAction) {
            return;
        }
        onAction();
    };

    const handleBootstrapCheckChange = (checked: boolean) => {
        setBootstrapChecked(checked);
        if (onBootstrapCheckChange) {
            onBootstrapCheckChange(checked);
        }
    };

    const performHealthCheck = async () => {
        setIsChecking(true);
        setHealthCheckResult(null);

        const result = await checkNodeHealth(chainId, domain, false);
        setHealthCheckResult(result);

        if (result.success) {
            setBootstrapChecked(true);
            if (onBootstrapCheckChange) {
                onBootstrapCheckChange(true);
            }
        }

        setIsChecking(false);
    };



    const basicCurlCommand = generateCheckNodeCommand(chainId, domain, false);
    const debugCurlCommand = generateCheckNodeCommand(chainId, domain, true);

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div className="space-y-4">
                    <p>
                        {showHealthCheck
                            ? "You can verify that your node is ready by testing the RPC endpoint. During bootstrapping, this will return a 404 error, but once complete it will return a valid response."
                            : "During the bootstrapping process, the following command will return a 404 page not found error:"
                        }
                    </p>

                    <DynamicCodeBlock lang="bash" code={basicCurlCommand} />

                    {showHealthCheck ? (
                        <div className="mt-6">
                            <div className="flex gap-4 items-center">
                                <Button
                                    onClick={performHealthCheck}
                                    disabled={isChecking}
                                    className="w-auto"
                                >
                                    {isChecking ? 'Checking...' : 'Check Node Health'}
                                </Button>

                                {healthCheckResult && (
                                    <div className={`text-sm ${healthCheckResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {healthCheckResult.success ? (
                                            <span>✅ Node is healthy! Response: {JSON.stringify(healthCheckResult.response)}</span>
                                        ) : (
                                            <span>❌ {healthCheckResult.error}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p>
                            Once bootstrapping is complete, it will return a response like <code>{'{"jsonrpc":"2.0","id":1,"result":"..."}'}</code>.
                        </p>
                    )}
                </div>

                <Checkbox
                    label="AvalancheGo node is fully bootstrapped"
                    checked={bootstrapChecked}
                    onChange={handleBootstrapCheckChange}
                />
            </div>

            {bootstrapChecked && isDebugTrace && (
                <div className="space-y-4 mt-6">
                    <h4 className="text-lg font-semibold">Test Debug & Trace</h4>
                    <p>Now that your node is synced, you can test the debug and trace functionality:</p>

                    <DynamicCodeBlock lang="bash" code={debugCurlCommand} />

                    <p>Make sure you make at least one transaction on your chain, or it will error "genesis is untracable".</p>
                </div>
            )}

            {children}

            {buttonText && onAction && (
                <div className="flex justify-center">
                    <Button
                        onClick={handleButtonClick}
                        disabled={!bootstrapChecked}
                        className={buttonClassName}
                    >
                        {buttonText}
                    </Button>
                </div>
            )}
        </div>
    );
}; 