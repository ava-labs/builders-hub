// Node configuration generation for L1 Docker setup
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import { getContainerVersions } from '@/components/toolbox/utils/containerVersions';

// Subnet-EVM default configuration values
// Reference: https://build.avax.network/docs/nodes/chain-configs/subnet-evm
const SUBNET_EVM_DEFAULTS = {
    "pruning-enabled": true,
    "commit-interval": 4096,
    "trie-clean-cache": 512,
    "trie-dirty-cache": 512,
    "trie-dirty-commit-target": 20,
    "trie-prefetcher-parallelism": 16,
    "snapshot-cache": 256,
    "state-sync-server-trie-cache": 64,
    "rpc-gas-cap": 50000000,
    "rpc-tx-fee-cap": 100,
    "log-level": "info",
    "metrics-expensive-enabled": false,
    "accepted-cache-size": 32,
    "batch-request-limit": 0,
    "batch-response-max-size": 25000000,
    "state-sync-enabled": false,
    "allow-unfinalized-queries": false,
    "api-max-duration": 0,
    "api-max-blocks-per-request": 0,
    // Default eth-apis
    "eth-apis": ["eth", "eth-filter", "net", "web3", "internal-eth", "internal-blockchain", "internal-transaction"],
};

/**
 * Generates the Subnet-EVM chain configuration
 * Only includes values that differ from defaults
 * This configuration is saved to ~/.avalanchego/configs/chains/<blockchainID>/config.json
 */
export const generateChainConfig = (
    nodeType: 'validator' | 'public-rpc' | 'validator-rpc',
    enableDebugTrace: boolean = false,
    adminApiEnabled: boolean = false,
    pruningEnabled: boolean = true,
    logLevel: string = "info",
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
    batchRequestLimit: number = 0,
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
    const isRPC = nodeType === 'public-rpc' || nodeType === 'validator-rpc';
    const isValidator = nodeType === 'validator' || nodeType === 'validator-rpc';
    const config: any = {};

    // Helper function to add config only if it differs from default
    const addIfNotDefault = (key: string, value: any, defaultValue?: any) => {
        const defaultVal = defaultValue !== undefined ? defaultValue : SUBNET_EVM_DEFAULTS[key as keyof typeof SUBNET_EVM_DEFAULTS];
        
        // For arrays, do a deep comparison
        if (Array.isArray(value) && Array.isArray(defaultVal)) {
            if (JSON.stringify(value) !== JSON.stringify(defaultVal)) {
                config[key] = value;
            }
        } else if (value !== defaultVal) {
            config[key] = value;
        }
    };

    // Always include pruning-enabled for explicitness in L1 node setup
    config["pruning-enabled"] = pruningEnabled;

    // Cache settings - only add if different from defaults
    addIfNotDefault("trie-clean-cache", trieCleanCache);
    addIfNotDefault("trie-dirty-cache", trieDirtyCache);
    addIfNotDefault("trie-dirty-commit-target", trieDirtyCommitTarget);
    addIfNotDefault("trie-prefetcher-parallelism", triePrefetcherParallelism);
    addIfNotDefault("snapshot-cache", snapshotCache);
    addIfNotDefault("state-sync-server-trie-cache", stateSyncServerTrieCache);
    addIfNotDefault("accepted-cache-size", acceptedCacheSize);
    addIfNotDefault("commit-interval", commitInterval);

    // Performance settings
    addIfNotDefault("rpc-gas-cap", rpcGasCap);
    addIfNotDefault("rpc-tx-fee-cap", rpcTxFeeCap);

    // Logging - only add if different from default (info)
    if (logLevel !== "info") {
        config["log-level"] = logLevel;
    }

    // Metrics - only add if enabled (default is false)
    if (true) { // We always want expensive metrics enabled
        config["metrics-expensive-enabled"] = true;
    }

    // Min delay target - only add if non-zero (default is 0, meaning no minimum delay)
    if (minDelayTarget > 0) {
        config["min-delay-target"] = minDelayTarget;
    }

    // Batch limits - only add if different from defaults
    addIfNotDefault("batch-request-limit", batchRequestLimit);
    addIfNotDefault("batch-response-max-size", batchResponseMaxSize);

    // Warp API - typically enabled for L1s, but not a default for all Subnet-EVM chains
    config["warp-api-enabled"] = true;

    // State sync - only add if enabled
    if (stateSyncEnabled) {
        config["state-sync-enabled"] = true;
    }

    // Transaction indexing - only add if non-default
    if (skipTxIndexing) {
        config["skip-tx-indexing"] = true;
    } else if (transactionHistory > 0) {
        config["transaction-history"] = transactionHistory;
    }

    // Transaction settings - only add if enabled
    if (preimagesEnabled) {
        config["preimages-enabled"] = true;
    }
    if (localTxsEnabled) {
        config["local-txs-enabled"] = true;
    }

    // Configure APIs based on node type
    // Always include eth-apis for explicitness in L1 node setup
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
    } else {
        // Include standard APIs explicitly for L1 nodes (even though these are defaults)
        // This makes the configuration more explicit and easier to understand
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

    // Admin API - only enable if explicitly requested
    if (adminApiEnabled) {
        config["admin-api-enabled"] = true;
        // Add admin to eth-apis if not already present (when debug is disabled)
        if (!enableDebugTrace && !config["eth-apis"].includes("admin")) {
            config["eth-apis"].push("admin");
        }
    }

    // RPC-specific settings
    if (isRPC) {
        // api-max-duration: 0 is default (no time limit), already default so we don't need to add
        // api-max-blocks-per-request: 0 is default (no limit)
        addIfNotDefault("api-max-blocks-per-request", apiMaxBlocksPerRequest);
        
        // Only add if enabled (default is false)
        if (allowUnfinalizedQueries) {
            config["allow-unfinalized-queries"] = true;
        }
    }

    // Gossip settings (primarily for validators) - only add if non-default
    if (isValidator) {
        // These don't have documented defaults, so we always add them for validators
        config["push-gossip-num-validators"] = pushGossipNumValidators;
        config["push-gossip-percent-stake"] = pushGossipPercentStake;
    }

    // Continuous profiling - only add if enabled
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
    nodeType: 'validator' | 'public-rpc' | 'validator-rpc',
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
    nodeType: 'validator' | 'public-rpc' | 'validator-rpc',
    networkID: number,
    vmId: string = SUBNET_EVM_VM_ID
) => {
    const isRPC = nodeType === 'public-rpc' || nodeType === 'validator-rpc';
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

