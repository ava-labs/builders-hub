"use client";

// L1 Node Docker Setup
import { useState, useEffect } from "react";
import { useWalletStore } from "../../stores/walletStore";
import { Container } from "../../components/Container";
import { getBlockchainInfoForNetwork, getSubnetInfoForNetwork } from "../../coreViem/utils/glacier";
import InputSubnetId from "../../components/InputSubnetId";
import BlockchainDetailsDisplay from "../../components/BlockchainDetailsDisplay";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Button } from "../../components/Button";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { SyntaxHighlightedJSON } from "../../components/genesis/SyntaxHighlightedJSON";
import { ReverseProxySetup } from "../../components/ReverseProxySetup";
import { GenesisHighlightProvider, useGenesisHighlight } from "../../components/genesis/GenesisHighlightContext";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { generateChainConfig, generateNodeConfig, generateDockerCommand } from "./node-config";
import { useNodeConfigHighlighting } from "./useNodeConfigHighlighting";
import { DockerInstallation } from "../../components/DockerInstallation";
import { AlertCircle } from "lucide-react";
import { useAddToWallet } from "@/hooks/useAddToWallet";
import { nipify } from "../../components/HostInput";
import { useL1ListStore, type L1ListItem } from "../../stores/l1ListStore";

function AvalanchegoDockerInner() {
    const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [nodeType, setNodeType] = useState<"validator" | "rpc" | "archival">("validator");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [adminApiEnabled, setAdminApiEnabled] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [logLevel, setLogLevel] = useState<string>("info");
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [selectedRPCBlockchainId, setSelectedRPCBlockchainId] = useState<string>("");
    const [minDelayTarget, setMinDelayTarget] = useState<number>(2000);
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
    const [batchRequestLimit, setBatchRequestLimit] = useState<number>(1000); // AvalancheGo default
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

    // Enable expensive debug-level metrics (disabled by default)
    const [metricsExpensiveEnabled, setMetricsExpensiveEnabled] = useState<boolean>(false);

    // Show advanced settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

    // Wallet integration for RPC nodes
    const { addToWallet, isAdding: isAddingToWallet } = useAddToWallet();
    const l1ListStore = useL1ListStore();

    // Network selection
    const [selectedNetwork, setSelectedNetwork] = useState<"mainnet" | "fuji">("mainnet");
    const [detectedIsTestnet, setDetectedIsTestnet] = useState<boolean | null>(null);

    // Sync network selection with connected wallet
    const { isTestnet: walletIsTestnet } = useWalletStore();
    useEffect(() => {
        setSelectedNetwork(walletIsTestnet ? "fuji" : "mainnet");
    }, [walletIsTestnet]);

    // Use selected network for configuration (1 = mainnet, 5 = fuji)
    const effectiveNetworkID = selectedNetwork === "fuji" ? 5 : 1;

    // On testnet, "archival" option becomes "Both" (validator + RPC)
    const isTestnet = selectedNetwork === "fuji";
    const isRPC = nodeType === "rpc" || nodeType === "archival";
    const isValidator = nodeType === "validator" || (nodeType === "archival" && isTestnet);

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
                continuousProfilerFrequency,
                metricsExpensiveEnabled
            );
            setConfigJson(JSON.stringify(config, null, 2));
        } catch (error) {
            setConfigJson(`Error: ${(error as Error).message}`);
        }
    }, [nodeType, enableDebugTrace, adminApiEnabled, pruningEnabled, logLevel, minDelayTarget, trieCleanCache, trieDirtyCache, trieDirtyCommitTarget, triePrefetcherParallelism, snapshotCache, commitInterval, stateSyncServerTrieCache, rpcGasCap, rpcTxFeeCap, apiMaxBlocksPerRequest, allowUnfinalizedQueries, batchRequestLimit, batchResponseMaxSize, acceptedCacheSize, transactionHistory, stateSyncEnabled, skipTxIndexing, preimagesEnabled, localTxsEnabled, pushGossipNumValidators, pushGossipPercentStake, continuousProfilerDir, continuousProfilerFrequency, metricsExpensiveEnabled]);

    useEffect(() => {
        if (nodeType === "validator") {
            // Validator node defaults:
            // - Pruning enabled (reduces disk usage)
            // - State sync enabled (fast bootstrap)
            setDomain("");
            setEnableDebugTrace(false);
            setAdminApiEnabled(false);
            setPruningEnabled(true);
            setLogLevel("info");
            setMinDelayTarget(2000);
            setAllowUnfinalizedQueries(false);
            setStateSyncEnabled(true);
            setSkipTxIndexing(true); // Validators don't need tx indexing
            setTransactionHistory(0);
        } else if (nodeType === "rpc") {
            // RPC node defaults (pruned):
            // - Pruning enabled for disk efficiency
            // - State sync enabled for fast bootstrap
            setPruningEnabled(true);
            setLogLevel("info");
            setAllowUnfinalizedQueries(false);
            setStateSyncEnabled(true);
            setSkipTxIndexing(false); // RPC nodes need tx indexing
            setTransactionHistory(0);
        } else if (nodeType === "archival") {
            // Archival (mainnet) or Both (testnet):
            // - Pruning disabled (full history)
            // - State sync disabled (replay from genesis)
            setPruningEnabled(false);
            setLogLevel("info");
            setMinDelayTarget(2000);
            setAllowUnfinalizedQueries(false);
            setStateSyncEnabled(false);
            setSkipTxIndexing(false); // Need tx indexing for queries
            setTransactionHistory(0);
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
            // Use the selected network for lookup
            const network = selectedNetwork === "fuji" ? "testnet" : "mainnet";

            try {
                const subnetInfo = await getSubnetInfoForNetwork(network, subnetId, abortController.signal);

                // Check if this request was cancelled
                if (abortController.signal.aborted) return;

                setSubnet(subnetInfo);
                setDetectedIsTestnet(selectedNetwork === "fuji");

                // Always get blockchain info for the first blockchain (for Docker command generation)
                if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
                    const blockchainId = subnetInfo.blockchains[0].blockchainId;
                    setChainId(blockchainId);
                    setSelectedRPCBlockchainId(blockchainId); // Auto-select first blockchain for RPC

                    try {
                        const chainInfo = await getBlockchainInfoForNetwork(network, blockchainId, abortController.signal);

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
                    setSubnetIdError(`L1 not found on ${selectedNetwork}. Try switching networks.`);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadSubnetData();

        // Cleanup function to abort the request if component unmounts or subnetId/network changes
        return () => {
            abortController.abort();
        };
    }, [subnetId, selectedNetwork]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);

    const handleReset = () => {
        setSelectedNetwork("mainnet");
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
        setMinDelayTarget(2000);
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
        setBatchRequestLimit(1000);
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
        setMetricsExpensiveEnabled(false); // Expensive metrics disabled by default
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
                                    Network
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedNetwork("mainnet")}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            selectedNetwork === "mainnet"
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                        <div className="font-medium text-sm">Mainnet</div>
                                        <div className="text-xs text-zinc-500">Production network</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedNetwork("fuji")}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            selectedNetwork === "fuji"
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                        <div className="font-medium text-sm">Fuji</div>
                                        <div className="text-xs text-zinc-500">Testnet</div>
                                    </button>
                                </div>
                            </div>

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
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">P2P only</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNodeType("rpc")}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            nodeType === "rpc"
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">RPC</div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Pruned</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNodeType("archival")}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            nodeType === "archival"
                                                ? isTestnet
                                                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                                    : "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            {isTestnet ? "Both" : "Archival"}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            {isTestnet ? "Validator + RPC" : "Full history"}
                                        </div>
                                    </button>
                                </div>
                                {nodeType === "archival" && isTestnet && (
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
                                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                            Min Block Delay
                                        </span>
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
                                        <span>1000ms</span>
                                        <span>2000ms (default)</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                        Minimum time between blocks. Lower values = faster blocks but more network load.
                                    </p>
                                </div>
                            )}

                            {/* Pruning and State Sync - grouped together due to their interdependency */}
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Storage Settings</span>
                                </div>

                                <div onMouseEnter={() => setHighlightPath('pruning')} onMouseLeave={clearHighlight}>
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={pruningEnabled}
                                            onChange={(e) => setPruningEnabled(e.target.checked)}
                                            className="rounded"
                                        />
                                        <span className="text-sm font-medium">Enable Pruning</span>
                                    </label>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                        Removes old state data to reduce disk usage. Storage savings depend on your L1's transaction volume.
                                        {(nodeType === "validator" || nodeType === "rpc") && " Recommended for validators and pruned RPC nodes."}
                                        {nodeType === "archival" && " Disable for archival nodes that need full historical state."}
                                    </p>
                                </div>

                                <div onMouseEnter={() => setHighlightPath('stateSyncEnabled')} onMouseLeave={clearHighlight}>
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={stateSyncEnabled}
                                            onChange={(e) => setStateSyncEnabled(e.target.checked)}
                                            className="rounded"
                                        />
                                        <span className="text-sm font-medium">Enable State Sync</span>
                                    </label>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                        Bootstrap from a recent state snapshot instead of replaying all blocks from genesis.
                                        {(nodeType === "validator" || nodeType === "rpc") && " Recommended for faster initial sync."}
                                        {nodeType === "archival" && " Disable to replay full history for archival queries."}
                                    </p>
                                </div>

                                {/* Warning when pruning and state sync settings don't match */}
                                {pruningEnabled !== stateSyncEnabled && (
                                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            <strong>Mismatched settings:</strong> Pruning and State Sync are typically enabled together for validators, or both disabled for archival RPC nodes.
                                        </p>
                                    </div>
                                )}
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
                                <>
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

                                    <div onMouseEnter={() => setHighlightPath('skipTxIndexing')} onMouseLeave={clearHighlight}>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={!skipTxIndexing}
                                                onChange={(e) => setSkipTxIndexing(!e.target.checked)}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Enable Transaction Indexing</span>
                                        </label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                            Required for eth_getLogs and transaction lookups. Disable to save disk space.
                                        </p>
                                    </div>
                                </>
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
                                            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Metrics Settings</h4>
                                            <div className="space-y-3">
                                                <div onMouseEnter={() => setHighlightPath('metricsExpensive')} onMouseLeave={clearHighlight}>
                                                    <label className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={metricsExpensiveEnabled}
                                                            onChange={(e) => setMetricsExpensiveEnabled(e.target.checked)}
                                                            onFocus={() => setHighlightPath('metricsExpensive')}
                                                            onBlur={clearHighlight}
                                                            className="rounded"
                                                        />
                                                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                            Enable Expensive Metrics
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">
                                                        Enables debug-level metrics including Firewood metrics. May impact performance.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Configuration Preview */}
                        <div className="lg:sticky lg:top-4 h-fit">
                            <div className="border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden">
                                <div className="border-b p-3 bg-gray-50 dark:bg-gray-900">
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
                                            {configJson.startsWith("Error:") ? configJson : "Configure your node to see the Subnet-EVM chain config"}
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

                    {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
                        <div className="space-y-4 mt-4">
                            {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string; createBlockTimestamp: number; createBlockNumber: string; vmId: string; subnetId: string; evmChainId: number }) => (
                                <BlockchainDetailsDisplay
                                    key={blockchain.blockchainId}
                                    blockchain={{
                                        ...blockchain,
                                        isTestnet: selectedNetwork === "fuji"
                                    }}
                                    isLoading={isLoading}
                                    customTitle={`${blockchain.blockchainName} Blockchain Details`}
                                />
                            ))}
                        </div>
                    )}
                </Step>

                {subnetId && blockchainInfo && (
                    <>

                        <Step>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Create Configuration Files</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                Run these commands to create the config files. AvalancheGo reads from these default locations on startup.
                            </p>

                            <Steps>
                                <Step>
                                    <h4 className="text-sm font-medium mb-2">Create config directories</h4>
                                    <DynamicCodeBlock
                                        lang="bash"
                                        code={`mkdir -p ~/.avalanchego/configs/chains/${chainId}\nmkdir -p ~/.avalanchego/configs/vms`}
                                    />
                                </Step>

                                <Step>
                                    <h4 className="text-sm font-medium mb-2">
                                        Node config <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-2">~/.avalanchego/configs/node.json</code>
                                    </h4>
                                    <DynamicCodeBlock
                                        lang="bash"
                                        code={(() => {
                                            try {
                                                const nodeConfig = generateNodeConfig(subnetId, nodeType, effectiveNetworkID);
                                                return `cat > ~/.avalanchego/configs/node.json << 'EOF'\n${JSON.stringify(nodeConfig, null, 2)}\nEOF`;
                                            } catch {
                                                return "# Error generating node config";
                                            }
                                        })()}
                                    />
                                </Step>

                                <Step>
                                    <h4 className="text-sm font-medium mb-2">
                                        Chain config <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-2">~/.avalanchego/configs/chains/{chainId.slice(0, 8)}...</code>
                                    </h4>
                                    <DynamicCodeBlock
                                        lang="bash"
                                        code={(() => {
                                            try {
                                                const chainConfig = JSON.parse(configJson);
                                                return `cat > ~/.avalanchego/configs/chains/${chainId}/config.json << 'EOF'\n${JSON.stringify(chainConfig, null, 2)}\nEOF`;
                                            } catch {
                                                return "# Error generating chain config";
                                            }
                                        })()}
                                    />
                                </Step>

                                {blockchainInfo?.vmId && blockchainInfo.vmId !== SUBNET_EVM_VM_ID && (
                                    <Step>
                                        <h4 className="text-sm font-medium mb-2">
                                            VM aliases <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-2">~/.avalanchego/configs/vms/aliases.json</code>
                                        </h4>
                                        <DynamicCodeBlock
                                            lang="bash"
                                            code={`cat > ~/.avalanchego/configs/vms/aliases.json << 'EOF'\n${JSON.stringify({ [blockchainInfo.vmId]: [SUBNET_EVM_VM_ID] }, null, 2)}\nEOF`}
                                        />
                                    </Step>
                                )}
                            </Steps>

                            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                                Docs: {" "}
                                <a
                                    href="https://build.avax.network/docs/nodes/configure/configs-flags"
                                    target="_blank"
                                    className="text-blue-500 hover:underline"
                                    rel="noreferrer"
                                >
                                    Node config
                                </a>
                                {" · "}
                                <a
                                    href="https://build.avax.network/docs/nodes/chain-configs/subnet-evm"
                                    target="_blank"
                                    className="text-blue-500 hover:underline"
                                    rel="noreferrer"
                                >
                                    Chain config
                                </a>
                            </div>
                        </Step>

                        <Step>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Configure Firewall</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                Open the required ports for your node to communicate with the network.
                            </p>

                            {/* Port explanation */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className={`rounded-lg p-3 border ${isRPC ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">9651</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Required</span>
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">P2P / Staking port</div>
                                    <div className="text-[10px] text-zinc-400 mt-1">Node-to-node communication</div>
                                </div>
                                <div className={`rounded-lg p-3 border ${isRPC ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-50'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">9650</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isRPC ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                            {isRPC ? 'Required' : 'RPC only'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">HTTP / RPC port</div>
                                    <div className="text-[10px] text-zinc-400 mt-1">API requests from clients</div>
                                </div>
                            </div>

                            <DynamicCodeBlock
                                lang="bash"
                                code={isRPC
                                    ? `# Open P2P and RPC ports
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw allow 9650/tcp comment 'AvalancheGo RPC'
sudo ufw --force enable
sudo ufw status`
                                    : `# Open P2P port only (validators don't expose RPC)
sudo ufw allow 9651/tcp comment 'AvalancheGo P2P'
sudo ufw --force enable
sudo ufw status`}
                            />

                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                                {isRPC
                                    ? "RPC nodes need both ports open. Consider using a reverse proxy (nginx) for SSL termination on port 9650."
                                    : "Validators only need the P2P port. The RPC port is bound to localhost for security."}
                            </p>
                        </Step>

                        <Step>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Run Docker</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                Start the node. Config is read from the mounted volume — no env vars needed.
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

                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                Restart anytime with <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">docker restart avago</code> — config changes are picked up automatically.
                            </p>


                            <Accordions type="single" className="mt-4">
                                {isCustomVM && (
                                    <Accordion title="Custom VM Configuration">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            This blockchain uses a non-standard Virtual Machine ID. The Docker command includes VM aliases mapping.
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
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

                        {isValidator && (
                            <Step>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Backup Validator Credentials</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                    Your validator identity is defined by these files in <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">~/.avalanchego/staking/</code>
                                </p>

                                {/* Key files - compact grid */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-1">
                                            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">TLS Cert</span>
                                        </div>
                                        <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">staker.crt</div>
                                        <div className="text-[10px] text-zinc-400 mt-1">Node identity</div>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                                        <div className="flex items-center gap-2 mb-1">
                                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                            <span className="text-xs font-medium text-red-600 dark:text-red-400">Private Key</span>
                                        </div>
                                        <div className="text-sm font-mono text-red-700 dark:text-red-300">staker.key</div>
                                        <div className="text-[10px] text-red-400 mt-1">Keep secret!</div>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                                        <div className="flex items-center gap-2 mb-1">
                                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                            <span className="text-xs font-medium text-red-600 dark:text-red-400">BLS Key</span>
                                        </div>
                                        <div className="text-sm font-mono text-red-700 dark:text-red-300">signer.key</div>
                                        <div className="text-[10px] text-red-400 mt-1">L1 signing</div>
                                    </div>
                                </div>

                                <DynamicCodeBlock lang="bash" code={`# Backup your validator credentials
mkdir -p ~/avalanche-backup
cp -r ~/.avalanchego/staking ~/avalanche-backup/

# Verify backup
ls -la ~/avalanche-backup/staking/`} />

                                {/* Backup locations - inline */}
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Store securely:</span>
                                    <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">Encrypted USB</span>
                                    <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">Encrypted S3</span>
                                    <span className="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">Multiple locations</span>
                                </div>

                                {/* Warnings - compact */}
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5 mt-4">
                                    <p className="flex items-start gap-1.5">
                                        <span className="text-red-500 mt-0.5">⚠</span>
                                        <span>Lost keys = <strong className="text-zinc-700 dark:text-zinc-300">your validator stops working</strong>. NVMe drives can fail without warning.</span>
                                    </p>
                                    <p className="flex items-start gap-1.5">
                                        <span className="text-amber-500 mt-0.5">🔒</span>
                                        <span>Never share private keys — anyone with them can impersonate your validator.</span>
                                    </p>
                                </div>

                                {/* Links */}
                                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 text-xs">
                                    <a href="/docs/nodes/maintain/backup-restore" className="text-blue-500 hover:underline flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                        </svg>
                                        Full Backup Guide
                                    </a>
                                </div>
                            </Step>
                        )}

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

                        {isRPC && (
                            <Step>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Add Network to Wallet</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                    Add your L1&apos;s RPC endpoint to your browser wallet to start interacting with the network.
                                </p>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                                            <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">RPC Endpoint</div>
                                            <code className="text-xs text-zinc-900 dark:text-zinc-100 break-all">
                                                {domain
                                                    ? `https://${nipify(domain)}/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`
                                                    : `http://localhost:9650/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`
                                                }
                                            </code>
                                        </div>
                                        {blockchainInfo?.evmChainId && (
                                            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                                                <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">EVM Chain ID</div>
                                                <code className="text-sm text-zinc-900 dark:text-zinc-100">{blockchainInfo.evmChainId}</code>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        onClick={async () => {
                                            const rpcUrl = domain
                                                ? `https://${nipify(domain)}/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`
                                                : `http://localhost:9650/ext/bc/${selectedRPCBlockchainId || chainId}/rpc`;
                                            const evmChainId = blockchainInfo?.evmChainId;
                                            const name = blockchainInfo?.blockchainName || "Avalanche L1";

                                            // Add to console's L1 list so the header picks it up
                                            if (evmChainId) {
                                                const existing = l1ListStore.getState().l1List;
                                                if (!existing.find((l: L1ListItem) => l.evmChainId === evmChainId)) {
                                                    l1ListStore.getState().addL1({
                                                        id: selectedRPCBlockchainId || chainId,
                                                        name,
                                                        rpcUrl,
                                                        evmChainId,
                                                        coinName: "AVAX",
                                                        isTestnet: selectedNetwork === "fuji",
                                                        subnetId,
                                                        wrappedTokenAddress: "",
                                                        validatorManagerAddress: "",
                                                        logoUrl: "",
                                                    });
                                                }
                                            }

                                            await addToWallet({ rpcUrl, chainName: name, chainId: evmChainId });
                                        }}
                                        disabled={isAddingToWallet}
                                    >
                                        {isAddingToWallet ? "Adding..." : "Add to Wallet"}
                                    </Button>
                                </div>

                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                                    Works with Core, MetaMask, and other EVM wallets connected via RainbowKit.
                                </p>
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
