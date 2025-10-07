export interface PrecompileDetails {
    address: string;
    name: string;
    description: string;
    githubUrl?: string;
}

export const PRECOMPILE_INFO = {
    // Permissioning Precompiles
    contractDeployerAllowList: {
        address: '0x0200000000000000000000000000000000000000',
        name: 'Contract Deployer Allow List',
        description: 'Controls who can deploy smart contracts on your blockchain. Restricts contract deployment to authorized addresses only.'
    },
    nativeMinter: {
        address: '0x0200000000000000000000000000000000000001',
        name: 'Native Minter',
        description: 'Allows authorized addresses to mint new native tokens, increasing the total supply on your blockchain.'
    },
    txAllowList: {
        address: '0x0200000000000000000000000000000000000002',
        name: 'Transaction Allow List',
        description: 'Restricts who can submit transactions to your blockchain, creating a permissioned network.'
    },
    feeManager: {
        address: '0x0200000000000000000000000000000000000003',
        name: 'Fee Manager',
        description: 'Enables dynamic fee configuration adjustments by authorized admins without requiring a hard fork.'
    },
    rewardManager: {
        address: '0x0200000000000000000000000000000000000004',
        name: 'Reward Manager',
        description: 'Manages validator rewards and fee recipient configuration for block producers.'
    }
} as const;

// Pre-deployed contracts (not precompiles, but often configured together)
export const PREDEPLOY_INFO = {
    proxy: {
        address: '0xfacade0000000000000000000000000000000000',
        name: 'Transparent Upgradeable Proxy',
        description: 'Enables upgradeability for smart contracts. Delegates calls to implementation contracts while preserving storage.',
        githubUrl: 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/proxy/transparent/TransparentUpgradeableProxy.sol'
    },
    proxyAdmin: {
        address: '0xdad0000000000000000000000000000000000000',
        name: 'Proxy Admin Contract',
        description: 'Manages upgrades for transparent proxies. Controls which addresses can upgrade proxy implementations.',
        githubUrl: 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/proxy/transparent/ProxyAdmin.sol'
    },
    icmMessenger: {
        address: '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf',
        name: 'ICM Messenger',
        description: 'Avalanche Interchain Messaging contract for cross-subnet communication and message relaying.',
        githubUrl: 'https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/TeleporterMessenger.sol'
    },
    wrappedNativeToken: {
        address: '0x1111111111111111111111111111111111111111',
        name: 'Wrapped Native Token',
        description: 'ERC-20 wrapper for the native token, enabling DeFi integrations and smart contract interactions.',
        githubUrl: 'https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/WrappedNativeToken.sol'
    },
    safeSingletonFactory: {
        address: '0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7',
        name: 'Safe Singleton Factory',
        description: 'Deploys Safe multisig wallet contracts at deterministic addresses across all chains.',
        githubUrl: 'https://github.com/safe-global/safe-singleton-factory/blob/main/source/deterministic-deployment-proxy.yul'
    },
    multicall3: {
        address: '0xcA11bde05977b3631167028862bE2a173976CA11',
        name: 'Multicall3',
        description: 'Batches multiple contract calls into a single transaction, reducing gas costs and improving efficiency.',
        githubUrl: 'https://github.com/mds1/multicall/blob/main/src/Multicall3.sol'
    },
    create2Deployer: {
        address: '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2',
        name: 'Create2 Deployer',
        description: 'Enables deterministic contract deployment using CREATE2 opcode for same address across chains.',
        githubUrl: 'https://github.com/pcaversaccio/create2deployer/blob/main/contracts/Create2Deployer.sol'
    }
} as const;
