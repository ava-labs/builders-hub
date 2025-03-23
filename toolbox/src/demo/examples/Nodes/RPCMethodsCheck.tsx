"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "../../ui";
import { createPublicClient, http } from 'viem';
import { useErrorBoundary } from "react-error-boundary";
import { useToolboxStore, useWalletStore } from "../../utils/store";
import { pvm } from '@avalabs/avalanchejs';

type TestResult = Record<string, { passed: boolean, message: string }>;
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
            message: `Balance: ${balanceResponse.balance}`
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
        const balance = await publicClient.getBalance({ address: payload.ethAddress as `0x${string}` });

        result["Get Balance"] = { passed: true, message: `Balance: ${balance}` };
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
    const {
        evmChainRpcUrl,
        setEvmChainRpcUrl
    } = useToolboxStore();
    const { pChainAddress, walletEVMAddress } = useWalletStore();

    const { showBoundary } = useErrorBoundary();
    const [isChecking, setIsChecking] = useState(false);
    const [testResults, setTestResults] = useState<{
        pChain: TestResult | null,
        evm: TestResult | null,
        admin: TestResult | null,
        metrics: TestResult | null
    }>({ pChain: null, evm: null, admin: null, metrics: null });
    const [baseURL, setBaseURL] = useState<string>("");


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

    const TestGroup = ({ title, results }: { title: string, results: TestResult | null }) => (
        <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">{title}</h3>
            {results ? (
                <div className="space-y-2">
                    {Object.entries(results).map(([testName, result]) => (
                        <div key={testName} className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${result.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div>
                                <span>{testName}</span>
                                {result.message && (
                                    <span className="text-sm "> | {result.message.substring(0, 100)}{result.message.length > 100 && '...'}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="">No results yet</p>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">RPC Methods Check</h2>
            <div className="space-y-4">
                <Input
                    label="RPC URL"
                    value={evmChainRpcUrl}
                    onChange={setEvmChainRpcUrl}
                    placeholder="Enter RPC URL"
                />
                <Input
                    label="Base URL to query P Chain, optional"
                    value={baseURL}
                    onChange={setBaseURL}
                />
                <Button
                    type="primary"
                    onClick={checkRpc}
                    loading={isChecking}
                    disabled={!evmChainRpcUrl}
                >
                    Run Tests
                </Button>

                <div className="space-y-4">
                    <TestGroup title="P-Chain" results={testResults.pChain} />
                    <TestGroup title="EVM" results={testResults.evm} />
                    <TestGroup title="Admin API" results={testResults.admin} />
                    <TestGroup title="Metrics API" results={testResults.metrics} />
                </div>
            </div>
        </div>
    );
};
