"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Container } from "@/components/toolbox/components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { DockerInstallation } from "@/components/toolbox/components/DockerInstallation";
import { ReverseProxySetup } from "@/components/toolbox/components/ReverseProxySetup";
import { Button } from "@/components/toolbox/components/Button";
import { SyntaxHighlightedJSON } from "@/components/toolbox/components/genesis/SyntaxHighlightedJSON";
import { GenesisHighlightProvider, useGenesisHighlight } from "@/components/toolbox/components/genesis/GenesisHighlightContext";
import { StorageRequirements } from "@/components/toolbox/components/StorageRequirements";
import { generateChainConfig, generateConfigFileCommand } from "@/components/toolbox/console/layer-1/node-config";
import { useNodeConfigHighlighting } from "@/components/toolbox/console/layer-1/useNodeConfigHighlighting";
import { C_CHAIN_ID } from "@/components/toolbox/console/layer-1/create/config";
import { getContainerVersions } from "@/components/toolbox/utils/containerVersions";

function AvalancheGoDockerPrimaryNetworkInner() {
    const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();
    const [nodeType, setNodeType] = useState<"validator" | "rpc" | "archival">("validator");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [adminApiEnabled, setAdminApiEnabled] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [logLevel, setLogLevel] = useState<string>("info");
    // min-delay-target: 0 means don't include in config (use node default)
    // C-Chain has sub-second block times, so validators shouldn't vote on this by default
    const [minDelayTarget, setMinDelayTarget] = useState<number>(0);
    const [configJson, setConfigJson] = useState<string>("");

    // Enable expensive debug-level metrics (disabled by default)
    const [metricsExpensiveEnabled, setMetricsExpensiveEnabled] = useState<boolean>(false);

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

    // Show advanced settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

    // Network selection (allows explicit choice independent of wallet)
    const [selectedNetwork, setSelectedNetwork] = useState<"mainnet" | "fuji">("mainnet");

    const { avalancheNetworkID } = useWalletStore();

    // Use selected network for configuration (1 = mainnet, 5 = fuji)
    const effectiveNetworkID = selectedNetwork === "fuji" ? 5 : 1;

    const isRPC = nodeType === "rpc" || nodeType === "archival";

    // Get highlighted lines for JSON preview
    const highlightedLines = useNodeConfigHighlighting(highlightPath, configJson);

    // Generate chain configuration JSON when parameters change
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
            // - TX indexing OFF (validators don't need to query transactions)
            // - eth-apis: node uses sensible defaults automatically
            setDomain("");
            setEnableDebugTrace(false);
            setAdminApiEnabled(false);
            setPruningEnabled(true);
            setLogLevel("info");
            setMinDelayTarget(0); // Don't include in config - use node default
            setAllowUnfinalizedQueries(false);
            setStateSyncEnabled(true); // Validators benefit from fast sync
            setSkipTxIndexing(true); // Validators don't need tx indexing
            setTransactionHistory(0);
        } else if (nodeType === "rpc") {
            // RPC node defaults:
            // - Pruning enabled (reduces disk usage - only serves current state)
            // - State sync enabled (fast bootstrap)
            // - TX indexing ON (RPC nodes need to query transactions)
            // - eth-apis: node uses sensible defaults automatically
            // Best for: Cost-effective RPC serving current/recent state
            setPruningEnabled(true);
            setLogLevel("info");
            setAllowUnfinalizedQueries(false); // Default to finalized queries for safety
            setStateSyncEnabled(true); // RPC nodes can use fast sync
            setSkipTxIndexing(false); // RPC nodes need tx indexing for queries
            setTransactionHistory(0);
        } else if (nodeType === "archival") {
            // Archival node defaults:
            // - Pruning disabled (full historical state)
            // - State sync disabled (need to replay all blocks for full history)
            // - TX indexing ON (archival nodes need full tx history)
            // - eth-apis: node uses sensible defaults automatically
            // Best for: Historical queries, block explorers, analytics
            setPruningEnabled(false);
            setLogLevel("info");
            setAllowUnfinalizedQueries(false); // Default to finalized queries for safety
            setStateSyncEnabled(false); // Archival nodes need full historical data
            setSkipTxIndexing(false); // Archival nodes need tx indexing for queries
            setTransactionHistory(0);
        }
    }, [nodeType]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);

    const handleReset = () => {
        setSelectedNetwork("mainnet");
        setNodeType("validator");
        setDomain("");
        setEnableDebugTrace(false);
        setAdminApiEnabled(false);
        setPruningEnabled(true);
        setLogLevel("info");
        setMinDelayTarget(0); // Don't include in config by default
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
        setBatchRequestLimit(1000); // AvalancheGo default
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

    // Generate Docker command for Primary Network (using file-based config)
    const getDockerCommand = () => {
        try {
            const isTestnet = effectiveNetworkID === 5;
            const versions = getContainerVersions(isTestnet);

            const env: Record<string, string> = {
                AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns",
                AVAGO_HTTP_HOST: "0.0.0.0",
                AVAGO_CHAIN_CONFIG_DIR: "/root/.avalanchego/configs/chains"
            };

            // Set network ID
            if (effectiveNetworkID === 5) {
                env.AVAGO_NETWORK_ID = "fuji";
            }

            // Configure RPC settings
            if (isRPC) {
                env.AVAGO_HTTP_ALLOWED_HOSTS = '"*"';
            }

            const chunks = [
                "docker run -it -d",
                "--name avago",
                `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
                "-v ~/.avalanchego:/root/.avalanchego",
                ...Object.entries(env).map(([key, value]) => `-e ${key}=${value}`),
                `avaplatform/avalanchego:${versions['avaplatform/avalanchego']}`
            ];

            return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
        } catch (error) {
            return `# Error: ${(error as Error).message}`;
        }
    };

    // Generate the config file command
    const getConfigFileCommand = () => {
        try {
            const config = JSON.parse(configJson);
            return generateConfigFileCommand(C_CHAIN_ID, config);
        } catch {
            return "# Error generating config file command";
        }
    };

    return (
            <Container
                title="Primary Network Node Setup with Docker"
            description="Configure your node settings, preview the chain config, and run Docker to start your Primary Network node."
                githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/primary-network/AvalancheGoDockerPrimaryNetwork.tsx"
            >
                <Steps>
                    <Step>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Set up Instance</h3>

                        {/* Hardware requirements - compact grid */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">CPU</span>
                                </div>
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">4-8+ cores</div>
                            </div>
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">RAM</span>
                                </div>
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">16-32 GB</div>
                            </div>
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Storage</span>
                                </div>
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">1-15 TB NVMe</div>
                            </div>
                        </div>

                        {/* Notices - compact */}
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
                            <p className="flex items-start gap-1.5">
                                <span className="text-amber-500 mt-0.5">⚠</span>
                                <span>Use <strong className="text-zinc-700 dark:text-zinc-300">local NVMe</strong>, not cloud block storage (EBS, Persistent Disk). <a href="/docs/nodes/system-requirements" className="text-blue-500 hover:underline">Details →</a></span>
                            </p>
                            <p className="flex items-start gap-1.5">
                                <span className="text-blue-500 mt-0.5">ℹ</span>
                                <span>No server? Run locally for testing — select &quot;RPC&quot; node type below.</span>
                            </p>
                        </div>
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
                    </Step>

                    <Step>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Configure Node Settings</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                        Choose your network, node type, and configure settings. The configuration preview updates in real-time.
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
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Mainnet</div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Production network</div>
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
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Fuji</div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Testnet</div>
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
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        }`}
                                    >
                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Archival</div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Full history</div>
                                    </button>
                                </div>
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
                                        <strong className="text-zinc-700 dark:text-zinc-300">Pruning reduces disk usage by ~44x</strong> (13TB → 300GB) by removing old state data.
                                        {nodeType === "validator" && " Recommended for validators."}
                                        {nodeType === "rpc" && " Recommended for RPC nodes serving current state."}
                                        {nodeType === "archival" && " Not recommended for archival nodes that need full historical data."}
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
                                        Fast bootstrap by syncing from a state summary instead of replaying all blocks.
                                        {nodeType === "validator" && " Recommended for validators to speed up initial sync."}
                                        {nodeType === "rpc" && " Recommended for RPC nodes."}
                                        {nodeType === "archival" && " Disable for archival nodes that need full historical data."}
                                    </p>
                                </div>

                                {/* Warning when pruning and state sync settings don't match */}
                                {pruningEnabled !== stateSyncEnabled && (
                                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            <strong>Mismatched settings:</strong> Pruning and State Sync are typically used together.
                                            {pruningEnabled && !stateSyncEnabled
                                                ? " Pruning is enabled but State Sync is disabled. For validators, enable both for optimal performance."
                                                : " State Sync is enabled but Pruning is disabled. For archival RPC nodes, disable both to preserve full history."}
                                        </p>
                                    </div>
                                )}
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
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                                href="https://build.avax.network/docs/nodes/chain-configs/c-chain"
                                                target="_blank"
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                                rel="noreferrer"
                                            >
                                                C-Chain configuration
                                            </a> documentation.
                                        </span>

                                        <div>
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Cache Settings</h4>

                                            <div className="space-y-3">
                                                <div onMouseEnter={() => setHighlightPath('trieCleanCache')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Trie Clean Cache (MB)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={trieCleanCache}
                                                        onChange={(e) => setTrieCleanCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('trieCleanCache')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('trieDirtyCache')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Trie Dirty Cache (MB)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={trieDirtyCache}
                                                        onChange={(e) => setTrieDirtyCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('trieDirtyCache')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('snapshotCache')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Snapshot Cache (MB)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={snapshotCache}
                                                        onChange={(e) => setSnapshotCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('snapshotCache')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('acceptedCacheSize')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Accepted Cache Size (blocks)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={acceptedCacheSize}
                                                        onChange={(e) => setAcceptedCacheSize(Math.max(1, parseInt(e.target.value) || 1))}
                                                        onFocus={() => setHighlightPath('acceptedCacheSize')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Depth of accepted headers and logs cache
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('trieDirtyCommitTarget')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Trie Dirty Commit Target (MB)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={trieDirtyCommitTarget}
                                                        onChange={(e) => setTrieDirtyCommitTarget(Math.max(1, parseInt(e.target.value) || 1))}
                                                        onFocus={() => setHighlightPath('trieDirtyCommitTarget')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Memory limit before commit
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('triePrefetcherParallelism')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Trie Prefetcher Parallelism
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={triePrefetcherParallelism}
                                                        onChange={(e) => setTriePrefetcherParallelism(Math.max(1, parseInt(e.target.value) || 1))}
                                                        onFocus={() => setHighlightPath('triePrefetcherParallelism')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Max concurrent disk reads
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('stateSyncServerTrieCache')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        State Sync Server Trie Cache (MB)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={stateSyncServerTrieCache}
                                                        onChange={(e) => setStateSyncServerTrieCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('stateSyncServerTrieCache')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Trie cache for state sync server
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Metrics Settings</h4>
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
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            Enable Expensive Metrics
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                        Enables debug-level metrics including Firewood metrics. May impact performance.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Performance Settings</h4>

                                            <div className="space-y-3">
                                                <div onMouseEnter={() => setHighlightPath('commitInterval')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Commit Interval (blocks)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={commitInterval}
                                                        onChange={(e) => setCommitInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                                        onFocus={() => setHighlightPath('commitInterval')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Interval to persist EVM and atomic tries
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('rpcGasCap')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        RPC Gas Cap
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={rpcGasCap}
                                                        onChange={(e) => setRpcGasCap(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('rpcGasCap')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Maximum gas limit for RPC calls
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('rpcTxFeeCap')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        RPC Tx Fee Cap (AVAX)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={rpcTxFeeCap}
                                                        onChange={(e) => setRpcTxFeeCap(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('rpcTxFeeCap')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Maximum transaction fee cap
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">API Limits</h4>

                                            <div className="space-y-3">
                                                <div onMouseEnter={() => setHighlightPath('batchRequestLimit')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Batch Request Limit
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={batchRequestLimit}
                                                        onChange={(e) => setBatchRequestLimit(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('batchRequestLimit')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Max batched requests (0 = no limit)
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('batchResponseMaxSize')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Batch Response Max Size (bytes)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={batchResponseMaxSize}
                                                        onChange={(e) => setBatchResponseMaxSize(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('batchResponseMaxSize')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Max batch response size (default: 25MB)
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Transaction & State</h4>

                                            <div className="space-y-3">
                                                <div onMouseEnter={() => setHighlightPath('transactionHistory')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Transaction History (blocks)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={transactionHistory}
                                                        onChange={(e) => setTransactionHistory(Math.max(0, parseInt(e.target.value) || 0))}
                                                        onFocus={() => setHighlightPath('transactionHistory')}
                                                        onBlur={clearHighlight}
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Max blocks to keep tx indices. 0 = archive mode (all history)
                                                    </p>
                                                </div>

                                                <div onMouseEnter={() => setHighlightPath('skipTxIndexing')} onMouseLeave={clearHighlight}>
                                                    <label className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={!skipTxIndexing}
                                                            onChange={(e) => setSkipTxIndexing(!e.target.checked)}
                                                            onFocus={() => setHighlightPath('skipTxIndexing')}
                                                            onBlur={clearHighlight}
                                                            className="rounded"
                                                        />
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            Enable Transaction Indexing
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                        Index transactions for querying (uses more disk space)
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
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            Enable Preimages
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
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
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            Enable Local Transactions
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                        Treat local account txs as local
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {nodeType === "validator" && (
                                            <div className="border-t pt-3">
                                                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Block Timing (Validator)</h4>
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-start gap-1">
                                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>C-Chain has sub-second block times. Only modify if you understand the consensus implications.</span>
                                                </p>

                                                <div className="space-y-3">
                                                    <div onMouseEnter={() => setHighlightPath('minDelayTarget')} onMouseLeave={clearHighlight}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-xs text-zinc-600 dark:text-zinc-400">
                                                                Min Delay Target
                                                            </label>
                                                            <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                                                {minDelayTarget === 0 ? "default" : `${minDelayTarget}ms`}
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
                                                            step="100"
                                                            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                        <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                                                            <span>0 (default)</span>
                                                            <span>1000ms</span>
                                                            <span>2000ms</span>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                            Set to 0 to use node default (recommended). Non-zero values vote on block timing.
                                                        </p>
                                                    </div>

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
                                                            Number of validators to push gossip to (default: 100)
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
                                                            Percentage of total stake to gossip to (default: 0.9)
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {isRPC && (
                                            <div className="border-t pt-3">
                                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">RPC-Specific Settings</h4>

                                                <div className="space-y-3">
                                                    <div onMouseEnter={() => setHighlightPath('apiMaxBlocksPerRequest')} onMouseLeave={clearHighlight}>
                                                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                            API Max Blocks Per Request
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={apiMaxBlocksPerRequest}
                                                            onChange={(e) => setApiMaxBlocksPerRequest(Math.max(0, parseInt(e.target.value) || 0))}
                                                            onFocus={() => setHighlightPath('apiMaxBlocksPerRequest')}
                                                            onBlur={clearHighlight}
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                        />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                                                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                                                Allow Unfinalized Queries
                                                            </span>
                                                        </label>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                            When enabled, allows queries using block tags like <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">pending</code>, <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">safe</code>, and <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">latest</code> that may return data from blocks not yet finalized.
                                                        </p>
                                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-6">
                                                            <strong>Important:</strong> Enable this if your applications use these block tags (common in Ethereum tooling). Without this, only <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">finalized</code> queries are allowed, which may break some dApps.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t pt-3">
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Profiling (Optional)</h4>

                                            <div className="space-y-3">
                                                <div onMouseEnter={() => setHighlightPath('continuousProfilerDir')} onMouseLeave={clearHighlight}>
                                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                        Continuous Profiler Directory
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={continuousProfilerDir}
                                                        onChange={(e) => setContinuousProfilerDir(e.target.value)}
                                                        onFocus={() => setHighlightPath('continuousProfilerDir')}
                                                        onBlur={clearHighlight}
                                                        placeholder="./profiles (leave empty to disable)"
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Directory for continuous profiler output
                                                    </p>
                                                </div>

                                                {continuousProfilerDir && (
                                                    <div onMouseEnter={() => setHighlightPath('continuousProfilerFrequency')} onMouseLeave={clearHighlight}>
                                                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                            Profiler Frequency
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={continuousProfilerFrequency}
                                                            onChange={(e) => setContinuousProfilerFrequency(e.target.value)}
                                                            onFocus={() => setHighlightPath('continuousProfilerFrequency')}
                                                            onBlur={clearHighlight}
                                                            placeholder="15m"
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                        />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                                            {configJson.startsWith("Error:") ? configJson : "Configure your node to see the chain config"}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Storage Requirements Visualization */}
                            <StorageRequirements
                                nodeType={nodeType}
                                pruningEnabled={pruningEnabled}
                                skipTxIndexing={skipTxIndexing}
                                stateSyncEnabled={stateSyncEnabled}
                                debugEnabled={enableDebugTrace}
                                network={selectedNetwork}
                            />
                        </div>
                    </div>
                    </Step>

                    <Step>
                        <h3 className="text-xl font-bold mb-4">Create Configuration File</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Run this command on your server to create the C-Chain configuration file:
                        </p>

                        <DynamicCodeBlock lang="bash" code={getConfigFileCommand()} />

                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            This creates the configuration file at <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">~/.avalanchego/configs/chains/{C_CHAIN_ID}/config.json</code>
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
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
                                href="https://build.avax.network/docs/nodes/chain-configs/c-chain"
                                target="_blank"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                rel="noreferrer"
                            >
                                C-Chain configuration
                            </a>
                        </p>
                    </Step>

                    <Step>
                    <h3 className="text-xl font-bold mb-4">Run Docker Command</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Start the node using Docker:
                    </p>

                    <DynamicCodeBlock lang="bash" code={getDockerCommand()} />

                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        The container will read the config from <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">~/.avalanchego/configs/chains/{C_CHAIN_ID}/config.json</code> via the mounted volume.
                    </p>

                    <Accordions type="single" className="mt-4">
                            <Accordion title="Running Multiple Nodes on the same machine">
                            <p className="text-sm">To run multiple nodes on the same machine, ensure each node has:</p>
                            <ul className="list-disc pl-5 mt-1 text-sm">
                                    <li>Unique container name (change <code>--name</code> parameter)</li>
                                <li>Different ports (modify port mappings)</li>
                                <li>Separate data directories (change <code>~/.avalanchego</code> path)</li>
                                </ul>
                            <p className="mt-1 text-sm">Example for second node: Use ports 9652/9653, container name &quot;avago2&quot;, and data directory &quot;~/.avalanchego2&quot;</p>
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
                                chainId={C_CHAIN_ID}
                                showHealthCheck={true}
                            />
                        </Step>
                    )}

                    {nodeType === "validator" && (
                        <>
                        <Step>
                        <h3 className="text-xl font-bold mb-4">Wait for the Node to Bootstrap</h3>
                            <p>Your node will now bootstrap and sync the Primary Network (P-Chain, X-Chain, and C-Chain). This process can take <strong>several hours to days</strong> depending on your hardware and network connection.</p>

                            <p className="mt-4">You can follow the process by checking the logs with the following command:</p>

                            <DynamicCodeBlock lang="bash" code="docker logs -f avago" />

                            <Accordions type="single" className="mt-8">
                                <Accordion title="Understanding the Logs">
                                    <p>The bootstrapping process involves syncing all three chains:</p>

                                    <ul className="list-disc pl-5 mt-1">
                                        <li>
                                            <strong>P-Chain (Platform Chain):</strong> Handles platform operations and staking
                                            <DynamicCodeBlock lang="bash" code='[05-04|17:14:13.793] INFO <P Chain> bootstrap/bootstrapper.go:615 fetching blocks {"numFetchedBlocks": 10099, "numTotalBlocks": 23657, "eta": "37s"}' />
                                        </li>
                                        <li>
                                            <strong>X-Chain (Exchange Chain):</strong> Handles asset creation and exchange
                                            <DynamicCodeBlock lang="bash" code='[05-04|17:14:45.641] INFO <X Chain> bootstrap/storage.go:244 executing blocks {"numExecuted": 9311, "numToExecute": 23657, "eta": "15s"}' />
                                        </li>
                                        <li>
                                            <strong>C-Chain (Contract Chain):</strong> EVM-compatible smart contract chain
                                            <DynamicCodeBlock lang="bash" code='[05-04|17:15:12.123] INFO <C Chain> chain/chain_state_manager.go:325 syncing {"current": 1234567, "target": 2345678}' />
                                        </li>
                                    </ul>
                                </Accordion>
                            </Accordions>

                        </Step>

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
                                    <div className="text-[10px] text-red-400 mt-1">P-Chain signing</div>
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
                                    <span>Lost keys = <strong className="text-zinc-700 dark:text-zinc-300">missed staking rewards</strong> (validator can&apos;t sign). NVMe drives can fail without warning.</span>
                                </p>
                                <p className="flex items-start gap-1.5">
                                    <span className="text-amber-500 mt-0.5">🔒</span>
                                    <span>Never share private keys — anyone with them can impersonate your validator.</span>
                                </p>
                            </div>

                            {/* Links */}
                            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 text-xs">
                                <a href="/docs/nodes/maintain/cube-signer-sidecar" className="text-blue-500 hover:underline flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    CubeSigner Remote Signing
                                </a>
                                <a href="/docs/nodes/maintain/backup-restore" className="text-blue-500 hover:underline flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                    </svg>
                                    Full Backup Guide
                                </a>
                            </div>
                        </Step>
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

export default function AvalancheGoDockerPrimaryNetwork() {
    return (
        <GenesisHighlightProvider>
            <AvalancheGoDockerPrimaryNetworkInner />
        </GenesisHighlightProvider>
    );
}
