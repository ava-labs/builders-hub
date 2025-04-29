const endpoint = "https://glacier-api-dev.avax.network"

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
