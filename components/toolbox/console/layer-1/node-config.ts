// Node configuration generation for L1 Docker setup
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import { getContainerVersions } from '@/components/toolbox/utils/containerVersions';

// Subnet-EVM default configuration values
// Source: avalanchego/graft/subnet-evm/plugin/evm/config/default_config.go
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
    // Note: Subnet-EVM Go default is true (see default_config.go). We track this as a
    // UI default of false so the generated config explicitly disables it for new nodes.
    "metrics-expensive-enabled": false,
    "accepted-cache-size": 32,
    "batch-request-limit": 1000,  // AvalancheGo default is 1000
    "batch-response-max-size": 25000000,
    "state-sync-enabled": false,
    "allow-unfinalized-queries": false,
    "api-max-duration": 0,
    "api-max-blocks-per-request": 0,
    // eth-apis are auto-included by the node - no need to specify unless adding debug APIs
    // Default: ["eth", "eth-filter", "net", "web3", "internal-eth", "internal-blockchain", "internal-transaction"]
};

/**
 * Generates the Subnet-EVM chain configuration
 * Only includes values that differ from defaults
 * This configuration is saved to ~/.avalanchego/configs/chains/<blockchainID>/config.json
 */
export const generateChainConfig = (
    nodeType: 'validator' | 'rpc' | 'archival',
    enableDebugTrace: boolean = false,
    adminApiEnabled: boolean = false,
    pruningEnabled: boolean = true,
    logLevel: string = "info",
    minDelayTarget: number = 0,
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
    batchRequestLimit: number = 1000,  // AvalancheGo default
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
    continuousProfilerFrequency: string = "15m",
    // Enable expensive debug-level metrics (includes Firewood metrics)
    // Note: AvalancheGo default is true, but we default to false to avoid performance impact
    metricsExpensiveEnabled: boolean = false
) => {
    const isRPC = nodeType === 'rpc' || nodeType === 'archival';
    const isValidator = nodeType === 'validator';
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

    // Expensive metrics - always include explicitly.
    // Subnet-EVM Go default is true (MetricsExpensiveEnabled: true in default_config.go),
    // so omitting the key means expensive metrics stay enabled. We must explicitly set
    // false when the user wants them disabled, otherwise the Go default wins.
    config["metrics-expensive-enabled"] = metricsExpensiveEnabled;

    // Min delay target (ACP-226) - controls minimum block delay for validators.
    // In Go source this is *uint64 with omitempty (nil = node decides, no vote).
    // The UI defaults the slider to 2000ms; when at that position we omit the key
    // so the node uses its own default behavior. Any other value is explicit.
    if (minDelayTarget !== 2000) {
        config["min-delay-target"] = minDelayTarget;
    }

    // Batch limits - only add if different from defaults
    addIfNotDefault("batch-request-limit", batchRequestLimit);
    addIfNotDefault("batch-response-max-size", batchResponseMaxSize);

    // State sync - only add if enabled
    if (stateSyncEnabled) {
        config["state-sync-enabled"] = true;
    }

    // Transaction indexing:
    // - Validators: omit entirely (they skip indexing, use node default)
    // - RPC nodes: explicitly show false to indicate indexing is enabled
    if (isRPC && !skipTxIndexing) {
        config["skip-tx-indexing"] = false;
    } else if (skipTxIndexing) {
        config["skip-tx-indexing"] = true;
    }

    // Transaction history - only add if specified
    if (!skipTxIndexing && transactionHistory > 0) {
        config["transaction-history"] = transactionHistory;
    }

    // Transaction settings - only add if enabled
    if (preimagesEnabled) {
        config["preimages-enabled"] = true;
    }
    if (localTxsEnabled) {
        config["local-txs-enabled"] = true;
    }

    // eth-apis configuration:
    // The node automatically enables default APIs: ["eth", "eth-filter", "net", "web3", "internal-eth", "internal-blockchain", "internal-transaction"]
    // We only need to specify eth-apis when adding debug or admin APIs
    if (enableDebugTrace) {
        // Debug trace requires additional debug APIs.
        // Note: internal-personal is intentionally excluded -- it exposes wallet
        // management RPCs (personal_newAccount, personal_unlockAccount, etc.) which
        // are dangerous on public RPC nodes. Operators who need it can add it manually.
        config["eth-apis"] = [
            "eth",
            "eth-filter",
            "net",
            "web3",
            "internal-eth",
            "internal-blockchain",
            "internal-transaction",
            "internal-debug",
            "internal-account",
            "debug",
            "debug-tracer",
            "debug-file-tracer",
            "debug-handler",
            ...(adminApiEnabled ? ["admin"] : [])
        ];
    } else if (adminApiEnabled) {
        // Admin API requires explicit eth-apis with admin included
        config["eth-apis"] = [
            "eth",
            "eth-filter",
            "net",
            "web3",
            "internal-eth",
            "internal-blockchain",
            "internal-transaction",
            "admin"
        ];
    }
    // Otherwise: omit eth-apis entirely - node uses sensible defaults

    // Admin API enabled flag (separate from eth-apis)
    if (adminApiEnabled) {
        config["admin-api-enabled"] = true;
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

    // Gossip settings (primarily for validators) - only add if different from defaults
    // Default values: push-gossip-num-validators=100, push-gossip-percent-stake=0.9
    if (isValidator) {
        if (pushGossipNumValidators !== 100) {
            config["push-gossip-num-validators"] = pushGossipNumValidators;
        }
        if (pushGossipPercentStake !== 0.9) {
            config["push-gossip-percent-stake"] = pushGossipPercentStake;
        }
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
    nodeType: 'validator' | 'rpc' | 'archival',
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
 * Generates the node-level configuration (node.json)
 * This configures AvalancheGo itself: networking, HTTP, subnets to track, etc.
 * Saved to: ~/.avalanchego/configs/node.json
 */
export const generateNodeConfig = (
    subnetId: string,
    nodeType: 'validator' | 'rpc' | 'archival',
    networkID: number,
    options: {
        publicIp?: string;
        httpPort?: number;
        stakingPort?: number;
        apiAdminEnabled?: boolean;
        apiMetricsEnabled?: boolean;
    } = {}
) => {
    const isRPC = nodeType === 'rpc' || nodeType === 'archival';
    const isTestnet = networkID === 5;

    const config: Record<string, any> = {
        // Network
        "network-id": isTestnet ? "fuji" : "mainnet",

        // Public IP resolution
        "public-ip-resolution-service": "opendns",

        // HTTP API
        "http-host": "0.0.0.0",
        "http-port": options.httpPort || 9650,

        // Staking port
        "staking-port": options.stakingPort || 9651,

        // L1 nodes only need Primary Network headers, not full state
        "partial-sync-primary-network": true,

        // Track this L1's subnet
        "track-subnets": subnetId
    };

    // RPC nodes allow external HTTP requests
    if (isRPC) {
        config["http-allowed-hosts"] = "*";
    }

    // Optional: explicit public IP (otherwise uses resolution service)
    if (options.publicIp) {
        config["public-ip"] = options.publicIp;
        delete config["public-ip-resolution-service"];
    }

    // Optional: admin API for node management
    if (options.apiAdminEnabled) {
        config["api-admin-enabled"] = true;
    }

    // Optional: metrics endpoint
    if (options.apiMetricsEnabled) {
        config["api-metrics-enabled"] = true;
    }

    return config;
};

/**
 * Generates VM aliases file for custom VMs
 * Maps custom VM ID to subnet-evm so the node knows how to run it
 * Saved to: ~/.avalanchego/configs/vms/aliases.json
 */
export const generateVmAliases = (vmId: string) => {
    if (vmId === SUBNET_EVM_VM_ID) {
        return null; // No aliases needed for standard subnet-evm
    }
    return {
        [vmId]: [SUBNET_EVM_VM_ID]
    };
};

/**
 * Generates shell commands to create all config files
 */
export const generateAllConfigCommands = (
    subnetId: string,
    blockchainId: string,
    nodeConfig: any,
    chainConfig: any,
    vmId: string = SUBNET_EVM_VM_ID
) => {
    const commands: string[] = [];
    const isCustomVM = vmId !== SUBNET_EVM_VM_ID;

    // Create directory structure
    commands.push(`# Create config directories
mkdir -p ~/.avalanchego/configs/chains/${blockchainId}
mkdir -p ~/.avalanchego/configs/vms`);

    // Node config
    commands.push(`
# Node config (network, http, subnets)
cat > ~/.avalanchego/configs/node.json << 'EOF'
${JSON.stringify(nodeConfig, null, 2)}
EOF`);

    // Chain config
    commands.push(`
# Chain config (${blockchainId})
cat > ~/.avalanchego/configs/chains/${blockchainId}/config.json << 'EOF'
${JSON.stringify(chainConfig, null, 2)}
EOF`);

    // VM aliases (only for custom VMs)
    if (isCustomVM) {
        const vmAliases = generateVmAliases(vmId);
        commands.push(`
# VM aliases (maps custom VM to subnet-evm)
cat > ~/.avalanchego/configs/vms/aliases.json << 'EOF'
${JSON.stringify(vmAliases, null, 2)}
EOF`);
    }

    return commands.join('\n');
};

/**
 * Generates a command to create the chain config file in the correct location
 * @deprecated Use generateAllConfigCommands instead
 */
export const generateConfigFileCommand = (
    blockchainId: string,
    chainConfig: any
) => {
    const configJson = JSON.stringify(chainConfig, null, 2);
    const configPath = `~/.avalanchego/configs/chains/${blockchainId}`;

    return `# Create the chain config directory and file
mkdir -p ${configPath} && cat > ${configPath}/config.json << 'EOF'
${configJson}
EOF`;
};

/**
 * Generates the node-level configuration for Primary Network nodes
 * Unlike L1 nodes, Primary Network nodes don't use partial-sync or track-subnets
 * Saved to: ~/.avalanchego/configs/node.json
 */
export const generatePrimaryNetworkNodeConfig = (
    nodeType: 'validator' | 'rpc' | 'archival',
    networkID: number,
    options: {
        publicIp?: string;
        httpPort?: number;
        stakingPort?: number;
        apiAdminEnabled?: boolean;
        apiMetricsEnabled?: boolean;
    } = {}
) => {
    const isRPC = nodeType === 'rpc' || nodeType === 'archival';
    const isTestnet = networkID === 5;

    const config: Record<string, any> = {
        // Network
        "network-id": isTestnet ? "fuji" : "mainnet",

        // Public IP resolution
        "public-ip-resolution-service": "opendns",

        // HTTP API
        "http-host": "0.0.0.0",
        "http-port": options.httpPort || 9650,

        // Staking port
        "staking-port": options.stakingPort || 9651
    };

    // RPC nodes allow external HTTP requests
    if (isRPC) {
        config["http-allowed-hosts"] = "*";
    }

    // Optional: explicit public IP (otherwise uses resolution service)
    if (options.publicIp) {
        config["public-ip"] = options.publicIp;
        delete config["public-ip-resolution-service"];
    }

    // Optional: admin API for node management
    if (options.apiAdminEnabled) {
        config["api-admin-enabled"] = true;
    }

    // Optional: metrics endpoint
    if (options.apiMetricsEnabled) {
        config["api-metrics-enabled"] = true;
    }

    return config;
};

/**
 * Generates the Docker run command for Primary Network nodes
 * Volume mount provides config files; AVAGO_CONFIG_FILE tells AvalancheGo where to find node.json
 */
export const generatePrimaryNetworkDockerCommand = (
    nodeType: 'validator' | 'rpc' | 'archival',
    networkID: number
) => {
    const isRPC = nodeType === 'rpc' || nodeType === 'archival';
    const isTestnet = networkID === 5;
    const versions = getContainerVersions(isTestnet);

    const chunks = [
        "docker run -it -d",
        "--name avago",
        `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
        "-v ~/.avalanchego:/root/.avalanchego",
        "-e AVAGO_CONFIG_FILE=/root/.avalanchego/configs/node.json",
        `avaplatform/avalanchego:${versions['avaplatform/avalanchego']}`
    ];

    return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
};

/**
 * Generates the Docker run command for L1 nodes
 * Volume mount provides config files; AVAGO_CONFIG_FILE tells AvalancheGo where to find node.json
 */
export const generateDockerCommand = (
    subnetId: string,
    blockchainId: string,
    chainConfig: any,
    nodeType: 'validator' | 'rpc' | 'archival',
    networkID: number,
    vmId: string = SUBNET_EVM_VM_ID
) => {
    const isRPC = nodeType === 'rpc' || nodeType === 'archival';
    const isTestnet = networkID === 5;
    const versions = getContainerVersions(isTestnet);

    const chunks = [
        "docker run -it -d",
        "--name avago",
        `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
        "-v ~/.avalanchego:/root/.avalanchego",
        "-e AVAGO_CONFIG_FILE=/root/.avalanchego/configs/node.json",
        `avaplatform/subnet-evm_avalanchego:${versions['avaplatform/subnet-evm_avalanchego']}`
    ];

    return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
};

