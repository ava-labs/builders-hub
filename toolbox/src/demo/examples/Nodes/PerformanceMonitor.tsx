"use client";

import { useToolboxStore } from "../../utils/store";
import { Input, Button, Select } from "../../ui";
import { useState, useEffect, useRef } from "react";
import { createPublicClient, http, webSocket } from 'viem';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BlockWatcher, BlockInfo } from "./BlockWatcher";
import { ChainInfo } from "./chainInfo";
import { RPCURLInput } from "../../components/RPCURLInput";
// Data structure for bucketed metrics
interface BucketedData {
    transactions: number;
    gasUsed: bigint;
    blockCount: number;
}


export default function PerformanceMonitor() {
    const {
        nodeRpcUrl,
        setNodeRpcUrl,
        chainID,
        setChainID,
        subnetID,
        setSubnetID
    } = useToolboxStore();


    const [evmChainRpcUrl, setEvmChainRpcUrl] = useState('');
    useEffect(() => {
        let newUrl = nodeRpcUrl.replace(/\/$/, '') + '/ext/bc/' + chainID + '/ws'
        if (newUrl.startsWith('http')) {
            newUrl = newUrl.replace(/^http/, 'ws');
        } else if (!newUrl.startsWith('ws')) {
            newUrl = ''
        }
        setEvmChainRpcUrl(newUrl);
    }, [nodeRpcUrl, chainID]);


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
            case "900": // 15 minutes
            case "1800": // 30 minutes
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
            const blockHistoryNum = parseInt(blockHistory);

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
            </div>

            <div className="flex flex-col gap-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RPCURLInput
                        label="RPC URL excluding /ext/bc/..."
                        value={nodeRpcUrl}
                        onChange={setNodeRpcUrl}
                        disabled={isMonitoring}
                    />
                    <Input
                        type="text"
                        label="Chain ID"
                        value={chainID}
                        onChange={setChainID}
                        disabled={isMonitoring}
                    />
                    <Input
                        type="text"
                        label="EVM Chain RPC URL"
                        value={evmChainRpcUrl}
                        disabled={true}
                    />
                    <Input
                        type="text"
                        label="Subnet ID"
                        value={subnetID}
                        onChange={setSubnetID}
                        disabled={isMonitoring}
                    />

                    <Select
                        options={[
                            { value: "60", label: "1 minute (1s buckets)" },
                            { value: "300", label: "5 minutes (1s buckets)" },
                            { value: "900", label: "15 minutes (1m buckets)" },
                            { value: "1800", label: "30 minutes (1m buckets)" },
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
                            { value: "250", label: "250 blocks" },
                            { value: "1000", label: "1,000 blocks" },
                            { value: "2500", label: "2,500 blocks" },
                            { value: "5000", label: "5,000 blocks" },
                            { value: "10000", label: "10,000 blocks" },
                            { value: "25000", label: "25,000 blocks" },
                            { value: "50000", label: "50,000 blocks" },
                            { value: "100000", label: "100,000 blocks" },
                            { value: "250000", label: "250,000 blocks" },
                            { value: "500000", label: "500,000 blocks" },
                            { value: "1000000", label: "1,000,000 blocks" }
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

            <ChainInfo rpcUrl={nodeRpcUrl} subnetID={subnetID} chainID={chainID} />

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

                    <h4 className="font-medium mt-2 mb-2">Gas Usage per Second</h4>
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

                    <h4 className="font-medium mt-2 mb-2">Blocks per Second</h4>
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

                    <h4 className="font-medium mt-2 mb-2">Recent Blocks</h4>
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
