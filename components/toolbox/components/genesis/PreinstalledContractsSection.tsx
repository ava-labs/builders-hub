import React, { useState } from 'react';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, className = '' }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900 ${
                checked 
                    ? 'bg-green-500 dark:bg-green-600' 
                    : 'bg-zinc-200 dark:bg-zinc-700'
            } ${className}`}
        >
            <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    checked ? 'translate-x-5' : 'translate-x-1'
                }`}
            />
        </button>
    );
};

export interface PreinstallConfig {
    proxy: boolean;
    proxyAdmin: boolean;
    safeSingletonFactory: boolean;
    multicall3: boolean;
    icmMessenger: boolean;
    wrappedNativeToken: boolean;
    create2Deployer: boolean;
}

interface PreinstalledContractsSectionProps {
    config: PreinstallConfig;
    onConfigChange: (config: PreinstallConfig) => void;
    ownerAddress?: string;
    tokenName?: string;
    tokenSymbol?: string;
}

interface ContractInfoProps {
    id: keyof PreinstallConfig;
    title: string;
    address: string;
    description: string;
    details: string[];
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    additionalInfo?: React.ReactNode;
}

const ContractInfo: React.FC<ContractInfoProps> = ({
    title,
    address,
    description,
    details,
    enabled,
    onToggle,
    additionalInfo
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-baseline space-x-2 mb-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">{title}</h3>
                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${enabled 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}>
                            {enabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{description}</p>
                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                        {address}
                    </div>
                </div>
                
                {/* Toggle Switch */}
                <div className="ml-4">
                    <Switch
                        checked={enabled}
                        onCheckedChange={onToggle}
                    />
                </div>
            </div>

            {/* Expand/Collapse button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
                {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                ) : (
                    <ChevronRight className="w-3 h-3" />
                )}
                <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
            </button>

            {/* Details (shown when expanded) */}
            {isExpanded && (
                <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-2">
                    <div className="space-y-1">
                        <h4 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">Features</h4>
                        {details.map((detail, index) => (
                            <div key={index} className="flex items-start space-x-2">
                                <div className="w-1 h-1 bg-zinc-400 dark:bg-zinc-500 rounded-full mt-1.5 flex-shrink-0" />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300">{detail}</span>
                            </div>
                        ))}
                    </div>
                    
                    {additionalInfo && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded">
                            {additionalInfo}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const PreinstalledContractsSection: React.FC<PreinstalledContractsSectionProps> = ({
    config,
    onConfigChange,
    ownerAddress,
    tokenName,
    tokenSymbol
}) => {
    const handleToggle = (key: keyof PreinstallConfig, enabled: boolean) => {
        let newConfig = {
            ...config,
            [key]: enabled
        };

        // Enable/disable Proxy and ProxyAdmin together
        if (key === 'proxy') {
            newConfig.proxyAdmin = enabled;
        } else if (key === 'proxyAdmin') {
            newConfig.proxy = enabled;
        }

        onConfigChange(newConfig);
    };

    const contracts = [
        {
            id: 'proxy' as keyof PreinstallConfig,
            title: 'Transparent Upgradeable Proxy',
            address: '0xfacade0000000000000000000000000000000000',
            description: 'OpenZeppelin transparent proxy for upgradeable contract patterns',
            details: [
                'Enables seamless smart contract upgrades',
                'Separates logic and storage through proxy pattern',
                'Transparent to end users and external contracts',
                'Industry standard for upgradeable contracts',
                'Required for ValidatorManager deployment on your chain'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3 text-blue-500" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Configuration</span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5">
                        <div>Implementation: 0x1212121212121212121212121212121212121212</div>
                        <div>Admin: 0xdad0000000000000000000000000000000000000</div>
                    </div>
                    <a 
                        href="https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.9/contracts/proxy/transparent/TransparentUpgradeableProxy.sol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                        View source code →
                    </a>
                </div>
            )
        },
        {
            id: 'proxyAdmin' as keyof PreinstallConfig,
            title: 'Proxy Admin Contract',
            address: '0xdad0000000000000000000000000000000000000',
            description: 'Administrative contract for managing proxy upgrades and ownership',
            details: [
                'Manages proxy contract administrative functions',
                'Controls upgrade permissions and timing',
                'Provides separation of concerns for proxy management',
                'Essential for secure upgrade workflows'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    {ownerAddress && (
                        <>
                            <div className="flex items-center space-x-2">
                                <Info className="w-3 h-3 text-blue-500" />
                                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Owner</span>
                            </div>
                            <div className="text-xs font-mono text-blue-700 dark:text-blue-400 break-all">
                                {ownerAddress}
                            </div>
                        </>
                    )}
                    <a 
                        href="https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.9/contracts/proxy/transparent/ProxyAdmin.sol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                        View source code →
                    </a>
                </div>
            )
        },
        {
            id: 'icmMessenger' as keyof PreinstallConfig,
            title: 'ICM Messenger',
            address: '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf',
            description: 'Core contract for Interchain Messaging (ICM) cross-subnet communication',
            details: [
                'Enables secure cross-subnet message sending and receiving',
                'Foundation for Avalanche Interchain Token Transfer (ICTT)',
                'Required for all ICM-based protocols and applications',
                'Handles message verification, routing, and delivery',
                'Supports fee payment in various tokens for message relaying'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3 text-blue-500" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">ICM Infrastructure</span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-400">
                        Standard TeleporterMessenger address for Avalanche interchain communication
                    </div>
                    <a 
                        href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/TeleporterMessenger.sol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                        View source code →
                    </a>
                </div>
            )
        },
        {
            id: 'wrappedNativeToken' as keyof PreinstallConfig,
            title: tokenName ? `Wrapped ${tokenName}${tokenSymbol ? ` (W${tokenSymbol})` : ''}` : 'Wrapped Native Token',
            address: '0x1111111111111111111111111111111111111111',
            description: `WETH-like contract for wrapping ${tokenName ? tokenName : 'native'} tokens into ERC-20 format`,
            details: [
                'Enables native tokens to be used in DeFi protocols',
                'Standard ERC-20 interface for wrapped native tokens',
                'Deposit native tokens to receive wrapped tokens',
                'Withdraw wrapped tokens to get native tokens back',
                'Essential for cross-chain token transfers and DeFi'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3 text-blue-500" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            Standard Implementation
                        </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-400 ml-5">
                        Compatible with WETH pattern used across DeFi
                    </p>
                    <a 
                        href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/WrappedNativeToken.sol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ml-5"
                    >
                        View source code →
                    </a>
                </div>
            )
        },
        {
            id: 'safeSingletonFactory' as keyof PreinstallConfig,
            title: 'Safe Singleton Factory',
            address: '0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7',
            description: 'Deterministic contract deployment factory using CREATE2',
            details: [
                'Enables deterministic contract addresses across chains',
                'Used by Safe multisig wallets and major DeFi protocols',
                'Supports CREATE2 deployment pattern',
                'Essential infrastructure for cross-chain applications'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3 text-blue-500" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Ecosystem</span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-400">
                        Required by Safe wallets, Gnosis, and many DeFi protocols
                    </div>
                    <a 
                        href="https://github.com/safe-global/safe-singleton-factory/blob/main/source/deterministic-deployment-proxy.yul"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                        View source code →
                    </a>
                </div>
            )
        },
        {
            id: 'multicall3' as keyof PreinstallConfig,
            title: 'Multicall3',
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            description: 'Efficient batching contract for multiple function calls in a single transaction',
            details: [
                'Aggregate multiple function calls into a single transaction',
                'Reduces gas costs and improves user experience',
                'Standard address across all EVM chains',
                'Essential for DeFi protocols and dApps',
                'Backwards compatible with Multicall and Multicall2'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3 text-blue-500" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Standard</span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-400">
                        Canonical address used across Ethereum, Polygon, BSC, and other chains
                    </div>
                    <a 
                        href="https://github.com/mds1/multicall3/blob/main/src/Multicall3.sol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                        View source code →
                    </a>
                </div>
            )
        },
        {
            id: 'create2Deployer' as keyof PreinstallConfig,
            title: 'Create2Deployer',
            address: '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2',
            description: 'Helper smart contract for easier and safer usage of the CREATE2 EVM opcode',
            details: [
                'Deploy contracts with deterministic addresses using CREATE2',
                'Compute contract addresses in advance via computeAddress function',
                'Enables counterfactual interactions and advanced deployment patterns',
                'Owner-controlled with pause/unpause functionality for security',
                'Supports payable constructors with value transfers during deployment'
            ],
            additionalInfo: (
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <Info className="w-3 h-3 text-blue-500" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            CREATE2 Helper
                        </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-400 ml-5">
                        By Pascal Marco Caversaccio - safer CREATE2 usage with ownership and pausable controls
                    </p>
                    <a 
                        href="https://github.com/pcaversaccio/create2deployer/blob/main/contracts/Create2Deployer.sol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ml-5"
                    >
                        View source code →
                    </a>
                </div>
            )
        }
    ];

    const enabledCount = Object.values(config).filter(Boolean).length;
    const totalCount = contracts.length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                    Pre-Deployed Contracts
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Configure essential infrastructure contracts that will be deployed in your genesis block.
                </p>
                
                {/* Status Summary */}
                <div className="inline-flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                    <div className={`w-1.5 h-1.5 rounded-full ${enabledCount === totalCount ? 'bg-green-500' : enabledCount > 0 ? 'bg-yellow-500' : 'bg-zinc-400'}`} />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {enabledCount} of {totalCount} contracts enabled
                    </span>
                </div>
            </div>

            {/* Contracts Stack */}
            <div className="space-y-3">
                {contracts.map((contract) => (
                    <ContractInfo
                        key={contract.id}
                        {...contract}
                        enabled={config[contract.id]}
                        onToggle={(enabled) => handleToggle(contract.id, enabled)}
                        additionalInfo={contract.additionalInfo}
                    />
                ))}
            </div>

            {/* Footer Note */}
            {enabledCount < totalCount && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                        <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Recommendation</h4>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                                We recommend enabling all pre-installed contracts for maximum compatibility with 
                                ACP-77, existing DeFi protocols, and wallet infrastructure.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}; 