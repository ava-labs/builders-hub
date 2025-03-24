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

// Data structure for bucketed metrics
interface BucketedData {
    transactions: number;
    gasUsed: bigint;
    blockCount: number;
}

class BlockWatcher {
    private publicClient: PublicClient;
    private callback: (blockInfo: BlockInfo) => void;
    private isRunning: boolean = false;

    constructor(publicClient: PublicClient, callback: (blockInfo: BlockInfo) => void) {
        this.publicClient = publicClient;
        this.callback = callback;
    }

    async start(startFromBlock: number, blockHistory: number) {
        if (this.isRunning) return;
        this.isRunning = true;

        let currentBlockNumber = BigInt(startFromBlock);
        console.log('Starting from block', currentBlockNumber);

        const maxBatchSize = 200;

        // First, fetch historical blocks
        try {
            const latestBlock = await this.publicClient.getBlockNumber();
            const historicalStartBlock = Math.max(
                Number(latestBlock) - blockHistory,
                1
            );

            console.log(`Fetching ${blockHistory} historical blocks from ${historicalStartBlock} to ${latestBlock}`);

            // Process historical blocks in batches
            for (let i = historicalStartBlock; i < Number(latestBlock) && this.isRunning; i += maxBatchSize) {
                const endBlock = Math.min(i + maxBatchSize, Number(latestBlock));
                const blockPromises = [];

                for (let j = i; j < endBlock; j++) {
                    blockPromises.push(this.publicClient.getBlock({
                        blockNumber: BigInt(j)
                    }));
                }

                const blocks = await Promise.all(blockPromises);


                blocks.forEach((block) => {
                    this.callback({
                        blockNumber: Number(block.number),
                        transactionCount: block.transactions.length,
                        gasUsed: block.gasUsed,
                        timestamp: Number(block.timestamp)
                    });
                });

                console.log(`Processed historical blocks ${i} to ${endBlock - 1}`);
            }

            // Set current block number to latest after historical sync
            currentBlockNumber = latestBlock;
            console.log('Historical sync complete, now watching for new blocks');
        } catch (error) {
            console.error('Error fetching historical blocks:', error);
        }

        // Now start monitoring new blocks
        while (this.isRunning) {
            try {
                let lastBlock = await this.publicClient.getBlockNumber()

                while (lastBlock === currentBlockNumber) {
                    console.log('Reached end of chain');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    lastBlock = await this.publicClient.getBlockNumber();
                }

                const endBlock = currentBlockNumber + BigInt(maxBatchSize) < BigInt(lastBlock)
                    ? currentBlockNumber + BigInt(maxBatchSize)
                    : BigInt(lastBlock);

                const blockPromises = [];
                for (let i = currentBlockNumber; i < endBlock; i++) {
                    blockPromises.push(this.publicClient.getBlock({
                        blockNumber: i
                    }));
                }

                const blocks = await Promise.all(blockPromises);

                // Send block info to callback
                blocks.forEach((block, index) => {
                    this.callback({
                        blockNumber: Number(currentBlockNumber) + index,
                        transactionCount: block.transactions.length,
                        gasUsed: block.gasUsed,
                        timestamp: Number(block.timestamp)
                    });
                });

                console.log('Synced blocks', currentBlockNumber, 'to', endBlock);
                currentBlockNumber = endBlock;
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
    const [timeRange, setTimeRange] = useState("60"); // in seconds
    const [blockHistory, setBlockHistory] = useState("100"); // number of blocks to fetch from history

    // Store data in a Map for quick lookups and updates
    const [dataMap, setDataMap] = useState<Map<number, BucketedData>>(new Map());

    // Derived chart data
    const [chartData, setChartData] = useState<Array<{
        time: string;
        timestamp: number;
        transactions: number;
        gasUsed: number;
        blockCount: number;
    }>>([]);

    // Recent blocks
    const [recentBlocks, setRecentBlocks] = useState<BlockInfo[]>([]);

    const blockWatcherRef = useRef<BlockWatcher | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Get bucket resolution based on selected time range
    const getBucketResolution = (): { seconds: number, label: string } => {
        switch (timeRange) {
            case "60": // 1 minute
            case "300": // 5 minutes
                return { seconds: 1, label: "second" };
            case "3600": // 1 hour
            case "10800": // 3 hours
                return { seconds: 60, label: "minute" };
            case "86400": // 24 hours
            case "345600": // 96 hours
                return { seconds: 3600, label: "hour" };
            default:
                return { seconds: 1, label: "second" };
        }
    };

    // Calculate bucket timestamp for a given timestamp
    const getBucketTimestamp = (timestamp: number): number => {
        const { seconds } = getBucketResolution();
        return Math.floor(timestamp / seconds) * seconds;
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp * 1000);
        const { label } = getBucketResolution();

        if (label === "hour") {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (label === "minute") {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    };

    // Update chart data whenever dataMap changes or once per second
    useEffect(() => {
        if (!isMonitoring) return;

        const updateChartData = () => {
            const now = Math.floor(Date.now() / 1000);
            const timeRangeSeconds = Number(timeRange);
            const { seconds: bucketResolution } = getBucketResolution();

            // Adjust to hide the last 5 seconds or equivalent
            const endTime = getBucketTimestamp(now - 5);

            // Calculate number of buckets and create timeline
            const numBuckets = Math.floor(timeRangeSeconds / bucketResolution);
            const timelineStart = endTime - (numBuckets - 1) * bucketResolution;

            const completeTimeline: number[] = Array.from(
                { length: numBuckets },
                (_, i) => timelineStart + i * bucketResolution
            );

            const newChartData = completeTimeline.map(timestamp => {
                const data = dataMap.get(timestamp) || {
                    transactions: 0,
                    gasUsed: BigInt(0),
                    blockCount: 0
                };

                // Convert values to per-second metrics
                const secondsInBucket = bucketResolution;
                const transactionsPerSecond = data.transactions / secondsInBucket;
                const gasUsedPerSecond = Number(data.gasUsed) / secondsInBucket;
                const blocksPerSecond = data.blockCount / secondsInBucket;

                return {
                    time: formatTimestamp(timestamp),
                    timestamp,
                    transactions: transactionsPerSecond,
                    gasUsed: gasUsedPerSecond,
                    blockCount: blocksPerSecond
                };
            });

            setChartData(newChartData);
        };

        // Initial update
        updateChartData();

        // Set up a timer to update regularly
        const updateInterval = getBucketResolution().seconds * 1000 / 2;
        timerRef.current = setInterval(updateChartData, Math.min(updateInterval, 1000));

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isMonitoring, dataMap, timeRange]);

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
            setDataMap(new Map());
            setChartData([]);
            setRecentBlocks([]);

            // Create public client
            const publicClient = createPublicClient({
                transport: evmChainRpcUrl.startsWith('http') ? http(evmChainRpcUrl) : webSocket(evmChainRpcUrl),
            });

            // Get the latest block number
            const lastBlock = Number(await publicClient.getBlockNumber());

            // Convert block history to number
            const blockHistoryNum = parseInt(blockHistory.replace(/k/g, '000').replace(/m/g, '000000'));

            // Start from the latest block minus some offset (to be able to see data immediately)
            const startFromBlock = Math.max(lastBlock - 10, 1);

            // Create a new block watcher
            const blockWatcher = new BlockWatcher(publicClient, (blockInfo) => {
                // Determine which bucket this block belongs to
                const bucketTime = getBucketTimestamp(blockInfo.timestamp);

                setDataMap(prevMap => {
                    const newMap = new Map(prevMap);

                    // Get existing data for this bucket or create new entry
                    const existingData = newMap.get(bucketTime) || {
                        transactions: 0,
                        gasUsed: BigInt(0),
                        blockCount: 0
                    };

                    // Update the data for this bucket
                    newMap.set(bucketTime, {
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
            blockWatcher.start(startFromBlock, blockHistoryNum);
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
                <p className="mb-2">This tool monitors blockchain performance metrics in real-time, tracking transactions, gas usage, and block production. Data is aggregated by time buckets and normalized to per-second values to provide insights into network throughput and activity patterns.</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        options={[
                            { value: "60", label: "1 minute (1s buckets)" },
                            { value: "300", label: "5 minutes (1s buckets)" },
                            { value: "3600", label: "1 hour (1m buckets)" },
                            { value: "10800", label: "3 hours (1m buckets)" },
                            { value: "86400", label: "24 hours (1h buckets)" },
                            { value: "345600", label: "96 hours (1h buckets)" }
                        ]}
                        value={timeRange}
                        onChange={(value) => setTimeRange(String(value))}
                        label="Time Range"
                        disabled={isMonitoring}
                    />

                    <Select
                        options={[
                            { value: "100", label: "100 blocks" },
                            { value: "1k", label: "1,000 blocks" },
                            { value: "10k", label: "10,000 blocks" },
                            { value: "100k", label: "100,000 blocks" },
                            { value: "1m", label: "1,000,000 blocks" }
                        ]}
                        value={blockHistory}
                        onChange={(value) => setBlockHistory(String(value))}
                        label="Historical Blocks"
                        disabled={isMonitoring}
                    />
                </div>
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
                    <h4 className="font-medium mb-2">Transactions per Second</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis
                                tickFormatter={(value: number) => value.toFixed(1)}
                            />
                            <Tooltip
                                formatter={(value: number) => [value.toFixed(1), 'Transactions/sec']}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="transactions"
                                name="Transactions/sec"
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
                                        ? `Avg: ${(chartData.reduce((sum, point) => sum + point.transactions, 0) / chartData.length).toFixed(1)}/sec`
                                        : "Avg",
                                    fill: "#2ca02c",
                                    position: "insideBottomRight"
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <h4 className="font-medium mt-6 mb-2">Gas Usage per Second</h4>
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
                                formatter={(value: number) => [`${(Number(value) / 1_000_000).toFixed(1)}M/sec`, 'Gas']}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="gasUsed"
                                name="Gas Used/sec"
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
                                        ? `Avg: ${((chartData.reduce((sum, point) => sum + point.gasUsed, 0) / chartData.length) / 1_000_000).toFixed(1)}M/sec`
                                        : "Avg",
                                    fill: "#2ca02c",
                                    position: "insideBottomRight"
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <h4 className="font-medium mt-6 mb-2">Blocks per Second</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis
                                tickFormatter={(value: number) => value.toFixed(1)}
                            />
                            <Tooltip
                                formatter={(value: number) => [value.toFixed(1), 'Blocks/sec']}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="blockCount"
                                name="Blocks/sec"
                                stroke="#0088aa"
                                animationDuration={100}
                                dot={false}
                            />
                            <ReferenceLine
                                y={chartData.length > 0
                                    ? chartData.reduce((sum, point) => sum + point.blockCount, 0) / chartData.length
                                    : 0}
                                stroke="#2ca02c"
                                strokeDasharray="3 3"
                                label={{
                                    value: chartData.length > 0
                                        ? `Avg: ${(chartData.reduce((sum, point) => sum + point.blockCount, 0) / chartData.length).toFixed(1)}/sec`
                                        : "Avg",
                                    fill: "#2ca02c",
                                    position: "insideBottomRight"
                                }}
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
                                            {(Number(block.gasUsed) / 1_000_000).toFixed(1)}M
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
