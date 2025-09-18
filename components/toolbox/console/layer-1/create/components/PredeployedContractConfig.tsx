import React from 'react';
import { ExternalLink } from 'lucide-react';

export interface PredeployedContract {
    id: string;
    name: string;
    description: string;
    githubUrl: string;
    contractAddress?: string;
}

interface PredeployedContractConfigProps {
    enabledContracts: Set<string>;
    onToggleContract: (contractId: string) => void;
}

const PREDEPLOYED_CONTRACTS: PredeployedContract[] = [
    {
        id: 'proxy',
        name: 'TransparentUpgradeableProxy',
        description: 'Upgradeable proxy contract for L1 ownership (requires ProxyAdmin)',
        githubUrl: 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/proxy/transparent/TransparentUpgradeableProxy.sol',
        contractAddress: '0xfacade0000000000000000000000000000000000'
    },
    {
        id: 'proxyAdmin',
        name: 'ProxyAdmin',
        description: 'Admin contract for managing upgradeable proxies (required by TransparentUpgradeableProxy)',
        githubUrl: 'https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/proxy/transparent/ProxyAdmin.sol',
        contractAddress: '0xdad0000000000000000000000000000000000000'
    },
    {
        id: 'multicall3',
        name: 'Multicall3',
        description: 'Batch multiple contract calls in a single transaction',
        githubUrl: 'https://github.com/mds1/multicall#multicall3',
        contractAddress: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    {
        id: 'create2Deployer',
        name: 'Create2 Deployer',
        description: 'Deterministic contract deployment using CREATE2',
        githubUrl: 'https://github.com/Arachnid/deterministic-deployment-proxy',
        contractAddress: '0x4e59b44847b379578588920cA78FbF26c0B4956C'
    },
    {
        id: 'safeSingletonFactory',
        name: 'Safe Singleton Factory',
        description: 'Factory for deploying Safe multisig wallets',
        githubUrl: 'https://github.com/safe-global/safe-singleton-factory',
        contractAddress: '0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7'
    },
    {
        id: 'icmMessenger',
        name: 'ICM Messenger',
        description: 'Interchain messaging contract for cross-chain communication',
        githubUrl: 'https://github.com/ava-labs/icm-contracts/tree/main/contracts/teleporter',
        contractAddress: '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf'
    },
    {
        id: 'wrappedNativeToken',
        name: 'Wrapped Native Token',
        description: 'ERC20 wrapper for the native token (WAVAX/WETH)',
        githubUrl: 'https://github.com/ava-labs/wrapped-native-token',
        contractAddress: '0x0200000000000000000000000000000000000006'
    }
];

export function PredeployedContractConfig({
    enabledContracts,
    onToggleContract
}: PredeployedContractConfigProps) {
    
    // Handle proxy and proxyAdmin together
    const handleToggle = (contractId: string) => {
        // If toggling proxy or proxyAdmin, toggle both
        if (contractId === 'proxy' || contractId === 'proxyAdmin') {
            const proxyEnabled = enabledContracts.has('proxy');
            const proxyAdminEnabled = enabledContracts.has('proxyAdmin');
            
            // If both are enabled, disable both. Otherwise enable both.
            if (proxyEnabled && proxyAdminEnabled) {
                // Disable both
                onToggleContract('proxy');
                onToggleContract('proxyAdmin');
            } else {
                // Enable both (enable any that aren't already enabled)
                if (!proxyEnabled) onToggleContract('proxy');
                if (!proxyAdminEnabled) onToggleContract('proxyAdmin');
            }
        } else {
            onToggleContract(contractId);
        }
    };
    
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Pre-deployed Contracts
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Standard contracts deployed at genesis
            </p>
            
            <div className="space-y-2">
                {PREDEPLOYED_CONTRACTS.map((contract) => (
                    <div 
                        key={contract.id} 
                        className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3"
                    >
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enabledContracts.has(contract.id)}
                                onChange={() => handleToggle(contract.id)}
                                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                                {contract.name}
                                {(contract.id === 'proxy' || contract.id === 'proxyAdmin') && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">
                                        (linked)
                                    </span>
                                )}
                            </span>
                        </label>
                        
                        {enabledContracts.has(contract.id) && (
                            <div className="mt-3 pl-6 space-y-2">
                                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                                    {contract.description}
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Address:</span>
                                        <code className="text-xs font-mono text-zinc-600 dark:text-zinc-300">
                                            {contract.contractAddress}
                                        </code>
                                    </div>
                                    <a
                                        href={contract.githubUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    >
                                        <span className="mr-1">GitHub</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export { PREDEPLOYED_CONTRACTS };
