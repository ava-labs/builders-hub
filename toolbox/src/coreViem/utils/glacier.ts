//FIXME: Sooner or later we should use the SDK

const endpoint = "https://glacier-api.avax.network"

interface BlockchainInfo {
    createBlockTimestamp: number;
    createBlockNumber: string;
    blockchainId: string;
    vmId: string;
    subnetId: string;
    blockchainName: string;
    evmChainId: number;
}

type Network = "testnet" | "mainnet";

export async function getBlockchainInfo(blockchainId: string): Promise<BlockchainInfo & { isTestnet: boolean }> {
    return Promise.any([
        getBlockchainInfoForNetwork("testnet", blockchainId).then(info => ({ ...info, isTestnet: true })),
        getBlockchainInfoForNetwork("mainnet", blockchainId).then(info => ({ ...info, isTestnet: false })),
    ]);
}

export async function getBlockchainInfoForNetwork(network: Network, blockchainId: string): Promise<BlockchainInfo> {
    const url = `${endpoint}/v1/networks/${network}/blockchains/${blockchainId}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch blockchain info: ${response.statusText}`);
    }

    const data: BlockchainInfo = await response.json();
    return data;
}

interface SubnetOwnershipInfo {
    addresses: string[];
    locktime: number;
    threshold: number;
}

interface L1ValidatorManagerDetails {
    blockchainId: string;
    contractAddress: string;
}

interface SubnetBlockchainInfo extends BlockchainInfo { }

interface SubnetInfo {
    createBlockTimestamp: number;
    createBlockIndex: string;
    subnetId: string;
    ownerAddresses: string[];
    threshold: number;
    locktime: number;
    subnetOwnershipInfo: SubnetOwnershipInfo;
    isL1: boolean;
    l1ConversionTransactionHash: string;
    l1ValidatorManagerDetails?: L1ValidatorManagerDetails; // Optional based on response structure
    blockchains: SubnetBlockchainInfo[];
}

export async function getSubnetInfo(subnetId: string): Promise<SubnetInfo> {
    return Promise.any([
        getSubnetInfoForNetwork("testnet", subnetId),
        getSubnetInfoForNetwork("mainnet", subnetId),
    ]);
}

export async function getSubnetInfoForNetwork(network: Network, subnetId: string): Promise<SubnetInfo> {
    const url = `${endpoint}/v1/networks/${network}/subnets/${subnetId}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch subnet info: ${response.statusText}`);
    }

    const data: SubnetInfo = await response.json();
    return data;
}

// Interfaces for P-Chain Balance
interface AssetBalance {
    assetId: string;
    name: string;
    symbol: string;
    denomination: number;
    type: string;
    amount: string;
    utxoCount: number;
    status?: string; // Optional, e.g., for atomicMemoryUnlocked
    sharedWithChainId?: string; // Optional, e.g., for atomicMemoryUnlocked
}

interface Balances {
    unlockedStaked: AssetBalance[];
    unlockedUnstaked: AssetBalance[];
    lockedStaked: AssetBalance[];
    lockedPlatform: AssetBalance[];
    lockedStakeable: AssetBalance[];
    pendingStaked: AssetBalance[];
    atomicMemoryLocked: AssetBalance[];
    atomicMemoryUnlocked: AssetBalance[];
}

interface PChainChainInfo {
    chainName: string;
    network: string; // e.g., "fuji", "mainnet"
}

export interface PChainBalanceResponse {
    balances: Balances;
    chainInfo: PChainChainInfo;
}

export async function getPChainBalance(network: Network, address: string): Promise<PChainBalanceResponse> {
    const networkPath = network === "testnet" ? "fuji" : network;
    const url = `${endpoint}/v1/networks/${networkPath}/blockchains/p-chain/balances?addresses=${address}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch P-Chain balance for ${address} on ${networkPath} (${network}): ${response.status} ${response.statusText}`);
    }

    const data: PChainBalanceResponse = await response.json();
    return data;
}

interface UtilityAddressesInfo {
    multicall: string;
}

interface NetworkTokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    logoUri: string;
    description: string;
}

export interface ChainDetails {
    chainId: string;
    status: string;
    chainName: string;
    description: string;
    platformChainId: string;
    subnetId: string;
    vmId: string;
    vmName: string;
    explorerUrl: string;
    rpcUrl: string;
    wsUrl?: string;
    isTestnet: boolean;
    utilityAddresses: UtilityAddressesInfo;
    networkToken: NetworkTokenInfo;
    chainLogoUri: string;
    private: boolean;
    enabledFeatures: string[];
}

export async function getChainDetails(chainId: string): Promise<ChainDetails> {
    const endpoint = "https://glacier-api.avax.network"//override for dev
    const url = `${endpoint}/v1/chains/${chainId}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch chain details for chainId ${chainId}: ${response.status} ${response.statusText}`);
    }

    const data: ChainDetails = await response.json();
    return data;
}

interface GetChainsResponse {
    chains: ChainDetails[];
}

export async function getChains(): Promise<ChainDetails[]> {
    const url = `${endpoint}/v1/chains`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch chains: ${response.status} ${response.statusText}`);
    }

    const data: GetChainsResponse = await response.json();
    return data.chains;
}

interface PriceInfo {
    currencyCode: string;
    value: string;
}

interface NativeTokenBalance {
    name: string;
    symbol: string;
    decimals: number;
    logoUri: string;
    chainId: string;
    price?: PriceInfo; // Optional
    balance: string;
    balanceValue?: PriceInfo; // Optional
}

interface GetNativeTokenBalanceResponse {
    nativeTokenBalance: NativeTokenBalance;
}

export async function getNativeTokenBalance(chainId: string | number, address: string): Promise<NativeTokenBalance> {
    const glacierProdEndpoint = "https://glacier-api.avax.network"; // Using production endpoint
    const url = `${glacierProdEndpoint}/v1/chains/${chainId}/addresses/${address}/balances:getNative`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch native token balance for address ${address} on chain ${chainId}: ${response.status} ${response.statusText}`);
    }

    const data: GetNativeTokenBalanceResponse = await response.json();
    return data.nativeTokenBalance;
}

