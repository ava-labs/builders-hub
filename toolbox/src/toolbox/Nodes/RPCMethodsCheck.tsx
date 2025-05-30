"use client";

import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { createPublicClient, http, formatUnits } from 'viem';
import { useErrorBoundary } from "react-error-boundary";
import { pvm } from '@avalabs/avalanchejs';
import { RPCURLInput } from "../../components/RPCURLInput";
import { useWalletStore } from "../../stores/walletStore";
import { ChevronDown, ChevronUp } from "lucide-react";

type TestResult = Record<string, { passed: boolean, message: string }>;

// Add utility functions at the top level
const formatPChainBalance = (balance: bigint): string => {
    return `${(Number(balance) / 1e9).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 9
    })} AVAX`;
};

const formatEVMBalance = (balance: bigint): string => {
    const formattedBalance = formatUnits(balance, 18);
    return Number(formattedBalance).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 18
    });
};

async function runPChainTests(payload: { evmChainRpcUrl: string, baseURL: string, pChainAddress: string, ethAddress: string }): Promise<TestResult> {
    const pvmApi = new pvm.PVMApi(payload.baseURL);
    const result: TestResult = {};

    try {
        const balanceResponse = await pvmApi.getBalance({ addresses: [payload.pChainAddress] });
        if (typeof balanceResponse.balance !== 'bigint') {
            throw new Error("Balance is not a bigint");
        }
        result["Get Balance"] = {
            passed: true,
            message: formatPChainBalance(balanceResponse.balance)
        };
    } catch (error) {
        console.log('error', error);
        result["Get Balance"] = {
            passed: false,
            message: error instanceof Error ? error.message : "Error getting balance, see console for more details"
        };
    }

    return result;
}

async function runEVMTests(payload: { evmChainRpcUrl: string, baseURL: string, pChainAddress: string, ethAddress: string }): Promise<TestResult> {
    const result: TestResult = {};

    const publicClient = createPublicClient({
        transport: http(payload.evmChainRpcUrl)
    });

    try {
        const balance = await publicClient.getBalance({
            address: payload.ethAddress as `0x${string}`
        });

        result["Get Balance"] = {
            passed: true,
            message: formatEVMBalance(balance)
        };
    } catch (error) {
        console.log('error', error);
        result["Get Balance"] = {
            passed: false,
            message: error instanceof Error ? error.message : "Error getting balance, see console for more details"
        };
    }

    try {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        result["Get latest block"] = { passed: true, message: `Block #${block.number}` };
    } catch (error) {
        console.log('error', error);
        result["Get latest block"] = {
            passed: false,
            message: error instanceof Error ? error.message : "Error getting block, see console for more details"
        };
    }

    // Debug and Trace methods - using fetch as viem doesn't support them
    const debugTraceMethods = [
        { method: 'debug_traceBlockByNumber', params: ['latest'] },
        { method: 'trace_block', params: ['latest'] }
    ];

    for (const dm of debugTraceMethods) {
        try {
            const response = await fetch(payload.evmChainRpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: dm.method,
                    params: dm.params,
                    id: 1
                })
            });

            const data = await response.json();

            result[dm.method] = {
                passed: !!data.error, // Expecting an error as these methods should be disabled
                message: data.error ? `Error expected: ${data.error.message}` : "Warning: Method is accessible"
            };


        } catch (error) {
            result[dm.method] = {
                passed: true, // Network error is also a good sign - method not exposed
                message: `Error expected: ${error instanceof Error ? error.message : 'API access restricted'}`
            };
        }
    }


    return result;
}

async function runAdminTests(baseURL: string): Promise<TestResult> {
    const result: TestResult = {};

    const adminMethods = [
        {
            name: "admin.alias",
            params: {
                alias: "myAlias",
                endpoint: "bc/X"
            }
        },
        {
            name: "admin.aliasChain",
            params: {
                chain: "sV6o671RtkGBcno1FiaDbVcFv2sG5aVXMZYzKdP4VQAWmJQnM",
                alias: "myBlockchainAlias"
            }
        },
        {
            name: "admin.getChainAliases",
            params: {
                chain: "sV6o671RtkGBcno1FiaDbVcFv2sG5aVXMZYzKdP4VQAWmJQnM"
            }
        },
        {
            name: "admin.getLoggerLevel",
            params: {
                loggerName: "C"
            }
        },
        {
            name: "admin.loadVMs",
            params: {}
        },
        {
            name: "admin.lockProfile",
            params: {}
        },
        {
            name: "admin.memoryProfile",
            params: {}
        },
        {
            name: "admin.setLoggerLevel",
            params: {
                loggerName: "C",
                logLevel: "DEBUG",
                displayLevel: "INFO"
            }
        },
        {
            name: "admin.startCPUProfiler",
            params: {}
        },
        {
            name: "admin.stopCPUProfiler",
            params: {}
        }
    ];

    for (const method of adminMethods) {
        try {
            const response = await fetch(`${baseURL}/ext/admin`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: method.name,
                    params: method.params
                })
            });

            const data = await response.json();

            // Any error response means the admin API is secured (which is good)
            result[method.name] = {
                passed: !!data.error,
                message: data.error
                    ? `Error expected: ${data.error.message}`
                    : "Warning: Admin API is accessible"
            };
        } catch (error) {
            // Network errors (CORS, failed to fetch) also indicate the API is secured
            result[method.name] = {
                passed: true,
                message: `Error expected: ${error instanceof Error ? error.message : 'API access restricted'}`
            };
        }
    }

    return result;
}

async function runMetricsTests(baseURL: string): Promise<TestResult> {
    const result: TestResult = {};

    try {
        const response = await fetch(`${baseURL}/ext/metrics`);
        const text = await response.text();

        // Metrics API returns Prometheus formatted text
        // Check if it contains typical Avalanche metrics
        const hasAvalancheMetrics = text.includes('avalanche_') ||
            text.includes('network_') ||
            text.includes('vm_');

        result["metrics"] = {
            passed: !hasAvalancheMetrics, // If we can access metrics, that's a security concern
            message: hasAvalancheMetrics
                ? "Warning: Metrics API is publicly accessible"
                : "Error expected: Metrics API properly secured"
        };
    } catch (error) {
        // Network errors indicate the API is secured (which is good)
        result["metrics"] = {
            passed: true,
            message: `Error expected: ${error instanceof Error ? error.message : 'API access restricted'}`
        };
    }

    return result;
}

const isInExtBcFormat = (rpcUrl: string) => {
    const regex = /^.+\/ext\/bc\/[A-HJ-NP-Za-km-z1-9]+\/rpc$/;
    return regex.test(rpcUrl);
};

export default function RPCMethodsCheck() {
    const [evmChainRpcUrl, setEvmChainRpcUrl] = useState<string>("");
    const { pChainAddress, walletEVMAddress } = useWalletStore();
    const [baseURL, setBaseURL] = useState<string>("https://api.avax-test.network");

    const { showBoundary } = useErrorBoundary();
    const [isChecking, setIsChecking] = useState(false);
    const [testResults, setTestResults] = useState<{
        pChain: TestResult | null,
        evm: TestResult | null,
        admin: TestResult | null,
        metrics: TestResult | null
    }>({ pChain: null, evm: null, admin: null, metrics: null });

    useEffect(() => {
        if (!baseURL && isInExtBcFormat(evmChainRpcUrl)) {
            setBaseURL(evmChainRpcUrl.split("/ext/bc/")[0]);
        }
    }, [evmChainRpcUrl, baseURL]);

    async function checkRpc() {
        setIsChecking(true);
        setTestResults({ pChain: null, evm: null, admin: null, metrics: null });

        try {
            const [pChainResults, evmResults, adminResults, metricsResults] = await Promise.all([
                runPChainTests({
                    evmChainRpcUrl,
                    baseURL: baseURL || evmChainRpcUrl.split("/ext/bc/")[0],
                    pChainAddress,
                    ethAddress: walletEVMAddress,
                }),
                runEVMTests({
                    evmChainRpcUrl,
                    baseURL: baseURL || evmChainRpcUrl.split("/ext/bc/")[0],
                    pChainAddress,
                    ethAddress: walletEVMAddress,
                }),
                runAdminTests(baseURL || evmChainRpcUrl.split("/ext/bc/")[0]),
                runMetricsTests(baseURL || evmChainRpcUrl.split("/ext/bc/")[0])
            ]);

            setTestResults({ pChain: pChainResults, evm: evmResults, admin: adminResults, metrics: metricsResults });
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsChecking(false);
        }
    }

    const TestGroup = ({ title, results, description }: {
        title: string,
        results: TestResult | null,
        description: string
    }) => {
        const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});

        const toggleExpand = (testName: string) => {
            setExpandedTests(prev => ({
                ...prev,
                [testName]: !prev[testName]
            }));
        };

        const shouldShowDropdown = (testName: string) => {
            // Only show direct values for Balance and "Get latest block"
            return !testName.includes('Balance') && testName !== 'Get latest block';
        };

        return (
            <div className="border rounded-lg p-4">
                <div className="mb-2">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                </div>
                {results ? (
                    <div className="space-y-1">
                        {Object.entries(results).map(([testName, result], index, array) => {
                            const isDirectDisplay = !shouldShowDropdown(testName);
                            const nextIsDirectDisplay = index < array.length - 1 && !shouldShowDropdown(array[index + 1][0]);

                            return (
                                <div key={testName} className={`flex flex-col ${(isDirectDisplay || nextIsDirectDisplay) ? 'mb-4' : ''}`}>
                                    {shouldShowDropdown(testName) ? (
                                        // Dropdown layout (original horizontal layout)
                                        <div className="flex items-center justify-between py-1">
                                            <div className="flex items-center space-x-2 min-w-[120px]">
                                                {result.passed ? (
                                                    <div className="flex items-center text-green-600 dark:text-green-500">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-600 dark:text-red-500">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span className="font-medium whitespace-nowrap">{testName}</span>
                                            </div>
                                            {result.message && (
                                                <button
                                                    onClick={() => toggleExpand(testName)}
                                                    className="flex items-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                                >
                                                    {expandedTests[testName] ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        // Direct display layout (new vertical layout)
                                        <div className="flex flex-col space-y-2">
                                            <div className="flex items-center space-x-2">
                                                {result.passed ? (
                                                    <div className="flex items-center text-green-600 dark:text-green-500">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-red-600 dark:text-red-500">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span className="font-medium whitespace-nowrap">{testName}</span>
                                            </div>
                                            {result.message && (
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400 break-all pl-6">
                                                    {result.message}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {shouldShowDropdown(testName) && expandedTests[testName] && result.message && (
                                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 pl-6 break-all">
                                            {result.message}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-zinc-500 dark:text-zinc-400">No results yet</p>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-white dark:bg-zinc-900">
                <h2 className="text-lg font-semibold mb-4">RPC Methods Security Check</h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    This tool helps verify the security configuration of your node's RPC endpoints.
                </p>

                <div className="space-y-4">
                    <RPCURLInput
                        label="EVM Chain RPC URL"
                        value={evmChainRpcUrl}
                        onChange={setEvmChainRpcUrl}
                        placeholder="e.g., http://localhost:9650/ext/bc/C/rpc"
                    />
                    <RPCURLInput
                        label="P-Chain URL"
                        value={baseURL}
                        onChange={setBaseURL}
                        placeholder="e.g., http://localhost:9650"
                    />
                    <Button
                        variant="primary"
                        onClick={checkRpc}
                        loading={isChecking}
                        disabled={!evmChainRpcUrl}
                    >
                        {isChecking ? 'Running Security Checks...' : 'Run Security Check'}
                    </Button>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <h3 className="font-semibold text-blue-800 dark:text-blue-400">Understanding Results</h3>
                <ul className="mt-1 space-y-1 text-blue-700 dark:text-blue-300 ml-4 list-disc">
                    <li>Green checkmark means the endpoint is properly configured</li>
                    <li>Red X indicates a potential security concern</li>
                    <li>For Admin and Debug endpoints, errors indicate proper security, the appropriate errors will return green checkmarks</li>
                </ul>
            </div>

            <div className="space-y-2">
                <TestGroup
                    title="P-Chain API Tests"
                    results={testResults.pChain}
                    description="Verifies basic P-Chain operations like balance queries."
                />
                <TestGroup
                    title="EVM API Tests"
                    results={testResults.evm}
                    description="Checks EVM endpoints and debug/trace method restrictions."
                />
                <TestGroup
                    title="Admin API Security"
                    results={testResults.admin}
                    description="Verifies administrative endpoints are properly secured."
                />
                <TestGroup
                    title="Metrics API Security"
                    results={testResults.metrics}
                    description="Ensures metrics endpoint is properly restricted."
                />
            </div>
        </div>
    );
};
