"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPublicClient, http } from 'viem';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Play, Square, Activity, Fuel, Blocks, Clock, AlertCircle } from "lucide-react";
import { BlockWatcher, BlockInfo } from "./BlockWatcher";
import { Button } from "@/components/toolbox/components/Button";
import { RPCURLInput } from "@/components/toolbox/components/RPCURLInput";

interface BucketedData {
    transactions: number;
    gasUsed: bigint;
    blockCount: number;
}

interface ChartDataPoint {
    time: string;
    timestamp: number;
    transactions: number;
    gasUsed: number;
    blockCount: number;
}

const TIME_RANGE_OPTIONS = [
    { value: "60", label: "1 minute" },
    { value: "300", label: "5 minutes" },
    { value: "900", label: "15 minutes" },
    { value: "1800", label: "30 minutes" },
    { value: "3600", label: "1 hour" },
    { value: "10800", label: "3 hours" },
];

const BLOCK_HISTORY_OPTIONS = [
    { value: "100", label: "100 blocks" },
    { value: "500", label: "500 blocks" },
    { value: "1000", label: "1,000 blocks" },
    { value: "5000", label: "5,000 blocks" },
    { value: "10000", label: "10,000 blocks" },
];

export default function PerformanceMonitor() {
    const [rpcUrl, setRpcUrl] = useState('');
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState("60");
    const [blockHistory, setBlockHistory] = useState("100");

    const [dataMap, setDataMap] = useState<Map<number, BucketedData>>(new Map());
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [recentBlocks, setRecentBlocks] = useState<BlockInfo[]>([]);
    const [gasLimit, setGasLimit] = useState<number | null>(null);

    const blockWatcherRef = useRef<BlockWatcher | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Get bucket resolution based on selected time range
    const getBucketResolution = useCallback((): { seconds: number, label: string } => {
        switch (timeRange) {
            case "60":
            case "300":
                return { seconds: 1, label: "second" };
            case "900":
            case "1800":
            case "3600":
            case "10800":
                return { seconds: 60, label: "minute" };
            default:
                return { seconds: 1, label: "second" };
        }
    }, [timeRange]);

    const getBucketTimestamp = useCallback((timestamp: number): number => {
        const { seconds } = getBucketResolution();
        return Math.floor(timestamp / seconds) * seconds;
    }, [getBucketResolution]);

    const formatTimestamp = useCallback((timestamp: number): string => {
        const date = new Date(timestamp * 1000);
        const { label } = getBucketResolution();

        if (label === "minute") {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }, [getBucketResolution]);

    // Update chart data
    useEffect(() => {
        if (!isMonitoring) return;

        const updateChartData = () => {
            const now = Math.floor(Date.now() / 1000);
            const timeRangeSeconds = Number(timeRange);
            const { seconds: bucketResolution } = getBucketResolution();

            const endTime = getBucketTimestamp(now - 5);
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

        updateChartData();

        const updateInterval = getBucketResolution().seconds * 1000 / 2;
        timerRef.current = setInterval(updateChartData, Math.min(updateInterval, 1000));

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isMonitoring, dataMap, timeRange, getBucketResolution, getBucketTimestamp, formatTimestamp]);

    // Cleanup on unmount
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
        if (!rpcUrl) {
            setError("Please enter an RPC URL");
            return;
        }

        try {
            setError(null);
            setIsMonitoring(true);
            setDataMap(new Map());
            setChartData([]);
            setRecentBlocks([]);
            setGasLimit(null);

            const publicClient = createPublicClient({
                transport: http(rpcUrl),
            });

            // Test connection and get gas limit from latest block
            const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
            setGasLimit(Number(latestBlock.gasLimit));

            const lastBlock = Number(latestBlock.number);
            const blockHistoryNum = parseInt(blockHistory);
            const startFromBlock = Math.max(lastBlock - 10, 1);

            const blockWatcher = new BlockWatcher(publicClient, (blockInfo) => {
                const bucketTime = getBucketTimestamp(blockInfo.timestamp);

                setDataMap(prevMap => {
                    const newMap = new Map(prevMap);
                    const existingData = newMap.get(bucketTime) || {
                        transactions: 0,
                        gasUsed: BigInt(0),
                        blockCount: 0
                    };

                    newMap.set(bucketTime, {
                        transactions: existingData.transactions + blockInfo.transactionCount,
                        gasUsed: existingData.gasUsed + blockInfo.gasUsed,
                        blockCount: existingData.blockCount + 1
                    });

                    return newMap;
                });

                setRecentBlocks(prevBlocks => {
                    const newBlocks = [blockInfo, ...prevBlocks];
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

    const avgTransactions = chartData.length > 0
        ? chartData.reduce((sum, point) => sum + point.transactions, 0) / chartData.length
        : 0;
    const avgGas = chartData.length > 0
        ? chartData.reduce((sum, point) => sum + point.gasUsed, 0) / chartData.length
        : 0;
    const avgBlocks = chartData.length > 0
        ? chartData.reduce((sum, point) => sum + point.blockCount, 0) / chartData.length
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    EVM Chain Performance Monitor
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Monitor blockchain performance metrics in real-time. Enter any EVM RPC URL to start.
                </p>
            </div>

            {/* Configuration */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                        <RPCURLInput
                            label="EVM RPC URL"
                            value={rpcUrl}
                            onChange={setRpcUrl}
                            disabled={isMonitoring}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Time Range
                        </label>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            disabled={isMonitoring}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {TIME_RANGE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Historical Blocks
                        </label>
                        <select
                            value={blockHistory}
                            onChange={(e) => setBlockHistory(e.target.value)}
                            disabled={isMonitoring}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {BLOCK_HISTORY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Control Buttons */}
                <div className="flex gap-3 pt-2">
                    <Button
                        onClick={startMonitoring}
                        disabled={!rpcUrl || isMonitoring}
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Start Monitoring
                    </Button>
                    <Button
                        onClick={stopMonitoring}
                        disabled={!isMonitoring}
                        variant="secondary"
                    >
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                    </Button>
                </div>
            </div>

            {/* Chain Info */}
            {gasLimit && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm">
                        <Fuel className="h-4 w-4 text-zinc-500" />
                        <span className="text-zinc-600 dark:text-zinc-300">
                            Gas Limit: <strong>{(gasLimit / 1_000_000).toFixed(1)}M</strong> per block
                        </span>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-700 dark:text-red-300">
                            <strong>Error:</strong> {error}
                        </div>
                    </div>
                </div>
            )}

            {/* Charts */}
            {chartData.length > 0 && (
                <div className="space-y-6">
                    {/* Transactions Per Second Chart */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-purple-500" />
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Transactions per Second</h3>
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                Avg: <span className="text-purple-500 font-medium">{avgTransactions.toFixed(2)} TPS</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 11, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tickFormatter={(value: number) => value.toFixed(1)}
                                    tick={{ fontSize: 11, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                    width={50}
                                />
                                <Tooltip
                                    formatter={(value: number) => [value.toFixed(2), 'TPS']}
                                    contentStyle={{
                                        backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                        border: '1px solid rgba(63, 63, 70, 0.5)',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    }}
                                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                    itemStyle={{ color: '#e4e4e7' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="transactions"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    fill="url(#tpsGradient)"
                                    isAnimationActive={false}
                                />
                                <ReferenceLine
                                    y={avgTransactions}
                                    stroke="#22c55e"
                                    strokeDasharray="5 5"
                                    strokeOpacity={0.7}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Gas Usage Chart */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Fuel className="h-5 w-5 text-orange-500" />
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Gas Usage per Second</h3>
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                Avg: <span className="text-orange-500 font-medium">{(avgGas / 1_000_000).toFixed(2)}M</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 11, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tickFormatter={(value: number) => `${(value / 1_000_000).toFixed(1)}M`}
                                    tick={{ fontSize: 11, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                    width={50}
                                />
                                <Tooltip
                                    formatter={(value: number) => [`${(value / 1_000_000).toFixed(2)}M`, 'Gas/sec']}
                                    contentStyle={{
                                        backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                        border: '1px solid rgba(63, 63, 70, 0.5)',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    }}
                                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                    itemStyle={{ color: '#e4e4e7' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="gasUsed"
                                    stroke="#f97316"
                                    strokeWidth={2}
                                    fill="url(#gasGradient)"
                                    isAnimationActive={false}
                                />
                                <ReferenceLine
                                    y={avgGas}
                                    stroke="#22c55e"
                                    strokeDasharray="5 5"
                                    strokeOpacity={0.7}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Blocks Per Second Chart */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Blocks className="h-5 w-5 text-cyan-500" />
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Blocks per Second</h3>
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                Avg: <span className="text-cyan-500 font-medium">{avgBlocks.toFixed(2)}</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="blocksGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 11, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tickFormatter={(value: number) => value.toFixed(2)}
                                    tick={{ fontSize: 11, fill: '#71717a' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dx={-10}
                                    width={50}
                                />
                                <Tooltip
                                    formatter={(value: number) => [value.toFixed(2), 'Blocks/sec']}
                                    contentStyle={{
                                        backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                        border: '1px solid rgba(63, 63, 70, 0.5)',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    }}
                                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                                    itemStyle={{ color: '#e4e4e7' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="blockCount"
                                    stroke="#06b6d4"
                                    strokeWidth={2}
                                    fill="url(#blocksGradient)"
                                    isAnimationActive={false}
                                />
                                <ReferenceLine
                                    y={avgBlocks}
                                    stroke="#22c55e"
                                    strokeDasharray="5 5"
                                    strokeOpacity={0.7}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Recent Blocks Table */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-zinc-500" />
                                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Recent Blocks</h3>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-900/30">
                                        <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Block</th>
                                        <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Txs</th>
                                        <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Gas Used</th>
                                        <th className="py-3 px-4 text-left font-medium text-zinc-600 dark:text-zinc-400">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentBlocks.map((block) => (
                                        <tr key={block.blockNumber} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                                            <td className="py-3 px-4 font-mono text-zinc-900 dark:text-zinc-100">{block.blockNumber.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">{block.transactionCount}</td>
                                            <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">{(Number(block.gasUsed) / 1_000_000).toFixed(2)}M</td>
                                            <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">{new Date(block.timestamp * 1000).toLocaleTimeString()}</td>
                                        </tr>
                                    ))}
                                    {recentBlocks.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                                                Waiting for blocks...
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isMonitoring && chartData.length === 0 && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
                    <Activity className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Ready to Monitor
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                        Enter any EVM RPC URL (e.g., https://api.avax.network/ext/bc/C/rpc) and click "Start Monitoring" to track real-time performance.
                    </p>
                </div>
            )}
        </div>
    );
}
