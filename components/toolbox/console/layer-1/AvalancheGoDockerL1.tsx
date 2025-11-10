"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Container } from "../../components/Container";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import InputSubnetId from "../../components/InputSubnetId";
import BlockchainDetailsDisplay from "../../components/BlockchainDetailsDisplay";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Button } from "../../components/Button";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { SyntaxHighlightedJSON } from "../../components/genesis/SyntaxHighlightedJSON";
import { ReverseProxySetup } from "../../components/ReverseProxySetup";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { generateChainConfig, generateDockerCommand, generateConfigFileCommand } from "./node-config";

export default function AvalanchegoDocker() {
    const [chainId, setChainId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [nodeType, setNodeType] = useState<"validator" | "public-rpc">("validator");
    const [domain, setDomain] = useState("");
    const [enableDebugTrace, setEnableDebugTrace] = useState<boolean>(false);
    const [pruningEnabled, setPruningEnabled] = useState<boolean>(true);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [selectedRPCBlockchainId, setSelectedRPCBlockchainId] = useState<string>("");
    const [minDelayTarget, setMinDelayTarget] = useState<number>(250);
    const [configJson, setConfigJson] = useState<string>("");
    
    // Advanced cache settings
    const [trieCleanCache, setTrieCleanCache] = useState<number>(512);
    const [trieDirtyCache, setTrieDirtyCache] = useState<number>(512);
    const [snapshotCache, setSnapshotCache] = useState<number>(256);
    const [commitInterval, setCommitInterval] = useState<number>(4096);
    
    // API settings
    const [rpcGasCap, setRpcGasCap] = useState<number>(50000000);
    const [apiMaxBlocksPerRequest, setApiMaxBlocksPerRequest] = useState<number>(0);
    const [allowUnfinalizedQueries, setAllowUnfinalizedQueries] = useState<boolean>(false);
    
    // State and history
    const [acceptedCacheSize, setAcceptedCacheSize] = useState<number>(32);
    const [transactionHistory, setTransactionHistory] = useState<number>(0);
    
    // Show advanced settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

    const { avalancheNetworkID } = useWalletStore();

    const isRPC = nodeType === "public-rpc";

    // Generate Subnet-EVM chain configuration JSON when parameters change
    useEffect(() => {
        if (!subnetId || !chainId || !blockchainInfo) {
            setConfigJson("");
            return;
        }

        try {
            const config = generateChainConfig(
                nodeType,
                enableDebugTrace,
                pruningEnabled,
                minDelayTarget,
                trieCleanCache,
                trieDirtyCache,
                snapshotCache,
                commitInterval,
                rpcGasCap,
                apiMaxBlocksPerRequest,
                allowUnfinalizedQueries,
                acceptedCacheSize,
                transactionHistory
            );
            setConfigJson(JSON.stringify(config, null, 2));
        } catch (error) {
            setConfigJson(`Error: ${(error as Error).message}`);
        }
    }, [subnetId, chainId, nodeType, enableDebugTrace, pruningEnabled, blockchainInfo, minDelayTarget, trieCleanCache, trieDirtyCache, snapshotCache, commitInterval, rpcGasCap, apiMaxBlocksPerRequest, allowUnfinalizedQueries, acceptedCacheSize, transactionHistory]);

    useEffect(() => {
        if (nodeType === "validator") {
            // Validator node defaults - optimized for block production
            setDomain("");
            setEnableDebugTrace(false);
            setPruningEnabled(true);
            setMinDelayTarget(250); // Fast block times for L1
            setAllowUnfinalizedQueries(false);
            // Standard cache sizes for validators
            setTrieCleanCache(512);
            setTrieDirtyCache(512);
            setSnapshotCache(256);
            setAcceptedCacheSize(32);
            setTransactionHistory(0); // Keep all tx history by default
        } else if (nodeType === "public-rpc") {
            // RPC node defaults - optimized for query performance
            setAllowUnfinalizedQueries(true); // Enable real-time queries
            // Larger caches for better RPC performance
            setTrieCleanCache(1024); // 2x for better read performance
            setTrieDirtyCache(1024);
            setSnapshotCache(512); // 2x for snapshot queries
            setAcceptedCacheSize(64); // Larger for more recent history
            setTransactionHistory(0); // Keep all tx history by default for getLogs
        }
    }, [nodeType]);

    useEffect(() => {
        setSubnetIdError(null);
        setChainId("");
        setSubnet(null);
        setBlockchainInfo(null);
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
        setNodeType("validator");
        setDomain("");
        setEnableDebugTrace(false);
        setPruningEnabled(true);
        setSubnetIdError(null);
        setSelectedRPCBlockchainId("");
        setMinDelayTarget(250);
        setConfigJson("");
        setTrieCleanCache(512);
        setTrieDirtyCache(512);
        setSnapshotCache(256);
        setCommitInterval(4096);
        setRpcGasCap(50000000);
        setApiMaxBlocksPerRequest(0);
        setAllowUnfinalizedQueries(false);
        setAcceptedCacheSize(32);
        setTransactionHistory(0);
        setShowAdvancedSettings(false);
    };

    // Check if this blockchain uses a custom VM
    const isCustomVM = blockchainInfo && blockchainInfo.vmId !== SUBNET_EVM_VM_ID;

    return (
            <Container
                title="L1 Node Setup with Docker"
            description="Configure your node settings, preview the Subnet-EVM chain config, create it on your server, and run Docker to start your L1 node."
                githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/layer-1/AvalancheGoDockerL1.tsx"
            >
                <Steps>
                    <Step>
                    <h3 className="text-xl font-bold mb-4">Select L1</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                                            isTestnet: avalancheNetworkID === networkIDs.FujiID
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

                                    {nodeType === "public-rpc" && (
                                        <>
                                            <div>
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={enableDebugTrace}
                                                        onChange={(e) => setEnableDebugTrace(e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm">Enable Debug Trace</span>
                                                </label>
                                            </div>

                                            <div>
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={pruningEnabled}
                                                        onChange={(e) => setPruningEnabled(e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm">Enable Pruning</span>
                                                </label>
                                            </div>

                                            {subnet && subnet.blockchains && subnet.blockchains.length > 1 && (
                                                <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Select Blockchain for RPC Endpoint
                                            </label>
                                            <select
                                                value={selectedRPCBlockchainId}
                                                onChange={(e) => setSelectedRPCBlockchainId(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            >
                                                {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string }) => (
                                                    <option key={blockchain.blockchainId} value={blockchain.blockchainId}>
                                                        {blockchain.blockchainName} ({blockchain.blockchainId})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                This blockchain will be used for the RPC endpoint URL generation.
                                            </p>
                                        </div>
                                            )}
                                        </>
                                    )}

                                    {nodeType === "validator" && (
                                        <div>
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
                                                min="0"
                                                max="2000"
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            />
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                The minimum delay between blocks (in milliseconds). Maximum: 2000ms. Default: 250ms.
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
                                                <div>
                                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Cache Settings</h4>
                                                    
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                Trie Clean Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={trieCleanCache}
                                                                onChange={(e) => setTrieCleanCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                Trie Dirty Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={trieDirtyCache}
                                                                onChange={(e) => setTrieDirtyCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                Snapshot Cache (MB)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={snapshotCache}
                                                                onChange={(e) => setSnapshotCache(Math.max(0, parseInt(e.target.value) || 0))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                Accepted Cache Size (blocks)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={acceptedCacheSize}
                                                                onChange={(e) => setAcceptedCacheSize(Math.max(1, parseInt(e.target.value) || 1))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                Depth of accepted headers and logs cache
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t pt-3">
                                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Performance Settings</h4>
                                                    
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                Commit Interval (blocks)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={commitInterval}
                                                                onChange={(e) => setCommitInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                Interval to persist EVM and atomic tries
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                RPC Gas Cap
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={rpcGasCap}
                                                                onChange={(e) => setRpcGasCap(Math.max(0, parseInt(e.target.value) || 0))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                Maximum gas limit for RPC calls
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                Transaction History (blocks)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={transactionHistory}
                                                                onChange={(e) => setTransactionHistory(Math.max(0, parseInt(e.target.value) || 0))}
                                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                            />
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                Maximum blocks from head to keep tx indices. 0 = no limit (archive mode)
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {isRPC && (
                                                    <div className="border-t pt-3">
                                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">RPC Settings</h4>
                                                        
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                                    API Max Blocks Per Request
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={apiMaxBlocksPerRequest}
                                                                    onChange={(e) => setApiMaxBlocksPerRequest(Math.max(0, parseInt(e.target.value) || 0))}
                                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                                                />
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                    0 = no limit. Limits blocks per getLogs request
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <label className="flex items-center space-x-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allowUnfinalizedQueries}
                                                                        onChange={(e) => setAllowUnfinalizedQueries(e.target.checked)}
                                                                        className="rounded"
                                                                    />
                                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                                        Allow Unfinalized Queries
                                                                    </span>
                                                                </label>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                                    Allows queries for unfinalized blocks
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
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
                                                    highlightedLine={null}
                                                />
                                            ) : (
                                                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                                                    {configJson.startsWith("Error:") ? configJson : "Configure your node to see the Subnet-EVM chain config"}
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
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                This creates the configuration file at <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">~/.avalanchego/configs/chains/{chainId}/config.json</code>
                            </p>

                            <Accordions type="single" className="mt-4">
                                <Accordion title="Understanding the Configuration">
                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <p><strong>Basic Settings:</strong></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><strong>pruning-enabled:</strong> Enables state pruning to save disk space</li>
                                            <li><strong>log-level:</strong> Logging level (trace, debug, info, warn, error, crit)</li>
                                            <li><strong>min-delay-target:</strong> Minimum delay between blocks in milliseconds</li>
                                            <li><strong>warp-api-enabled:</strong> Enables the Warp API for cross-chain messaging (ICM)</li>
                                            <li><strong>eth-apis:</strong> List of enabled Ethereum API namespaces</li>
                                        </ul>
                                        
                                        <p className="pt-2"><strong>Cache Settings:</strong></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><strong>trie-clean-cache:</strong> Size of the trie clean cache in MB (validator: 512, RPC: 1024)</li>
                                            <li><strong>trie-dirty-cache:</strong> Size of the trie dirty cache in MB (validator: 512, RPC: 1024)</li>
                                            <li><strong>snapshot-cache:</strong> Size of the snapshot disk layer clean cache in MB (validator: 256, RPC: 512)</li>
                                            <li><strong>accepted-cache-size:</strong> Depth to keep in accepted headers/logs cache (validator: 32, RPC: 64)</li>
                                        </ul>

                                        <p className="pt-2"><strong>Performance Settings:</strong></p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><strong>commit-interval:</strong> Interval to persist EVM and atomic tries in blocks (default: 4096)</li>
                                            <li><strong>rpc-gas-cap:</strong> Maximum gas limit for RPC calls (default: 50,000,000)</li>
                                            <li><strong>transaction-history:</strong> Max blocks from head to keep tx indices. 0 = archive mode (all history)</li>
                                        </ul>

                                        {isRPC && (
                                            <>
                                                <p className="pt-2"><strong>RPC-Specific Settings:</strong></p>
                                                <ul className="list-disc pl-5 space-y-1">
                                                    <li><strong>api-max-duration:</strong> Maximum duration for API calls (0 = no limit)</li>
                                                    <li><strong>api-max-blocks-per-request:</strong> Maximum blocks per getLogs request (0 = no limit)</li>
                                                    <li><strong>allow-unfinalized-queries:</strong> Allows queries for unfinalized/pending blocks</li>
                                                </ul>
                                            </>
                                        )}

                                        {enableDebugTrace && (
                                            <>
                                                <p className="pt-2"><strong>Debug Settings:</strong></p>
                                                <ul className="list-disc pl-5 space-y-1">
                                                    <li><strong>eth-apis:</strong> Extended APIs including debug-tracer, debug-file-tracer, internal-* APIs</li>
                                                    <li><strong>admin-api-enabled:</strong> Enables administrative operations API</li>
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </Accordion>

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
                            </Accordions>
                        </Step>

                        <Step>
                            <h3 className="text-xl font-bold mb-4">Run Docker Command</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                                            avalancheNetworkID,
                                            vmId
                                        );
                                    } catch {
                                        return "# Error generating Docker command";
                                    }
                                })()} 
                            />

                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                The container will read the config from <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">~/.avalanchego/configs/chains/{chainId}/config.json</code> via the mounted volume.
                            </p>

                            <Accordions type="single" className="mt-4">
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

                                <Accordion title="Advanced Configuration">
                                    <p className="text-sm">
                                    For advanced node configuration options, see the{" "}
                                    <a
                                        href="https://build.avax.network/docs/nodes/configure/configs-flags"
                                        target="_blank"
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                        rel="noreferrer"
                                    >
                                        AvalancheGo configuration flags documentation
                                    </a>.
                                </p>
                                    </Accordion>
                                </Accordions>
                            </Step>

                            {nodeType === "public-rpc" && (
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
};
