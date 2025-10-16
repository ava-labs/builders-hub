import versions from '@/scripts/versions.json';

export const genConfigCommand = (
    sources: {
        subnetId: string;
        blockchainId: string;
        rpcUrl: string;
    }[],
    destinations: {
        subnetId: string;
        blockchainId: string;
        rpcUrl: string;
        privateKey: string;
    }[],
    isTestnet: boolean,
    logLevel: string = 'info',
    storageLocation: string = './awm-relayer-storage',
    processMissedBlocks: boolean = true,
    apiPort: number = 8080
) => {
    const config = {
        "log-level": logLevel,
        "storage-location": storageLocation,
        "process-missed-blocks": processMissedBlocks,
        "api-port": apiPort,
        "metrics-port": 9090,
        "db-write-interval-seconds": 10,
        "info-api": {
            "base-url": isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"
        },
        "p-chain-api": {
            "base-url": isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"
        },
        "source-blockchains": sources.map(source => ({
            "subnet-id": source.subnetId,
            "blockchain-id": source.blockchainId,
            "vm": "evm",
            "rpc-endpoint": {
                "base-url": source.rpcUrl,
            },
            "ws-endpoint": {
                "base-url": source.rpcUrl.replace("http", "ws").replace("/rpc", "/ws"),
            },
            "message-contracts": {
                "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf": {
                    "message-format": "teleporter",
                    "settings": {
                        "reward-address": "0x0000000000000000000000000000000000000000"
                    }
                }
            }
        })),
        "destination-blockchains": destinations.map(destination => ({
            "subnet-id": destination.subnetId,
            "blockchain-id": destination.blockchainId,
            "vm": "evm",
            "rpc-endpoint": {
                "base-url": destination.rpcUrl
            },
            "account-private-key": destination.privateKey
        }))
    };

    const configStr = JSON.stringify(config, null, 4);
    return `mkdir -p ~/.icm-relayer && echo '${configStr}' > ~/.icm-relayer/config.json`;
};

export const relayerDockerCommand = () => {
    return `docker run --name relayer -d \\
    --restart on-failure  \\
    --user=root \\
    --network=host \\
    -v ~/.icm-relayer/:/icm-relayer/ \\
    avaplatform/icm-relayer:${versions['avaplatform/icm-relayer']} \\
    --config-file /icm-relayer/config.json`;
};

export const generateRelayerConfig = (
    sources: {
        subnetId: string;
        blockchainId: string;
        rpcUrl: string;
    }[],
    destinations: {
        subnetId: string;
        blockchainId: string;
        rpcUrl: string;
        privateKey: string;
    }[],
    isTestnet: boolean,
    logLevel: string,
    storageLocation: string,
    processMissedBlocks: boolean,
    apiPort: number
) => {
    const config = {
        "log-level": logLevel,
        "storage-location": storageLocation,
        "process-missed-blocks": processMissedBlocks,
        "api-port": apiPort,
        "metrics-port": 9090,
        "db-write-interval-seconds": 10,
        "info-api": {
            "base-url": isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"
        },
        "p-chain-api": {
            "base-url": isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"
        },
        "source-blockchains": sources.map(source => ({
            "subnet-id": source.subnetId,
            "blockchain-id": source.blockchainId,
            "vm": "evm",
            "rpc-endpoint": {
                "base-url": source.rpcUrl,
            },
            "ws-endpoint": {
                "base-url": source.rpcUrl.replace("http", "ws").replace("/rpc", "/ws"),
            },
            "message-contracts": {
                "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf": {
                    "message-format": "teleporter",
                    "settings": {
                        "reward-address": "0x0000000000000000000000000000000000000000"
                    }
                }
            }
        })),
        "destination-blockchains": destinations.map(destination => ({
            "subnet-id": destination.subnetId,
            "blockchain-id": destination.blockchainId,
            "vm": "evm",
            "rpc-endpoint": {
                "base-url": destination.rpcUrl
            },
            "account-private-key": destination.privateKey
        }))
    };

    return JSON.stringify(config, null, 2);
};

