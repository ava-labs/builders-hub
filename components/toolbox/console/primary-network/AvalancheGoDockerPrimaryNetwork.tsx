"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Container } from "@/components/toolbox/components/Container";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { DockerInstallation } from "@/components/toolbox/components/DockerInstallation";
import { NodeBootstrapCheck } from "@/components/toolbox/components/NodeBootstrapCheck";
import { ReverseProxySetup } from "@/components/toolbox/components/ReverseProxySetup";
import { Button } from "@/components/toolbox/components/Button";
import { SyntaxHighlightedJSON } from "@/components/toolbox/components/genesis/SyntaxHighlightedJSON";
import { GenesisHighlightProvider, useGenesisHighlight } from "@/components/toolbox/components/genesis/GenesisHighlightContext";
import { generateChainConfig, generateConfigFileCommand } from "@/components/toolbox/console/layer-1/node-config";
import { useNodeConfigHighlighting } from "@/components/toolbox/console/layer-1/useNodeConfigHighlighting";
import { C_CHAIN_ID } from "@/components/toolbox/console/layer-1/create/config";
import { getContainerVersions } from "@/components/toolbox/utils/containerVersions";

function AvalancheGoDockerPrimaryNetworkInner() {
    const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();
    const [nodeType, setNodeType] = useState<"validator" | "public-rpc">("validator");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [adminApiEnabled, setAdminApiEnabled] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [logLevel, setLogLevel] = useState<string>("info");
    const [minDelayTarget, setMinDelayTarget] = useState<number>(1200);
    const [configJson, setConfigJson] = useState<string>("");
    const [nodeIsReady, setNodeIsReady] = useState<boolean>(false);

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
    const [batchRequestLimit, setBatchRequestLimit] = useState<number>(0);
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

    const { avalancheNetworkID } = useWalletStore();

    const isRPC = nodeType === "public-rpc";

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
                continuousProfilerFrequency
            );
            setConfigJson(JSON.stringify(config, null, 2));
        } catch (error) {
            setConfigJson(`Error: ${(error as Error).message}`);
        }
    }, [nodeType, enableDebugTrace, adminApiEnabled, pruningEnabled, logLevel, minDelayTarget, trieCleanCache, trieDirtyCache, trieDirtyCommitTarget, triePrefetcherParallelism, snapshotCache, commitInterval, stateSyncServerTrieCache, rpcGasCap, rpcTxFeeCap, apiMaxBlocksPerRequest, allowUnfinalizedQueries, batchRequestLimit, batchResponseMaxSize, acceptedCacheSize, transactionHistory, stateSyncEnabled, skipTxIndexing, preimagesEnabled, localTxsEnabled, pushGossipNumValidators, pushGossipPercentStake, continuousProfilerDir, continuousProfilerFrequency]);

    useEffect(() => {
        if (nodeType === "validator") {
            // Validator node defaults
            setDomain("");
            setEnableDebugTrace(false);
            setAdminApiEnabled(false);
            setPruningEnabled(true);
            setLogLevel("info");
            setMinDelayTarget(1200);
            setAllowUnfinalizedQueries(false);
            setStateSyncEnabled(true); // Validators benefit from fast sync
            setTrieCleanCache(512);
            setTrieDirtyCache(512);
            setSnapshotCache(256);
            setAcceptedCacheSize(32);
            setTransactionHistory(0);
        } else if (nodeType === "public-rpc") {
            // RPC node defaults
            setPruningEnabled(false);
            setLogLevel("info");
            setAllowUnfinalizedQueries(true);
            setStateSyncEnabled(false); // RPC nodes need full historical data
            setTrieCleanCache(1024);
            setTrieDirtyCache(1024);
            setSnapshotCache(512);
            setAcceptedCacheSize(64);
            setTransactionHistory(0);
        }
    }, [nodeType]);

    useEffect(() => {
        if (!isRPC) {
            setDomain("");
        }
    }, [isRPC]);

    const handleReset = () => {
        setNodeType("validator");
        setDomain("");
        setEnableDebugTrace(false);
        setAdminApiEnabled(false);
        setPruningEnabled(true);
        setLogLevel("info");
        setMinDelayTarget(1200);
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
        setNodeIsReady(false);
    };

    // Generate Docker command for Primary Network (using file-based config)
    const getDockerCommand = () => {
        try {
            const isTestnet = avalancheNetworkID === 5;
            const versions = getContainerVersions(isTestnet);
            
            const env: Record<string, string> = {
                AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns",
                AVAGO_HTTP_HOST: "0.0.0.0",
                AVAGO_CHAIN_CONFIG_DIR: "/root/.avalanchego/configs/chains"
            };

            // Set network ID
            if (avalancheNetworkID === 5) {
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
                        <h3 className="text-xl font-bold mb-4">Set up Instance</h3>
                        <p>Set up a linux server with any cloud provider, like AWS, GCP, Azure, or Digital Ocean. For Primary Network nodes, we recommend:</p>
                        <ul className="list-disc pl-5 mt-2 mb-4">
                            <li><strong>Minimum specs:</strong> 8 vCPUs, 16GB RAM, 1TB storage</li>
                            <li><strong>Recommended specs:</strong> 16 vCPUs, 32GB RAM, 2TB NVMe SSD</li>
                        </ul>
                    <p>If you do not have access to a server, you can also run a node for educational purposes locally. Simply select the &quot;Public RPC Node&quot; option in the next step.</p>
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
                    <h3 className="text-xl font-bold mb-4">Configure Node Settings</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Node Type
                                </label>
                                <select
                                    value={nodeType}
                                    onChange={(e) => setNodeType(e.target.value as "validator" | "public-rpc")}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="validator">Validator Node</option>
                                    <option value="public-rpc">Public RPC Node</option>
                                </select>
                            </div>

                            <div onMouseEnter={() => setHighlightPath('logLevel')} onMouseLeave={clearHighlight}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Log Level
                                </label>
                                <select
                                    value={logLevel}
                                    onChange={(e) => setLogLevel(e.target.value)}
                                    onFocus={() => setHighlightPath('logLevel')}
                                    onBlur={clearHighlight}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="off">Off - No logs</option>
                                    <option value="fatal">Fatal - Only fatal errors</option>
                                    <option value="error">Error - Recoverable errors</option>
                                    <option value="warn">Warn - Warnings</option>
                                    <option value="info">Info - Status updates (default)</option>
                                    <option value="trace">Trace - Container job results</option>
                                    <option value="debug">Debug - Debugging information</option>
                                    <option value="verbo">Verbo - Verbose output</option>
                                </select>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Controls the verbosity of node logs
                                </p>
                            </div>

                            {nodeType === "validator" && (
                                <div onMouseEnter={() => setHighlightPath('minDelayTarget')} onMouseLeave={clearHighlight}>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Min Delay Target (ms)
                                            </label>
                                            <input
                                                type="number"
                                        value={minDelayTarget}
                                                onChange={(e) => {
                                                    const value = Math.min(2000, Math.max(0, parseInt(e.target.value) || 0));
                                                    setMinDelayTarget(value);
                                                }}
                                        onFocus={() => setHighlightPath('minDelayTarget')}
                                        onBlur={clearHighlight}
                                                min="0"
                                                max="2000"
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        The minimum delay between blocks (in milliseconds). Maximum: 2000ms. Default: 1200ms.
                                    </p>
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
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {nodeType === "validator"
                                        ? "Recommended for validators. Reduces disk usage by removing old state data."
                                        : "Not recommended for RPC nodes that need full historical data."}
                                </p>
                            </div>

                            {nodeType === "public-rpc" && (
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
                                                            checked={skipTxIndexing}
                                                            onChange={(e) => setSkipTxIndexing(e.target.checked)}
                                                            onFocus={() => setHighlightPath('skipTxIndexing')}
                                                            onBlur={clearHighlight}
                                                            className="rounded"
                                                        />
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            Skip Transaction Indexing
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
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
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                                            Enable State Sync
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
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
                                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Gossip Settings (Validator)</h4>

                                                <div className="space-y-3">
                                                    <div onMouseEnter={() => setHighlightPath('pushGossipNumValidators')} onMouseLeave={clearHighlight}>
                                                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                            Push Gossip Num Validators
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={pushGossipNumValidators}
                                                            onChange={(e) => setPushGossipNumValidators(Math.max(0, parseInt(e.target.value) || 0))}
                                                            onFocus={() => setHighlightPath('pushGossipNumValidators')}
                                                            onBlur={clearHighlight}
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                        />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            Number of validators to push gossip to
                                                        </p>
                                                    </div>

                                                    <div onMouseEnter={() => setHighlightPath('pushGossipPercentStake')} onMouseLeave={clearHighlight}>
                                                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
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
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                        />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            Percentage of total stake to gossip to (0-1)
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
                                                            Allows queries for unfinalized/pending blocks
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

                    {nodeType === "public-rpc" && (
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

                            <NodeBootstrapCheck
                                chainId={C_CHAIN_ID}
                                domain={domain || "127.0.0.1:9650"}
                                isDebugTrace={enableDebugTrace}
                                onBootstrapCheckChange={(checked: boolean) => setNodeIsReady(checked)}
                            />
                        </Step>
                    )}

                    {nodeIsReady && nodeType === "validator" && (
                        <Step>
                            <h3 className="text-xl font-bold mb-4">Node Setup Complete</h3>
                            <p>Your AvalancheGo Primary Network node is now fully bootstrapped and ready to be used as a validator node.</p>

                            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                            Node is ready for validation
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                            Your node has successfully synced with the Primary Network and is ready to be added as a validator.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Step>
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
