// Node configuration generation for L1 Docker setup
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import { getContainerVersions } from '@/components/toolbox/utils/containerVersions';

/**
 * Generates the Subnet-EVM chain configuration
 * This configuration is saved to ~/.avalanchego/configs/chains/<blockchainID>/config.json
 */
export const generateChainConfig = (
    nodeType: 'validator' | 'public-rpc',
    enableDebugTrace: boolean = false,
    pruningEnabled: boolean = true,
    minDelayTarget: number = 250,
    trieCleanCache: number = 512,
    trieDirtyCache: number = 512,
    trieDirtyCommitTarget: number = 20,
    triePrefetcherParallelism: number = 16,
    snapshotCache: number = 256,
    commitInterval: number = 4096,
    stateSyncServerTrieCache: number = 64,
    rpcGasCap: number = 50000000,
    rpcTxFeeCap: number = 100,
    apiMaxBlocksPerRequest: number = 0,
    allowUnfinalizedQueries: boolean = false,
    batchRequestLimit: number = 1000,
    batchResponseMaxSize: number = 25000000,
    acceptedCacheSize: number = 32,
    transactionHistory: number = 0,
    stateSyncEnabled: boolean = false,
    skipTxIndexing: boolean = false,
    preimagesEnabled: boolean = false,
    localTxsEnabled: boolean = false,
    pushGossipNumValidators: number = 100,
    pushGossipPercentStake: number = 0.9,
    continuousProfilerDir: string = "",
    continuousProfilerFrequency: string = "15m"
) => {
    const isRPC = nodeType === 'public-rpc';

    // Base configuration for all nodes
    const config: any = {
        "pruning-enabled": pruningEnabled,
        "commit-interval": commitInterval,
        "trie-clean-cache": trieCleanCache,
        "trie-dirty-cache": trieDirtyCache,
        "trie-dirty-commit-target": trieDirtyCommitTarget,
        "trie-prefetcher-parallelism": triePrefetcherParallelism,
        "snapshot-cache": snapshotCache,
        "state-sync-server-trie-cache": stateSyncServerTrieCache,
        "rpc-gas-cap": rpcGasCap,
        "rpc-tx-fee-cap": rpcTxFeeCap,
        "log-level": enableDebugTrace ? "debug" : "info",
        "metrics-expensive-enabled": true,
        "accepted-cache-size": acceptedCacheSize,
        "min-delay-target": minDelayTarget,
        "batch-request-limit": batchRequestLimit,
        "batch-response-max-size": batchResponseMaxSize
    };

    // Add warp API for cross-chain messaging (enabled by default for L1s)
    config["warp-api-enabled"] = true;

    // State sync configuration
    config["state-sync-enabled"] = stateSyncEnabled;

    // Transaction indexing
    if (skipTxIndexing) {
        config["skip-tx-indexing"] = true;
    } else if (transactionHistory > 0) {
        config["transaction-history"] = transactionHistory;
    }

    // Transaction settings
    if (preimagesEnabled) {
        config["preimages-enabled"] = true;
    }
    if (localTxsEnabled) {
        config["local-txs-enabled"] = true;
    }

    // Configure APIs based on node type
    if (enableDebugTrace) {
        config["eth-apis"] = [
            "eth",
            "eth-filter",
            "net",
            "admin",
            "web3",
            "internal-eth",
            "internal-blockchain",
            "internal-transaction",
            "internal-debug",
            "internal-account",
            "internal-personal",
            "debug",
            "debug-tracer",
            "debug-file-tracer",
            "debug-handler"
        ];
        config["admin-api-enabled"] = true;
    } else {
        // Standard APIs (includes internal APIs required for basic eth methods)
        config["eth-apis"] = [
            "eth",
            "eth-filter",
            "net",
            "web3",
            "internal-eth",
            "internal-blockchain",
            "internal-transaction"
        ];
    }

    // RPC-specific settings
    if (isRPC) {
        config["api-max-duration"] = 0; // No time limit
        config["api-max-blocks-per-request"] = apiMaxBlocksPerRequest;
        config["allow-unfinalized-queries"] = allowUnfinalizedQueries;
    }

    // Gossip settings (primarily for validators)
    if (nodeType === 'validator') {
        config["push-gossip-num-validators"] = pushGossipNumValidators;
        config["push-gossip-percent-stake"] = pushGossipPercentStake;
    }

    // Continuous profiling (if enabled)
    if (continuousProfilerDir) {
        config["continuous-profiler-dir"] = continuousProfilerDir;
        config["continuous-profiler-frequency"] = continuousProfilerFrequency;
    }

    return config;
};

/**
 * Metadata object to store deployment information (separate from chain config)
 */
export const generateDeploymentMetadata = (
    subnetId: string,
    blockchainId: string,
    nodeType: 'validator' | 'public-rpc',
    networkID: number,
    vmId: string = SUBNET_EVM_VM_ID,
    domain?: string
) => {
    const isTestnet = networkID === 5;
    const isCustomVM = vmId !== SUBNET_EVM_VM_ID;

    return {
        "deployment": {
            "network": isTestnet ? "fuji" : "mainnet",
            "networkID": networkID,
            "subnetId": subnetId,
            "blockchainId": blockchainId,
            "vmId": vmId,
            "isCustomVM": isCustomVM,
            "nodeType": nodeType,
            "domain": domain || null,
            "timestamp": new Date().toISOString()
        }
    };
};

/**
 * Generates base64-encoded chain config for environment variable
 */
export const encodeChainConfig = (
    blockchainId: string,
    chainConfig: any
) => {
    const chainConfigMap: Record<string, any> = {};
    chainConfigMap[blockchainId] = {
        "Config": btoa(JSON.stringify(chainConfig)),
        "Upgrade": null
    };
    return btoa(JSON.stringify(chainConfigMap));
};

/**
 * Generates a command to create the chain config file in the correct location
 */
export const generateConfigFileCommand = (
    blockchainId: string,
    chainConfig: any
) => {
    const configJson = JSON.stringify(chainConfig, null, 2);
    const configPath = `~/.avalanchego/configs/chains/${blockchainId}`;

    // Escape single quotes in the JSON for the shell command
    const escapedJson = configJson.replace(/'/g, "'\\''");

    return `# Create the chain config directory and file
mkdir -p ${configPath} && cat > ${configPath}/config.json << 'EOF'
${configJson}
EOF`;
};

/**
 * Generates the complete Docker command
 * The chain config is read from the mounted volume at ~/.avalanchego/configs/chains/<blockchainID>/config.json
 */
export const generateDockerCommand = (
    subnetId: string,
    blockchainId: string,
    chainConfig: any,
    nodeType: 'validator' | 'public-rpc',
    networkID: number,
    vmId: string = SUBNET_EVM_VM_ID
) => {
    const isRPC = nodeType === 'public-rpc';
    const isTestnet = networkID === 5; // Fuji
    const isCustomVM = vmId !== SUBNET_EVM_VM_ID;
    const versions = getContainerVersions(isTestnet);

    const env: Record<string, string> = {
        AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns",
        AVAGO_HTTP_HOST: "0.0.0.0",
        AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK: "true",
        AVAGO_TRACK_SUBNETS: subnetId,
        AVAGO_CHAIN_CONFIG_DIR: "/root/.avalanchego/configs/chains"
    };

    // Set network ID
    if (networkID === 5) {
        env.AVAGO_NETWORK_ID = "fuji";
    }

    // Configure RPC settings
    if (isRPC) {
        env.AVAGO_HTTP_ALLOWED_HOSTS = '"*"';
    }

    // Add VM aliases if custom VM
    if (isCustomVM) {
        const vmAliases = {
            [vmId]: [SUBNET_EVM_VM_ID]
        };
        env.AVAGO_VM_ALIASES_FILE_CONTENT = btoa(JSON.stringify(vmAliases, null, 2));
    }

    const chunks = [
        "docker run -it -d",
        `--name avago`,
        `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
        `-v ~/.avalanchego:/root/.avalanchego`,
        ...Object.entries(env).map(([key, value]) => `-e ${key}=${value}`),
        `avaplatform/subnet-evm_avalanchego:${versions['avaplatform/subnet-evm_avalanchego']}`
    ];

    return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
};

