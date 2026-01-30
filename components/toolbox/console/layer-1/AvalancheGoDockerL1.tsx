"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Container } from "../../components/Container";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import InputSubnetId from "../../components/InputSubnetId";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Button } from "../../components/Button";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { SyntaxHighlightedJSON } from "../../components/genesis/SyntaxHighlightedJSON";
import { ReverseProxySetup } from "../../components/ReverseProxySetup";
import { GenesisHighlightProvider, useGenesisHighlight } from "../../components/genesis/GenesisHighlightContext";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { generateChainConfig, generateDockerCommand, generateConfigFileCommand } from "./node-config";
import { useNodeConfigHighlighting } from "./useNodeConfigHighlighting";
import { DockerInstallation } from "../../components/DockerInstallation";
import { NetworkingGuide } from "@/components/console/networking-guide";
import { Check, ChevronDown, AlertCircle } from "lucide-react";

function AvalanchegoDockerInner() {
    const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [nodeType, setNodeType] = useState<"validator" | "public-rpc" | "validator-rpc">("validator");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [adminApiEnabled, setAdminApiEnabled] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [logLevel, setLogLevel] = useState<string>("info");
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [selectedRPCBlockchainId, setSelectedRPCBlockchainId] = useState<string>("");
    const [minDelayTarget, setMinDelayTarget] = useState<number>(500);
    const [configJson, setConfigJson] = useState<string>("");

    // Advanced cache settings
    const [trieCleanCache, setTrieCleanCache] = useState<number>(512);
    const [trieDirtyCache, setTrieDirtyCache] = useState<number>(512);
    const [trieDirtyCommitTarget, setTrieDirtyCommitTarget] = useState<number>(20);
    const [triePrefetcherParallelism, setTriePrefetcherParallelism] = useState<number>(16);
    const [snapshotCache, setSnapshotCache] = useState<number>(256);
    const [commitInterval, setCommitInterval] = useState<number>(4096);
    const [stateSyncServerTrieCache, setStateSyncServerTrieCache] = useState<number>(64);

    // API settings
    const [rpcGasCap, setRpcGasCap] = useState<number>(50000000);
    const [rpcTxFeeCap, setRpcTxFeeCap] = useState<number>(100);
    const [apiMaxBlocksPerRequest, setApiMaxBlocksPerRequest] = useState<number>(0);
    const [allowUnfinalizedQueries, setAllowUnfinalizedQueries] = useState<boolean>(false);
    const [batchRequestLimit, setBatchRequestLimit] = useState<number>(0); // 0 = no limit (default)
    const [batchResponseMaxSize, setBatchResponseMaxSize] = useState<number>(25000000);

    // State and history
    const [acceptedCacheSize, setAcceptedCacheSize] = useState<number>(32);
    const [transactionHistory, setTransactionHistory] = useState<number>(0);
    const [stateSyncEnabled, setStateSyncEnabled] = useState<boolean>(true);
    const [skipTxIndexing, setSkipTxIndexing] = useState<boolean>(false);

    // Transaction settings
    const [preimagesEnabled, setPreimagesEnabled] = useState<boolean>(false);
    const [localTxsEnabled, setLocalTxsEnabled] = useState<boolean>(false);

    // Gossip settings (validator specific)
    const [pushGossipNumValidators, setPushGossipNumValidators] = useState<number>(100);
    const [pushGossipPercentStake, setPushGossipPercentStake] = useState<number>(0.9);

    // Profiling
    const [continuousProfilerDir, setContinuousProfilerDir] = useState<string>("");
    const [continuousProfilerFrequency, setContinuousProfilerFrequency] = useState<string>("15m");

    // Show advanced settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

    // Network detection from subnet lookup (independent of wallet connection)
    const [detectedIsTestnet, setDetectedIsTestnet] = useState<boolean | null>(null);

    const { avalancheNetworkID } = useWalletStore();

    // Use detected network from subnet lookup, fallback to wallet network
    const effectiveNetworkID = detectedIsTestnet !== null
        ? (detectedIsTestnet ? 5 : 1)  // Fuji = 5, Mainnet = 1
        : avalancheNetworkID;

    const isRPC = nodeType === "public-rpc" || nodeType === "validator-rpc";
    const isValidator = nodeType === "validator" || nodeType === "validator-rpc";

    // Get highlighted lines for JSON preview
    const highlightedLines = useNodeConfigHighlighting(highlightPath, configJson);

    // Generate Subnet-EVM chain configuration JSON when parameters change
    // Note: Config generation doesn't require L1 selection - it's based on node settings only
    useEffect(() => {
        try {
            const config = generateChainConfig(
                nodeType,
                enableDebugTrace,
                adminApiEnabled,
                pruningEnabled,
                logLevel,
                minDelayTarget,
                trieCleanCache,
                trieDirtyCache,
                trieDirtyCommitTarget,
                triePrefetcherParallelism,
                snapshotCache,
                commitInterval,
                stateSyncServerTrieCache,
                rpcGasCap,
                rpcTxFeeCap,
                apiMaxBlocksPerRequest,
                allowUnfinalizedQueries,
                batchRequestLimit,
                batchResponseMaxSize,
                acceptedCacheSize,
                transactionHistory,
                stateSyncEnabled,
                skipTxIndexing,
                preimagesEnabled,
                localTxsEnabled,
                pushGossipNumValidators,
                pushGossipPercentStake,
                continuousProfilerDir,
                continuousProfilerFrequency
            );
            setConfigJson(JSON.stringify(config, null, 2));
        } catch (error) {
            setConfigJson(`Error: ${(error as Error).message}`);
        }
    }, [nodeType, enableDebugTrace, adminApiEnabled, pruningEnabled, logLevel, minDelayTarget, trieCleanCache, trieDirtyCache, trieDirtyCommitTarget, triePrefetcherParallelism, snapshotCache, commitInterval, stateSyncServerTrieCache, rpcGasCap, rpcTxFeeCap, apiMaxBlocksPerRequest, allowUnfinalizedQueries, batchRequestLimit, batchResponseMaxSize, acceptedCacheSize, transactionHistory, stateSyncEnabled, skipTxIndexing, preimagesEnabled, localTxsEnabled, pushGossipNumValidators, pushGossipPercentStake, continuousProfilerDir, continuousProfilerFrequency]);

    useEffect(() => {
        if (nodeType === "validator") {
            // Validator node defaults - optimized for block production
            setDomain("");
            setEnableDebugTrace(false);
            setAdminApiEnabled(false);
            setPruningEnabled(true);
            setLogLevel("info");
            setMinDelayTarget(500); // Default block time for L1
            setAllowUnfinalizedQueries(false);
            setStateSyncEnabled(true); // Validators benefit from fast sync
            // Standard cache sizes for validators
            setTrieCleanCache(512);
            setTrieDirtyCache(512);
            setSnapshotCache(256);
            setAcceptedCacheSize(32);
            setTransactionHistory(0); // Keep all tx history by default
        } else if (nodeType === "public-rpc") {
            // RPC node defaults - optimized for query performance
            setPruningEnabled(false); // RPC nodes typically need full history
            setLogLevel("info");
            setAllowUnfinalizedQueries(false); // Default to finalized queries for safety
            setStateSyncEnabled(false); // RPC nodes need full historical data
            // Larger caches for better RPC performance
            setTrieCleanCache(1024); // 2x for better read performance
            setTrieDirtyCache(1024);
            setSnapshotCache(512); // 2x for snapshot queries
            setAcceptedCacheSize(64); // Larger for more recent history
            setTransactionHistory(0); // Keep all tx history by default for getLogs
        } else if (nodeType === "validator-rpc") {
            // Combined Validator + RPC node defaults (TESTNET ONLY)
            // Combines validator gossip settings with RPC query capabilities
            setPruningEnabled(false); // Need full history for RPC queries
            setLogLevel("info");
            setMinDelayTarget(500); // Block production timing
            setAllowUnfinalizedQueries(false); // Default to finalized queries for safety
            setStateSyncEnabled(false); // Need full historical data for RPC queries
            // Larger caches for RPC performance while validating
            setTrieCleanCache(1024);
            setTrieDirtyCache(1024);
            setSnapshotCache(512);
            setAcceptedCacheSize(64);
            setTransactionHistory(0); // Keep all tx history
        }
    }, [nodeType]);

    useEffect(() => {
        setSubnetIdError(null);
        setChainId("");
        setSubnet(null);
        setBlockchainInfo(null);
        setDetectedIsTestnet(null);
        if (!subnetId) return;

        // Use AbortController to cancel previous requests
        const abortController = new AbortController();

        setIsLoading(true);

        const loadSubnetData = async () => {
            try {
                const subnetInfo = await getSubnetInfo(subnetId, abortController.signal);

                // Check if this request was cancelled
                if (abortController.signal.aborted) return;

                setSubnet(subnetInfo);
                // Store which network this subnet was found on
                setDetectedIsTestnet(subnetInfo.isTestnet);

                // Always get blockchain info for the first blockchain (for Docker command generation)
                if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
                    const blockchainId = subnetInfo.blockchains[0].blockchainId;
                    setChainId(blockchainId);
                    setSelectedRPCBlockchainId(blockchainId); // Auto-select first blockchain for RPC

                    try {
                        const chainInfo = await getBlockchainInfo(blockchainId, abortController.signal);

                        // Check if this request was cancelled
                        if (abortController.signal.aborted) return;

                        setBlockchainInfo(chainInfo);
                    } catch (error) {
                        if (!abortController.signal.aborted) {
                            setSubnetIdError((error as Error).message);
                        }
                    }
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    setSubnetIdError((error as Error).message);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadSubnetData();

        // Cleanup function to abort the request if component unmounts or subnetId changes
        return () => {
            abortController.abort();
        };
    }, [subnetId]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);

    const handleReset = () => {
        setChainId("");
        setSubnetId("");
        setSubnet(null);
        setBlockchainInfo(null);
        setDetectedIsTestnet(null);
        setNodeType("validator");
        setDomain("");
        setEnableDebugTrace(false);
        setAdminApiEnabled(false);
        setPruningEnabled(true);
        setLogLevel("info");
        setSubnetIdError(null);
        setSelectedRPCBlockchainId("");
        setMinDelayTarget(500);
        setConfigJson("");
        setTrieCleanCache(512);
        setTrieDirtyCache(512);
        setTrieDirtyCommitTarget(20);
        setTriePrefetcherParallelism(16);
        setSnapshotCache(256);
        setCommitInterval(4096);
        setStateSyncServerTrieCache(64);
        setRpcGasCap(50000000);
        setRpcTxFeeCap(100);
        setApiMaxBlocksPerRequest(0);
        setAllowUnfinalizedQueries(false);
        setBatchRequestLimit(0);
        setBatchResponseMaxSize(25000000);
        setAcceptedCacheSize(32);
        setTransactionHistory(0);
        setStateSyncEnabled(true);
        setSkipTxIndexing(false);
        setPreimagesEnabled(false);
        setLocalTxsEnabled(false);
        setPushGossipNumValidators(100);
        setPushGossipPercentStake(0.9);
        setContinuousProfilerDir("");
        setContinuousProfilerFrequency("15m");
        setShowAdvancedSettings(false);
    };

    // Check if this blockchain uses a custom VM
    const isCustomVM = blockchainInfo && blockchainInfo.vmId !== SUBNET_EVM_VM_ID;

    return (
        <Container
            title="L1 Node Setup with Docker"
            description="Configure your node settings, select your L1, and run Docker to start your node."
            githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/AvalancheGoDockerL1.tsx"
        >
            <Steps>
                <Step>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Configure Node Settings</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                        Choose your node type and configure settings. The configuration preview updates in real-time.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                Node Type
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setNodeType("validator")}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                        nodeType === "validator"
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                    }`}
                                >
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Validator</div>
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Port 9651 (P2P)</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNodeType("public-rpc")}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                        nodeType === "public-rpc"
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                    }`}
                                >
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">RPC Node</div>
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Port 9650 (HTTP)</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNodeType("validator-rpc")}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                        nodeType === "validator-rpc"
                                            ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                    }`}
                                >
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Both</div>
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Ports 9650 + 9651</div>
                                </button>
                            </div>
                            {nodeType === "validator-rpc" && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Not recommended for production. Combines validator and RPC for testnet convenience.
                                </p>
                            )}
                        </div>

                        <div onMouseEnter={() => setHighlightPath('logLevel')} onMouseLeave={clearHighlight}>
                            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                Log Level
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { value: "error", label: "Error" },
                                    { value: "warn", label: "Warn" },
                                    { value: "info", label: "Info", default: true },
                                    { value: "debug", label: "Debug" },
                                    { value: "verbo", label: "Verbose" },
                                ].map((level) => (
                                    <button
                                        key={level.value}
                                        type="button"
                                        onClick={() => setLogLevel(level.value)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                            logLevel === level.value
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                                : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                        {level.label}
                                        {level.default && logLevel !== level.value && (
                                            <span className="ml-1 text-[10px] text-zinc-400">(default)</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {isValidator && (
                            <div onMouseEnter={() => setHighlightPath('minDelayTarget')} onMouseLeave={clearHighlight}>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                        Min Block Delay
                                    </label>
                                    <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                        {minDelayTarget}ms
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    value={minDelayTarget}
                                    onChange={(e) => setMinDelayTarget(parseInt(e.target.value))}
                                    onFocus={() => setHighlightPath('minDelayTarget')}
                                    onBlur={clearHighlight}
                                    min="0"
                                    max="2000"
                                    step="50"
                                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                                    <span>0ms (fastest)</span>
                                    <span>500ms</span>
                                    <span>2000ms (slowest)</span>
                                </div>
                            </div>
                        )}
                        <div onMouseEnter={() => setHighlightPath('pruning')} onMouseLeave={clearHighlight}>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={pruningEnabled}
                                    onChange={(e) => setPruningEnabled(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm">Enable Pruning</span>
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {nodeType === "validator"
                                    ? "Recommended for validators. Reduces disk usage by removing old state data."
                                    : "Not recommended for RPC nodes that need full historical data."}
                            </p>
                        </div>

                        <div onMouseEnter={() => setHighlightPath('adminApi')} onMouseLeave={clearHighlight}>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={adminApiEnabled}
                                    onChange={(e) => setAdminApiEnabled(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm">Enable Admin API</span>
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Enables administrative APIs. Only enable if needed and secured.
                            </p>
                        </div>

                        {isRPC && (
                            <div onMouseEnter={() => setHighlightPath('ethApis')} onMouseLeave={clearHighlight}>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={enableDebugTrace}
                                        onChange={(e) => setEnableDebugTrace(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Enable Debug Trace</span>
                                </label>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    Enables debug APIs and detailed tracing capabilities
                                </p>
                            </div>
                        )}

                                    {/* Advanced Settings */}
                                    <div className="border-t pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                            className="flex items-center justify-between w-full text-left"
                                        >
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                Advanced Settings
                                            </span>
                                            <svg
                                                className={`w-5 h-5 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {showAdvancedSettings && (
                                            <div className="space-y-4 mt-4">
                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                    For advanced configuration options, see the{" "}
                                                    <a
                                                        href="https://build.avax.network/docs/nodes/configure/configs-flags"
                                                        target="_blank"
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                        rel="noreferrer"
                                                    >
                                                        AvalancheGo configuration
                                                    </a>{" "}
                                                    and{" "}
                                                    <a
                                                        href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                                                        target="_blank"
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                        rel="noreferrer"
                                                    >
                                                        Subnet-EVM configuration
                                                    </a> documentation.
                                                </span>
                                                <div>
                                                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Cache Settings</h4>

                                                    <div className="space-y-3">
                                                        <div onMouseEnter={() => setHighlightPath('trieCleanCache')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Trie Clean Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={trieCleanCache}
                                                                onChange={(e) => setTrieCleanCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('trieCleanCache')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('trieDirtyCache')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Trie Dirty Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={trieDirtyCache}
                                                                onChange={(e) => setTrieDirtyCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('trieDirtyCache')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('snapshotCache')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Snapshot Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={snapshotCache}
                                                                onChange={(e) => setSnapshotCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('snapshotCache')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('acceptedCacheSize')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Accepted Cache Size (blocks)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={acceptedCacheSize}
                                                                onChange={(e) => setAcceptedCacheSize(Math.max(1, parseInt(e.target.value) || 1))}
                                                                onFocus={() => setHighlightPath('acceptedCacheSize')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Depth of accepted headers and logs cache
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('trieDirtyCommitTarget')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Trie Dirty Commit Target (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={trieDirtyCommitTarget}
                                                                onChange={(e) => setTrieDirtyCommitTarget(Math.max(1, parseInt(e.target.value) || 1))}
                                                                onFocus={() => setHighlightPath('trieDirtyCommitTarget')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Memory limit before commit
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('triePrefetcherParallelism')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Trie Prefetcher Parallelism
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={triePrefetcherParallelism}
                                                                onChange={(e) => setTriePrefetcherParallelism(Math.max(1, parseInt(e.target.value) || 1))}
                                                                onFocus={() => setHighlightPath('triePrefetcherParallelism')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Max concurrent disk reads
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('stateSyncServerTrieCache')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                State Sync Server Trie Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={stateSyncServerTrieCache}
                                                                onChange={(e) => setStateSyncServerTrieCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('stateSyncServerTrieCache')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Trie cache for state sync server
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t pt-3">
                                                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Performance Settings</h4>

                                                    <div className="space-y-3">
                                                        <div onMouseEnter={() => setHighlightPath('commitInterval')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Commit Interval (blocks)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={commitInterval}
                                                                onChange={(e) => setCommitInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                                                onFocus={() => setHighlightPath('commitInterval')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Interval to persist EVM and atomic tries
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('rpcGasCap')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                RPC Gas Cap
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={rpcGasCap}
                                                                onChange={(e) => setRpcGasCap(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('rpcGasCap')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Maximum gas limit for RPC calls
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('rpcTxFeeCap')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                RPC Tx Fee Cap (AVAX)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={rpcTxFeeCap}
                                                                onChange={(e) => setRpcTxFeeCap(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('rpcTxFeeCap')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Maximum transaction fee cap
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t pt-3">
                                                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">API Limits</h4>

                                                    <div className="space-y-3">
                                                        <div onMouseEnter={() => setHighlightPath('batchRequestLimit')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Batch Request Limit
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={batchRequestLimit}
                                                                onChange={(e) => setBatchRequestLimit(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('batchRequestLimit')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Max batched requests (0 = no limit)
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('batchResponseMaxSize')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Batch Response Max Size (bytes)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={batchResponseMaxSize}
                                                                onChange={(e) => setBatchResponseMaxSize(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('batchResponseMaxSize')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Max batch response size (default: 25MB)
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t pt-3">
                                                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Transaction & State</h4>

                                                    <div className="space-y-3">
                                                        <div onMouseEnter={() => setHighlightPath('transactionHistory')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Transaction History (blocks)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={transactionHistory}
                                                                onChange={(e) => setTransactionHistory(Math.max(0, parseInt(e.target.value) || 0))}
                                                                onFocus={() => setHighlightPath('transactionHistory')}
                                                                onBlur={clearHighlight}
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Max blocks to keep tx indices. 0 = archive mode (all history)
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('skipTxIndexing')} onMouseLeave={clearHighlight}>
                                                            <label className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={skipTxIndexing}
                                                                    onChange={(e) => setSkipTxIndexing(e.target.checked)}
                                                                    onFocus={() => setHighlightPath('skipTxIndexing')}
                                                                    onBlur={clearHighlight}
                                                                    className="rounded"
                                                                />
                                                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                                    Skip Transaction Indexing
                                                                </span>
                                                            </label>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                                                Disable tx indexing entirely (saves disk space)
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('stateSyncEnabled')} onMouseLeave={clearHighlight}>
                                                            <label className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={stateSyncEnabled}
                                                                    onChange={(e) => setStateSyncEnabled(e.target.checked)}
                                                                    onFocus={() => setHighlightPath('stateSyncEnabled')}
                                                                    onBlur={clearHighlight}
                                                                    className="rounded"
                                                                />
                                                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                                    Enable State Sync
                                                                </span>
                                                            </label>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                                                Fast sync from state summary
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('preimagesEnabled')} onMouseLeave={clearHighlight}>
                                                            <label className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={preimagesEnabled}
                                                                    onChange={(e) => setPreimagesEnabled(e.target.checked)}
                                                                    onFocus={() => setHighlightPath('preimagesEnabled')}
                                                                    onBlur={clearHighlight}
                                                                    className="rounded"
                                                                />
                                                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                                    Enable Preimages
                                                                </span>
                                                            </label>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                                                Record preimages (uses more disk)
                                                            </p>
                                                        </div>

                                                        <div onMouseEnter={() => setHighlightPath('localTxsEnabled')} onMouseLeave={clearHighlight}>
                                                            <label className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={localTxsEnabled}
                                                                    onChange={(e) => setLocalTxsEnabled(e.target.checked)}
                                                                    onFocus={() => setHighlightPath('localTxsEnabled')}
                                                                    onBlur={clearHighlight}
                                                                    className="rounded"
                                                                />
                                                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                                    Enable Local Transactions
                                                                </span>
                                                            </label>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                                                Treat local account txs as local
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isValidator && (
                                                    <div className="border-t pt-3">
                                                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Gossip Settings (Validator)</h4>

                                                        <div className="space-y-3">
                                                            <div onMouseEnter={() => setHighlightPath('pushGossipNumValidators')} onMouseLeave={clearHighlight}>
                                                                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                    Push Gossip Num Validators
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={pushGossipNumValidators}
                                                                    onChange={(e) => setPushGossipNumValidators(Math.max(0, parseInt(e.target.value) || 0))}
                                                                    onFocus={() => setHighlightPath('pushGossipNumValidators')}
                                                                    onBlur={clearHighlight}
                                                                    className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                                />
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                    Number of validators to push gossip to
                                                                </p>
                                                            </div>

                                                            <div onMouseEnter={() => setHighlightPath('pushGossipPercentStake')} onMouseLeave={clearHighlight}>
                                                                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                    Push Gossip Percent Stake
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    min="0"
                                                                    max="1"
                                                                    value={pushGossipPercentStake}
                                                                    onChange={(e) => setPushGossipPercentStake(Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                                    onFocus={() => setHighlightPath('pushGossipPercentStake')}
                                                                    onBlur={clearHighlight}
                                                                    className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                                />
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                    Percentage of total stake to gossip to (0-1)
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {isRPC && (
                                                    <div className="border-t pt-3">
                                                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">RPC-Specific Settings</h4>

                                                        <div className="space-y-3">
                                                            <div onMouseEnter={() => setHighlightPath('apiMaxBlocksPerRequest')} onMouseLeave={clearHighlight}>
                                                                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                    API Max Blocks Per Request
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={apiMaxBlocksPerRequest}
                                                                    onChange={(e) => setApiMaxBlocksPerRequest(Math.max(0, parseInt(e.target.value) || 0))}
                                                                    onFocus={() => setHighlightPath('apiMaxBlocksPerRequest')}
                                                                    onBlur={clearHighlight}
                                                                    className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                                />
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                    0 = no limit. Limits blocks per getLogs request
                                                                </p>
                                                            </div>

                                                            <div onMouseEnter={() => setHighlightPath('allowUnfinalizedQueries')} onMouseLeave={clearHighlight}>
                                                                <label className="flex items-center space-x-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allowUnfinalizedQueries}
                                                                        onChange={(e) => setAllowUnfinalizedQueries(e.target.checked)}
                                                                        onFocus={() => setHighlightPath('allowUnfinalizedQueries')}
                                                                        onBlur={clearHighlight}
                                                                        className="rounded"
                                                                    />
                                                                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                                        Allow Unfinalized Queries
                                                                    </span>
                                                                </label>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                                                    Allows queries for unfinalized/pending blocks
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="border-t pt-3">
                                                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Profiling (Optional)</h4>

                                                    <div className="space-y-3">
                                                        <div onMouseEnter={() => setHighlightPath('continuousProfilerDir')} onMouseLeave={clearHighlight}>
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                Continuous Profiler Directory
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={continuousProfilerDir}
                                                                onChange={(e) => setContinuousProfilerDir(e.target.value)}
                                                                onFocus={() => setHighlightPath('continuousProfilerDir')}
                                                                onBlur={clearHighlight}
                                                                placeholder="./profiles (leave empty to disable)"
                                                                className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                            />
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                Directory for continuous profiler output
                                                            </p>
                                                        </div>

                                                        {continuousProfilerDir && (
                                                            <div onMouseEnter={() => setHighlightPath('continuousProfilerFrequency')} onMouseLeave={clearHighlight}>
                                                                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                                                    Profiler Frequency
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={continuousProfilerFrequency}
                                                                    onChange={(e) => setContinuousProfilerFrequency(e.target.value)}
                                                                    onFocus={() => setHighlightPath('continuousProfilerFrequency')}
                                                                    onBlur={clearHighlight}
                                                                    placeholder="15m"
                                                                    className="w-full px-2 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-white"
                                                                />
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                                    How often to create profiles (e.g., 15m, 1h)
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                        {/* Configuration Preview - right column */}
                        <div className="lg:sticky lg:top-4 h-fit">
                            <div className="border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
                                <div className="border-b p-3 bg-zinc-50 dark:bg-zinc-900">
                                    <h4 className="text-sm font-semibold">Configuration Preview</h4>
                                </div>
                                <div className="max-h-[600px] overflow-auto p-3 bg-zinc-50 dark:bg-zinc-950">
                                    {configJson && !configJson.startsWith("Error:") ? (
                                        <SyntaxHighlightedJSON
                                            code={configJson}
                                            highlightedLines={highlightedLines}
                                        />
                                    ) : (
                                        <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                                            {configJson.startsWith("Error:") ? configJson : "Loading configuration..."}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Step>

                <Step>
                    <h3 className="text-xl font-bold mb-4">Select L1</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                        Enter the Avalanche Subnet ID of the L1 you want to run a node for
                    </p>

                    <InputSubnetId
                        value={subnetId}
                        onChange={setSubnetId}
                        error={subnetIdError}
                    />

                    {subnet && subnet.blockchains && subnet.blockchains.length > 1 && isRPC && (
                        <div className="mt-4">
                            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                Select Blockchain for RPC Endpoint
                            </label>
                            <select
                                value={selectedRPCBlockchainId}
                                onChange={(e) => setSelectedRPCBlockchainId(e.target.value)}
                                className="w-full max-w-xl px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:text-white"
                            >
                                {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string }) => (
                                    <option key={blockchain.blockchainId} value={blockchain.blockchainId}>
                                        {blockchain.blockchainName} ({blockchain.blockchainId})
                                    </option>
                                ))}
                            </select>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                This blockchain will be used for the RPC endpoint URL generation.
                            </p>
                        </div>
                    )}
                </Step>

                <Step>
                    <DockerInstallation includeCompose={false} />

                    <p className="mt-4">
                        If you do not want to use Docker, you can follow the instructions{" "}
                        <a
                            href="https://github.com/ava-labs/avalanchego?tab=readme-ov-file#installation"
                            target="_blank"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                            rel="noreferrer"
                        >
                            here
                        </a>
                        .
                    </p>

                    {/* Network Requirements - Dynamic based on node type */}
                    <div className="mt-6">
                        <NetworkingGuide nodeType={nodeType} variant="l1" />
                    </div>
                </Step>

                {subnetId && blockchainInfo && (
                    <>
                        <Step>
                            <h3 className="text-xl font-bold mb-4">Create Configuration File</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                Run this command on your server to create the Subnet-EVM chain configuration file:
                            </p>

                            <DynamicCodeBlock
                                lang="bash"
                                code={(() => {
                                    try {
                                        const config = JSON.parse(configJson);
                                        return generateConfigFileCommand(chainId, config);
                                    } catch {
                                        return "# Error generating config file command";
                                    }
                                })()}
                            />

                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                This creates the configuration file at <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">~/.avalanchego/configs/chains/{chainId}/config.json</code>
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Read the documentation for more information on the configuration options. {" "}
                                <a
                                    href="https://build.avax.network/docs/nodes/configure/configs-flags"
                                    target="_blank"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                    rel="noreferrer"
                                >
                                    AvalancheGo configuration
                                </a>
                                {" "}and{" "}
                                <a
                                    href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                                    target="_blank"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                    rel="noreferrer"
                                >
                                    Subnet-EVM configuration
                                </a>
                            </p>
                        </Step>

                        <Step>
                            <h3 className="text-xl font-bold mb-4">Run Docker Command</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                Start the node using Docker:
                            </p>

                            <DynamicCodeBlock
                                lang="bash"
                                code={(() => {
                                    try {
                                        const config = JSON.parse(configJson);
                                        const vmId = blockchainInfo?.vmId || SUBNET_EVM_VM_ID;
                                        return generateDockerCommand(
                                            subnetId,
                                            chainId,
                                            config,
                                            nodeType,
                                            effectiveNetworkID,
                                            vmId
                                        );
                                    } catch {
                                        return "# Error generating Docker command";
                                    }
                                })()}
                            />

                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                The container will read the config from <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">~/.avalanchego/configs/chains/{chainId}/config.json</code> via the mounted volume.
                            </p>

                            <Accordions type="single" className="mt-4">
                                {isCustomVM && (
                                    <Accordion title="Custom VM Configuration">
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                            This blockchain uses a non-standard Virtual Machine ID. The Docker command includes VM aliases mapping.
                                        </p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                            <strong>VM ID:</strong> {blockchainInfo.vmId}<br />
                                            <strong>Aliases to:</strong> {SUBNET_EVM_VM_ID}
                                        </p>
                                    </Accordion>
                                )}
                                <Accordion title="Running Multiple Nodes">
                                    <p className="text-sm">To run multiple nodes on the same machine, ensure each node has:</p>
                                    <ul className="list-disc pl-5 mt-1 text-sm">
                                        <li>Unique container name (change <code>--name</code> parameter)</li>
                                        <li>Different ports (modify port mappings)</li>
                                        <li>Separate data directories (change <code>~/.avalanchego</code> path)</li>
                                    </ul>
                                </Accordion>

                                <Accordion title="Monitoring Logs">
                                    <p className="text-sm mb-2">Monitor your node with:</p>
                                    <DynamicCodeBlock lang="bash" code="docker logs -f avago" />
                                </Accordion>
                            </Accordions>
                        </Step>

                        {isRPC && (
                            <Step>
                                <ReverseProxySetup
                                    domain={domain}
                                    setDomain={setDomain}
                                    chainId={selectedRPCBlockchainId || chainId}
                                    showHealthCheck={true}
                                />
                            </Step>
                        )}
                    </>
                )}
            </Steps>

            {configJson && !configJson.startsWith("Error:") && (
                <div className="mt-6 flex justify-center">
                    <Button onClick={handleReset} variant="outline">
                        Start Over
                    </Button>
                </div>
            )}
        </Container>
    );
}

export default function AvalanchegoDocker() {
    return (
        <GenesisHighlightProvider>
            <AvalanchegoDockerInner />
        </GenesisHighlightProvider>
    );
}
