"use client";

import { useToolboxStore } from "../../utils/store";
import { Input, Button, Select } from "../../ui";
import { useState, useEffect, useRef } from "react";
import { createPublicClient, http, PublicClient, webSocket } from 'viem';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface BlockInfo {
    blockNumber: number;
    transactionCount: number;
    gasUsed: bigint;
    timestamp: number; // Unix timestamp in seconds
}

class BlockWatcher {
    private publicClient: PublicClient;
    private callback: (blockInfo: BlockInfo) => void;
    private isRunning: boolean = false;

    constructor(publicClient: PublicClient, callback: (blockInfo: BlockInfo) => void) {
        this.publicClient = publicClient;
        this.callback = callback;
    }

    async start(startFromBlock: number) {
        if (this.isRunning) return;
        this.isRunning = true;

        let currentBlockNumber = BigInt(startFromBlock);
        console.log('Starting from block', currentBlockNumber);

        while (this.isRunning) {
            try {
                const block = await this.publicClient.getBlock({
                    blockNumber: currentBlockNumber
                });

                // Send block info to callback
                this.callback({
                    blockNumber: Number(currentBlockNumber),
                    transactionCount: block.transactions.length,
                    gasUsed: block.gasUsed,
                    timestamp: Number(block.timestamp)
                });

                // Move to the next block
                currentBlockNumber = currentBlockNumber + 1n;
            } catch (error) {
                if (error instanceof Error &&
                    error.message.includes('cannot query unfinalized data')) {
                    console.log(`Block ${currentBlockNumber} not finalized yet, waiting...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error('Error fetching block:', error);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    stop() {
        this.isRunning = false;
    }
}

export default function PerformanceMonitor() {
    const {
        evmChainRpcUrl,
        setEvmChainRpcUrl,
    } = useToolboxStore();

    const [isMonitoring, setIsMonitoring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [secondsToShow, setSecondsToShow] = useState("60");

    // Store seconds data in a Map for quick lookups and updates
    const [secondsDataMap, setSecondsDataMap] = useState<Map<number, {
        transactions: number;
        gasUsed: bigint;
        blockCount: number;
    }>>(new Map());

    // Derived chart data from the secondsDataMap
    const [chartData, setChartData] = useState<Array<{
        time: string;
        timestamp: number;
        transactions: number;
        gasUsed: number;
        blockCount: number;
    }>>([]);

    // Add this to the component state
    const [recentBlocks, setRecentBlocks] = useState<BlockInfo[]>([]);

    const blockWatcherRef = useRef<BlockWatcher | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Update chart data whenever secondsDataMap changes or once per second
    useEffect(() => {
        if (!isMonitoring) return;

        const updateChartData = () => {
            const now = Math.floor(Date.now() / 1000);
            const maxSecondsToShow = Number(secondsToShow);

            // Create a complete timeline with all seconds
            const timelineStart = now - maxSecondsToShow + 1;
            const completeTimeline: number[] = Array.from(
                { length: maxSecondsToShow },
                (_, i) => timelineStart + i
            );

            const newChartData = completeTimeline.map(timestamp => {
                const data = secondsDataMap.get(timestamp) || {
                    transactions: 0,
                    gasUsed: BigInt(0),
                    blockCount: 0
                };

                return {
                    time: new Date(timestamp * 1000).toLocaleTimeString(),
                    timestamp,
                    transactions: data.transactions,
                    gasUsed: Number(data.gasUsed),
                    blockCount: data.blockCount
                };
            });

            setChartData(newChartData);
        };

        // Initial update
        updateChartData();

        // Set up a timer to update every second
        timerRef.current = setInterval(updateChartData, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isMonitoring, secondsDataMap, secondsToShow]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            if (blockWatcherRef.current) {
                blockWatcherRef.current.stop();
                blockWatcherRef.current = null;
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    async function startMonitoring() {
        try {
            setError(null);
            setIsMonitoring(true);
            setSecondsDataMap(new Map());
            setChartData([]);

            // Create public client
            const publicClient = createPublicClient({
                transport: evmChainRpcUrl.startsWith('http') ? http(evmChainRpcUrl) : webSocket(evmChainRpcUrl),
            });

            // Get the latest block number
            const lastBlock = Number(await publicClient.getBlockNumber());
            const startFromBlock = Math.max(lastBlock - Number(secondsToShow) / 2, 1);

            // Create a new block watcher
            const blockWatcher = new BlockWatcher(publicClient, (blockInfo) => {
                setSecondsDataMap(prevMap => {
                    const newMap = new Map(prevMap);
                    const timestamp = blockInfo.timestamp;

                    // Get existing data for this second or create new entry
                    const existingData = newMap.get(timestamp) || {
                        transactions: 0,
                        gasUsed: BigInt(0),
                        blockCount: 0
                    };

                    // Update the data for this second
                    newMap.set(timestamp, {
                        transactions: existingData.transactions + blockInfo.transactionCount,
                        gasUsed: existingData.gasUsed + blockInfo.gasUsed,
                        blockCount: existingData.blockCount + 1
                    });

                    return newMap;
                });

                // Also update recent blocks
                setRecentBlocks(prevBlocks => {
                    // Add new block to the beginning of the array
                    const newBlocks = [blockInfo, ...prevBlocks];
                    // Keep only the 10 most recent blocks
                    return newBlocks.slice(0, 10);
                });
            });

            blockWatcherRef.current = blockWatcher;
            blockWatcher.start(startFromBlock);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsMonitoring(false);
        }
    }

    function stopMonitoring() {
        if (blockWatcherRef.current) {
            blockWatcherRef.current.stop();
            blockWatcherRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsMonitoring(false);
    }

    return (
        <div>
            <h3 className="text-lg font-semibold mb-2">EVM Chain Performance Monitor</h3>
            <div className="mb-6">
                <p className="mb-2">This tool monitors blockchain performance metrics in real-time, tracking transactions per second, gas usage, and block production. Data is aggregated by second to provide insights into network throughput and activity patterns.</p>
                <div className="mt-4 text-sm text-gray-600">
                    <p>If you don't have a RPC URL, try any of these:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><code>https://api.avax.network/ext/bc/C/rpc</code> (Avalanche C-Chain)</li>
                        <li><code>https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc</code> (DeFi Kingdoms)</li>
                    </ul>
                </div>
            </div>

            <div className="flex flex-col gap-4 mb-4">
                <Input
                    type="text"
                    label="EVM RPC URL"
                    value={evmChainRpcUrl}
                    onChange={setEvmChainRpcUrl}
                    disabled={isMonitoring}
                />
                <Select
                    options={[
                        { value: "60", label: "1 minute" },
                        { value: "180", label: "3 minutes" },
                        { value: "300", label: "5 minutes" },
                        { value: "600", label: "10 minutes" },
                        { value: "1800", label: "30 minutes" },
                        { value: "3600", label: "1 hour" },
                        { value: "7200", label: "2 hours" },
                        { value: "10800", label: "3 hours" },
                        { value: "14400", label: "4 hours" }
                    ]}
                    value={secondsToShow}
                    onChange={(value) => setSecondsToShow(String(value))}
                    label="Time Range"
                />
            </div>

            <div className="flex gap-2.5 mb-6">
                <Button
                    onClick={startMonitoring}
                    type="primary"
                    disabled={!evmChainRpcUrl || isMonitoring}
                >
                    Start Monitoring
                </Button>

                <Button
                    onClick={stopMonitoring}
                    disabled={!isMonitoring}
                >
                    Stop Monitoring
                </Button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {chartData.length > 0 && (
                <div>
                    <h4 className="font-medium mb-2">Transactions Per Second</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="transactions"
                                name="Transactions"
                                stroke="#8884d8"
                                animationDuration={100}
                                dot={false}
                            />
                            <ReferenceLine
                                y={chartData.length > 0
                                    ? chartData.reduce((sum, point) => sum + point.transactions, 0) / chartData.length
                                    : 0}
                                stroke="#2ca02c"
                                strokeDasharray="3 3"
                                label={{
                                    value: chartData.length > 0
                                        ? `Avg: ${(chartData.reduce((sum, point) => sum + point.transactions, 0) / chartData.length).toFixed(1)} TPS`
                                        : "Avg TPS",
                                    fill: "#2ca02c",
                                    position: "insideBottomRight"
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <h4 className="font-medium mt-6 mb-2">Gas Usage Per Second</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis
                                tickFormatter={(value: number) => `${(value / 1_000_000).toFixed(1)}M`}
                            />
                            <Tooltip
                                formatter={(value: number) => [`${(Number(value) / 1_000_000).toFixed(2)}M`, 'Gas']}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="gasUsed"
                                name="Gas Used"
                                stroke="#ff7300"
                                animationDuration={100}
                                dot={false}
                            />
                            <ReferenceLine
                                y={chartData.length > 0
                                    ? chartData.reduce((sum, point) => sum + point.gasUsed, 0) / chartData.length
                                    : 0}
                                stroke="#2ca02c"
                                strokeDasharray="3 3"
                                label={{
                                    value: chartData.length > 0
                                        ? `Avg: ${((chartData.reduce((sum, point) => sum + point.gasUsed, 0) / chartData.length) / 1_000_000).toFixed(2)}M Gas`
                                        : "Avg Gas",
                                    fill: "#2ca02c",
                                    position: "insideBottomRight"
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <h4 className="font-medium mt-6 mb-2">Blocks Per Second</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="blockCount"
                                name="Block Count"
                                stroke="#0088aa"
                                animationDuration={100}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <h4 className="font-medium mt-6 mb-2">Recent Blocks</h4>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200">
                            <thead>
                                <tr>
                                    <th className="py-2 px-4 border-b text-left">Block Number</th>
                                    <th className="py-2 px-4 border-b text-left">Transactions</th>
                                    <th className="py-2 px-4 border-b text-left">Gas Used</th>
                                    <th className="py-2 px-4 border-b text-left">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBlocks.map((block) => (
                                    <tr key={block.blockNumber} className="hover:bg-gray-50">
                                        <td className="py-2 px-4 border-b">{block.blockNumber}</td>
                                        <td className="py-2 px-4 border-b">{block.transactionCount}</td>
                                        <td className="py-2 px-4 border-b">
                                            {(Number(block.gasUsed) / 1_000_000).toFixed(2)}M
                                        </td>
                                        <td className="py-2 px-4 border-b">
                                            {new Date(block.timestamp * 1000).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {recentBlocks.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-4 px-4 text-center text-gray-500">
                                            Waiting for blocks...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
