// Common configuration for Avalanche node setup

import versions from "../../versions.json";

// Constants
export const SUBNET_EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy";
export const C_CHAIN_ID = "C";

/**
 * Generates the VM configuration for a blockchain
 * @param debugEnabled Whether to enable debug tracing
 * @param pruningEnabled Whether to enable pruning
 * @returns VM configuration object
 */
export const generateVMConfig = (debugEnabled: boolean, pruningEnabled: boolean) => {
  return debugEnabled ? {
    "pruning-enabled": pruningEnabled,
    "log-level": "debug",
    "warp-api-enabled": true,
    "eth-apis": [
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
    ]
  } : {
    "pruning-enabled": pruningEnabled,
  };
};

/**
 * Encodes the chain configuration to base64
 * @param chainId The blockchain ID
 * @param debugEnabled Whether to enable debug tracing
 * @param pruningEnabled Whether to enable pruning
 * @returns Base64 encoded configuration
 */
export const nodeConfigBase64 = (chainId: string, debugEnabled: boolean, pruningEnabled: boolean) => {
  const vmConfig = generateVMConfig(debugEnabled, pruningEnabled);

  // First encode the inner config object
  const vmConfigEncoded = btoa(JSON.stringify(vmConfig));

  const configMap: Record<string, { Config: string, Upgrade: any }> = {};
  configMap[chainId] = { Config: vmConfigEncoded, Upgrade: null };

  return btoa(JSON.stringify(configMap));
};

/**
 * Generates Docker command for running an Avalanche node
 * @param subnets Subnet IDs to track
 * @param isRPC Whether this is an RPC node
 * @param networkID Network ID (Fuji or Mainnet)
 * @param chainId The blockchain ID
 * @param vmId The VM ID
 * @param debugEnabled Whether to enable debug tracing
 * @param pruningEnabled Whether to enable pruning
 * @param isPrimaryNetwork Whether this is for the Primary Network
 * @returns Docker command string
 */
export const generateDockerCommand = (
  subnets: string[],
  isRPC: boolean,
  networkID: number,
  chainId: string,
  vmId: string = SUBNET_EVM_VM_ID,
  debugEnabled: boolean = false,
  pruningEnabled: boolean = true,
  isPrimaryNetwork: boolean = false
) => {
  const env: Record<string, string> = {
    AVAGO_PUBLIC_IP_RESOLUTION_SERVICE: "opendns",
    AVAGO_HTTP_HOST: "0.0.0.0",
  };

  // Only add partial sync for L1s, not for Primary Network
  if (!isPrimaryNetwork) {
    env.AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK = "true";
  }

  // Add subnets to track if provided and not empty
  subnets = subnets.filter(subnet => subnet !== "");
  if (subnets.length !== 0) {
    env.AVAGO_TRACK_SUBNETS = subnets.join(",");
  }

  // Set network ID
  if (networkID === 5) { // Fuji
    env.AVAGO_NETWORK_ID = "fuji";
  } else if (networkID === 1) { // Mainnet
    // Default is mainnet, no need to set
  } else {
    throw new Error(`This tool only supports Fuji (5) and Mainnet (1). Network ID ${networkID} is not supported.`);
  }

  // Configure RPC settings
  if (isRPC) {
    env.AVAGO_HTTP_ALLOWED_HOSTS = "\"*\"";
  }

  // Add chain config
  env.AVAGO_CHAIN_CONFIG_CONTENT = nodeConfigBase64(chainId, debugEnabled, pruningEnabled);

  // Check if this is a custom VM (not the standard subnet-evm)
  const isCustomVM = vmId !== SUBNET_EVM_VM_ID;

  if (isCustomVM && !isPrimaryNetwork) {
    // Add VM aliases as an environment variable
    const vmAliases = {
      [vmId]: [SUBNET_EVM_VM_ID]
    };
    const base64Content = btoa(JSON.stringify(vmAliases, null, 2));
    env.AVAGO_VM_ALIASES_FILE_CONTENT = base64Content;
  }

  // Build Docker command
  const chunks = [
    "docker run -it -d",
    `--name avago`,
    `-p ${isRPC ? "" : "127.0.0.1:"}9650:9650 -p 9651:9651`,
    `-v ~/.avalanchego:/root/.avalanchego`,
    ...Object.entries(env).map(([key, value]) => `-e ${key}=${value}`),
  ];

  // Add the appropriate image based on whether it's Primary Network or L1
  if (isPrimaryNetwork) {
    chunks.push(`avaplatform/avalanchego:${versions['avaplatform/avalanchego']}`);
  } else {
    chunks.push(`avaplatform/subnet-evm_avalanchego:${versions['avaplatform/subnet-evm_avalanchego']}`);
  }

  return chunks.map(chunk => `    ${chunk}`).join(" \\\n").trim();
}; 