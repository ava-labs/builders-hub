"use client";

import { useEffect, useState, useCallback, SetStateAction } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { AlertCircle } from "lucide-react";
import { Address } from "viem";

// Genesis Utilities & Types
import { generateGenesis } from "@/components/toolbox/components/genesis/genGenesis";
import {
    AllocationEntry,
    AllowlistPrecompileConfig,
    FeeConfigType,
    ValidationMessages,
    generateEmptyAllowlistPrecompileConfig,
    isValidAllowlistPrecompileConfig
} from "@/components/toolbox/components/genesis/types";
import { PreinstallConfig } from "@/components/toolbox/components/genesis/PreinstalledContractsSection";
import { PrecompileConfig } from './PrecompileConfig';
import type { PrecompileConfigData } from './PrecompileConfig';
import { PredeployedContractConfig } from './PredeployedContractConfig';

// --- Constants --- 
const DEFAULT_FEE_CONFIG: FeeConfigType = {
    baseFeeChangeDenominator: 48,
    blockGasCostStep: 200000,
    maxBlockGasCost: 1000000,
    minBaseFee: 25000000000, // 25 gwei
    minBlockGasCost: 0,
    targetGas: 15000000
};

// Helper function to convert gwei to wei
const gweiToWei = (gwei: number): number => gwei * 1000000000;

// --- Main Component --- 

type GenesisBuilderProps = {
    genesisData: string;
    setGenesisData: (data: string) => void;
    wizardMode?: boolean;  // When true, doesn't show tabs/genesis JSON as it's shown elsewhere
    onValidationChange?: (messages: ValidationMessages) => void;
};

export default function GenesisBuilder({ genesisData, setGenesisData, wizardMode = false, onValidationChange }: GenesisBuilderProps) {
    const { walletEVMAddress } = useWalletStore();

    // --- State --- 
    const [evmChainId, setEvmChainId] = useState<number>(10000 + Math.floor(Math.random() * 90000));
    const [tokenName, setTokenName] = useState<string>("COIN");
    const [tokenSymbol, setTokenSymbol] = useState<string>("COIN");
    const [gasLimit, setGasLimit] = useState<number>(15000000);
    const [targetBlockRate, setTargetBlockRate] = useState<number>(2);
    const [tokenAllocations, setTokenAllocations] = useState<AllocationEntry[]>([]);
    const [feeConfig, setFeeConfig] = useState<FeeConfigType>(DEFAULT_FEE_CONFIG);

    // Using the AllowlistPrecompileConfig as the single source of truth for allowlists
    const [contractDeployerAllowListConfig, setContractDeployerAllowListConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [contractNativeMinterConfig, setContractNativeMinterConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [txAllowListConfig, setTxAllowListConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());

    // State for simple precompiles (can be integrated into FeeConfig component later if needed)
    const [feeManagerEnabled, setFeeManagerEnabled] = useState(false);
    const [feeManagerAdmins, setFeeManagerAdmins] = useState<Address[]>([]);
    const [rewardManagerEnabled, setRewardManagerEnabled] = useState(false);
    const [rewardManagerAdmins, setRewardManagerAdmins] = useState<Address[]>([]);

    // Fixed Warp config for now (can be made configurable later)
    const warpConfig = {
        enabled: true,
        quorumNumerator: 67,
        requirePrimaryNetworkSigners: true
    }

    const [validationMessages, setValidationMessages] = useState<ValidationMessages>({ errors: {}, warnings: {} });
    
    // Pass validation messages to parent
    useEffect(() => {
        if (onValidationChange) {
            onValidationChange(validationMessages);
        }
    }, [validationMessages, onValidationChange]);

    // Add a flag to control when genesis should be generated
    const [shouldGenerateGenesis, setShouldGenerateGenesis] = useState(false);

    // Preinstall configuration state
    const [preinstallConfig, setPreinstallConfig] = useState<PreinstallConfig>({
        proxy: true,
        proxyAdmin: true,
        safeSingletonFactory: true,
        multicall3: true,
        icmMessenger: true,
        wrappedNativeToken: true,
        create2Deployer: true,
    });

    // Convert preinstallConfig to Set for the new component
    const enabledContracts = new Set<string>(
        Object.entries(preinstallConfig)
            .filter(([_, enabled]) => enabled)
            .map(([id]) => id)
    );

    const handleToggleContract = (contractId: string) => {
        setPreinstallConfig(prev => ({
            ...prev,
            [contractId]: !prev[contractId as keyof PreinstallConfig]
        }));
    };

    // --- Effects --- 

    // Initialize owner allocation when wallet address is available
    useEffect(() => {
        if (walletEVMAddress && tokenAllocations.length === 0) {
            setTokenAllocations([{ address: walletEVMAddress as Address, amount: 1000000 }]);
        }
    }, [walletEVMAddress, tokenAllocations.length]);

    // Validate configuration whenever relevant state changes
    useEffect(() => {
        const errors: { [key: string]: string } = {};
        const warnings: { [key: string]: string } = {};

        // Chain ID
        if (evmChainId <= 0) errors.chainId = "Chain ID must be positive";

        // Token Name and Symbol validation
        if (tokenName.length > 50) errors.tokenName = "Token name must be 50 characters or less";
        
        if (tokenSymbol.length < 2 || tokenSymbol.length > 6) errors.tokenSymbol = "Token symbol must be 2-6 characters";
        else if (!/^[A-Z0-9]+$/.test(tokenSymbol)) warnings.tokenSymbol = "Token symbol should be uppercase letters and numbers only";

        // Gas Limit
        if (gasLimit < 0) errors.gasLimit = "Gas limit must be non-negative";
        if (gasLimit < 15000000) warnings.gasLimit = "Gas limit below 15M may impact network performance";
        if (gasLimit > 30000000) warnings.gasLimit = "Gas limit above 30M may require significant resources";

        // Block Rate
        if (targetBlockRate <= 0) errors.blockRate = "Block rate must be positive";
        if (targetBlockRate > 10) warnings.blockRate = "Block rates above 10 seconds may impact user experience";

        // Token Allocations
        if (tokenAllocations.length === 0) errors.tokenAllocations = "At least one token allocation is required.";
        tokenAllocations.forEach((alloc, index) => {
            if (!alloc.address || !/^0x[a-fA-F0-9]{40}$/.test(alloc.address)) errors[`alloc_${index}_addr`] = `Allocation ${index + 1}: Invalid address format`;
            if (isNaN(alloc.amount) || alloc.amount < 0) errors[`alloc_${index}_amt`] = `Allocation ${index + 1}: Invalid amount`;
        });

        // Allowlist Precompiles
        if (!isValidAllowlistPrecompileConfig(contractDeployerAllowListConfig)) errors.contractDeployerAllowList = "Contract Deployer Allow List: Configuration is invalid or requires at least one valid address.";
        if (!isValidAllowlistPrecompileConfig(contractNativeMinterConfig)) errors.contractNativeMinter = "Native Minter: Configuration is invalid or requires at least one valid address.";
        if (!isValidAllowlistPrecompileConfig(txAllowListConfig)) errors.txAllowList = "Transaction Allow List: Configuration is invalid or requires at least one valid address.";

        // Fee/Reward Manager
        if (feeManagerEnabled && feeManagerAdmins.length === 0) errors.feeManager = "Fee Manager: At least one admin address is required when enabled.";
        if (rewardManagerEnabled && rewardManagerAdmins.length === 0) errors.rewardManager = "Reward Manager: At least one admin address is required when enabled.";

        // Fee Config Parameters
        if (feeConfig.minBaseFee < 0) errors.minBaseFee = "Min base fee must be non-negative";
        if (feeConfig.minBaseFee < gweiToWei(1)) warnings.minBaseFee = "Min base fee below 1 gwei may cause issues";
        if (feeConfig.minBaseFee > gweiToWei(500)) warnings.minBaseFee = "Min base fee above 500 gwei may be expensive";

        if (feeConfig.targetGas < 0) errors.targetGas = "Target gas must be non-negative";
        if (feeConfig.targetGas < 1000000) warnings.targetGas = "Target gas below 1M may lead to congestion";
        if (feeConfig.targetGas > 50000000) warnings.targetGas = "Target gas above 50M may require significant resources";

        if (feeConfig.baseFeeChangeDenominator < 0) errors.baseFeeChangeDenominator = "Base fee change denominator must be non-negative";
        if (feeConfig.baseFeeChangeDenominator < 8) warnings.baseFeeChangeDenominator = "Low denominator may cause fees to change too rapidly";
        if (feeConfig.baseFeeChangeDenominator > 1000) warnings.baseFeeChangeDenominator = "High denominator may cause fees to react too slowly";

        if (feeConfig.minBlockGasCost < 0) errors.minBlockGasCost = "Min block gas cost must be non-negative";
        if (feeConfig.minBlockGasCost > 1e9) warnings.minBlockGasCost = "Min block gas cost above 1B may impact performance";

        if (feeConfig.maxBlockGasCost < feeConfig.minBlockGasCost) errors.maxBlockGasCost = "Max block gas cost must be >= min block gas cost";
        if (feeConfig.maxBlockGasCost > 1e10) warnings.maxBlockGasCost = "Max block gas cost above 10B may impact performance";

        if (feeConfig.blockGasCostStep < 0) errors.blockGasCostStep = "Block gas cost step must be non-negative";
        if (feeConfig.blockGasCostStep > 5000000) warnings.blockGasCostStep = "Block gas cost step above 5M may cause fees to change too rapidly";

        // Update validation messages but don't trigger genesis generation here
        setValidationMessages({ errors, warnings });

        // Only set the flag to generate genesis if there are no errors
        setShouldGenerateGenesis(Object.keys(errors).length === 0);
    }, [
        evmChainId, tokenName, tokenSymbol, gasLimit, targetBlockRate, tokenAllocations,
        contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig,
        feeManagerEnabled, feeManagerAdmins, rewardManagerEnabled, rewardManagerAdmins,
        feeConfig, preinstallConfig
    ]);

    // Generate genesis file only when shouldGenerateGenesis is true
    useEffect(() => {
        // Add a debounce to prevent multiple rapid updates
        const debounceTimer = setTimeout(() => {
            // Don't proceed if we shouldn't generate genesis
            if (!shouldGenerateGenesis) {
                setGenesisData(""); // Clear genesis data if we shouldn't generate
                return;
            }

            try {
                // Ensure there's at least one allocation, and get the owner address
                if (tokenAllocations.length === 0 || !tokenAllocations[0].address) {
                    setGenesisData("Error: Valid first allocation address needed for ownership.");
                    return;
                }
                const ownerAddressForProxy = tokenAllocations[0].address;

                // Clone the data to avoid potential mutation issues
                const tokenAllocationsCopy = [...tokenAllocations];
                const txAllowListCopy = { ...txAllowListConfig };
                const contractDeployerAllowListCopy = { ...contractDeployerAllowListConfig };
                const contractNativeMinterCopy = { ...contractNativeMinterConfig };
                const feeConfigCopy = { ...feeConfig };

                const baseGenesis = generateGenesis({
                    evmChainId: evmChainId,
                    tokenAllocations: tokenAllocationsCopy,
                    txAllowlistConfig: txAllowListCopy,
                    contractDeployerAllowlistConfig: contractDeployerAllowListCopy,
                    nativeMinterAllowlistConfig: contractNativeMinterCopy,
                    poaOwnerAddress: ownerAddressForProxy as Address,
                    preinstallConfig: preinstallConfig,
                    tokenName: tokenName,
                    tokenSymbol: tokenSymbol
                });

                // Override feeConfig, gasLimit, targetBlockRate, warpConfig in the base genesis
                const finalGenesisConfig = {
                    ...baseGenesis,
                    gasLimit: `0x${gasLimit.toString(16)}`,
                    config: {
                        ...baseGenesis.config,
                        feeConfig: {
                            ...feeConfigCopy,
                            gasLimit: gasLimit, // Keep gasLimit here as well for clarity
                            targetBlockRate: targetBlockRate,
                        },
                        warpConfig: {
                            blockTimestamp: Math.floor(Date.now() / 1000),
                            quorumNumerator: warpConfig.quorumNumerator,
                            requirePrimaryNetworkSigners: warpConfig.requirePrimaryNetworkSigners,
                        },
                        // Add FeeManager and RewardManager configs if enabled
                        ...(feeManagerEnabled && {
                            feeManagerConfig: {
                                adminAddresses: [...feeManagerAdmins],
                                blockTimestamp: Math.floor(Date.now() / 1000)
                            }
                        }),
                        ...(rewardManagerEnabled && {
                            rewardManagerConfig: {
                                adminAddresses: [...rewardManagerAdmins],
                                blockTimestamp: Math.floor(Date.now() / 1000)
                            }
                        }),
                    },
                    timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`
                };
                console.log("settingGenesis");
                setGenesisData(JSON.stringify(finalGenesisConfig, null, 2));
            } catch (error) {
                console.error("Error generating genesis data:", error);
                setGenesisData(`Error generating genesis: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(debounceTimer);
        // Only depend on shouldGenerateGenesis flag and the actual data needed
    }, [shouldGenerateGenesis, evmChainId, gasLimit, targetBlockRate, tokenAllocations, contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig, feeManagerEnabled, feeManagerAdmins, rewardManagerEnabled, rewardManagerAdmins, feeConfig, warpConfig, preinstallConfig, setGenesisData]);

    // --- Handlers ---

    // Memoize common props for TokenomicsSection
    const handleTokenAllocationsChange = useCallback((newAllocations: SetStateAction<AllocationEntry[]>) => {
        setTokenAllocations(newAllocations);
    }, []);

    // Memoize common props for PermissionsSection
    const handleDeployerConfigChange = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setContractDeployerAllowListConfig(config);
    }, []);

    const handleTxConfigChange = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setTxAllowListConfig(config);
    }, []);

    const handleNativeMinterConfigChange = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setContractNativeMinterConfig(config);
    }, []);

    // Memoize common props for TransactionFeesSection
    const handleFeeConfigChange = useCallback((config: SetStateAction<FeeConfigType>) => {
        setFeeConfig(config);
    }, []);

    const handleSetGasLimit = useCallback((limit: SetStateAction<number>) => {
        setGasLimit(limit);
    }, []);

    const handleSetTargetBlockRate = useCallback((rate: SetStateAction<number>) => {
        setTargetBlockRate(rate);
    }, []);

    const handleSetFeeManagerEnabled = useCallback((enabled: SetStateAction<boolean>) => {
        setFeeManagerEnabled(enabled);
    }, []);

    const handleSetFeeManagerAdmins = useCallback((admins: SetStateAction<Address[]>) => {
        setFeeManagerAdmins(admins);
    }, []);

    const handleSetRewardManagerEnabled = useCallback((enabled: SetStateAction<boolean>) => {
        setRewardManagerEnabled(enabled);
    }, []);

    const handleSetRewardManagerAdmins = useCallback((admins: SetStateAction<Address[]>) => {
        setRewardManagerAdmins(admins);
    }, []);

    const handleSetEvmChainId = useCallback((id: SetStateAction<number>) => {
        setEvmChainId(id);
    }, []);

    // --- Render --- 
    
    // Show only the essential configuration sections
    return (
            <div className="space-y-6">
                {/* Basic Chain Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Chain ID
                        </label>
                        <input
                            type="number"
                            value={evmChainId}
                            onChange={(e) => handleSetEvmChainId(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                            placeholder="e.g., 12345"
                        />
                        {validationMessages.errors.chainId && (
                            <p className="text-xs text-red-500 mt-1">{validationMessages.errors.chainId}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Token Name
                            </label>
                            <input
                                type="text"
                                value={tokenName}
                                onChange={(e) => setTokenName(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                placeholder="e.g., Avalanche"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Symbol
                            </label>
                            <input
                                type="text"
                                value={tokenSymbol}
                                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                placeholder="e.g., AVAX"
                                maxLength={6}
                            />
                        </div>
                    </div>
                </div>

                {/* Initial Token Distribution */}
                <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Initial Token Distribution
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                        Allocate initial tokens to addresses (amounts in whole tokens)
                    </p>
                    
                    {tokenAllocations.map((allocation, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={allocation.address}
                                onChange={(e) => {
                                    const newAllocations = [...tokenAllocations];
                                    newAllocations[index].address = e.target.value as Address;
                                    handleTokenAllocationsChange(newAllocations);
                                }}
                                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                placeholder="0x... wallet address"
                            />
                            <input
                                type="number"
                                value={allocation.amount}
                                onChange={(e) => {
                                    const newAllocations = [...tokenAllocations];
                                    newAllocations[index].amount = parseFloat(e.target.value) || 0;
                                    handleTokenAllocationsChange(newAllocations);
                                }}
                                className="w-32 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                placeholder="Amount"
                            />
                            {tokenAllocations.length > 1 && (
                                <button
                                    onClick={() => {
                                        const newAllocations = tokenAllocations.filter((_, i) => i !== index);
                                        handleTokenAllocationsChange(newAllocations);
                                    }}
                                    className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    
                    <button
                        onClick={() => {
                            handleTokenAllocationsChange([...tokenAllocations, { address: '' as Address, amount: 0 }]);
                        }}
                        className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                        + Add another address
                    </button>
                </div>

                {/* Precompiles Configuration */}
                <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Precompiles
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                        Enable blockchain precompiles for additional functionality
                    </p>
                    
                    <div className="space-y-3">
                        {/* Contract Deployer Allow List */}
                        <PrecompileConfig 
                            title="Contract Deployer Allow List"
                            config={contractDeployerAllowListConfig as PrecompileConfigData}
                            onConfigChange={(config) => setContractDeployerAllowListConfig(config)}
                            walletAddress={walletEVMAddress}
                            roles={[
                                {
                                    key: 'Admin',
                                    label: 'Admin Addresses',
                                    description: 'Can grant/revoke roles',
                                    buttonText: '+ Add admin'
                                },
                                {
                                    key: 'Manager',
                                    label: 'Manager Addresses',
                                    description: 'Can enable/disable addresses',
                                    buttonText: '+ Add manager'
                                },
                                {
                                    key: 'Enabled',
                                    label: 'Enabled Addresses',
                                    description: 'Can deploy contracts',
                                    buttonText: '+ Add enabled address'
                                }
                            ]}
                        />

                        {/* Native Minter */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={contractNativeMinterConfig.activated}
                                    onChange={(e) => {
                                        const activated = e.target.checked;
                                        if (!activated) {
                                            setContractNativeMinterConfig(generateEmptyAllowlistPrecompileConfig());
                                        } else {
                                            setContractNativeMinterConfig({
                                                activated: true,
                                                addresses: {
                                                    Admin: walletEVMAddress ? [{ id: '1', address: walletEVMAddress as Address }] : [],
                                                    Manager: [],
                                                    Enabled: []
                                                }
                                            });
                                        }
                                    }}
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Native Token Minter</span>
                            </label>
                            
                            {contractNativeMinterConfig.activated && (
                                <div className="mt-3 pl-6 space-y-3">
                                    {/* Admin Addresses */}
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Admin Addresses</label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can grant/revoke roles</p>
                                        {contractNativeMinterConfig.addresses.Admin.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-1 mb-1">
                                                <input
                                                    type="text"
                                                    value={entry.address}
                                                    onChange={(e) => {
                                                        const newConfig = { ...contractNativeMinterConfig };
                                                        newConfig.addresses.Admin[idx].address = e.target.value as Address;
                                                        setContractNativeMinterConfig(newConfig);
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                    placeholder="0x..."
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...contractNativeMinterConfig };
                                                        newConfig.addresses.Admin = newConfig.addresses.Admin.filter(a => a.id !== entry.id);
                                                        setContractNativeMinterConfig(newConfig);
                                                    }}
                                                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newConfig = { ...contractNativeMinterConfig };
                                                const newId = Date.now().toString();
                                                newConfig.addresses.Admin.push({ id: newId, address: '' as Address });
                                                setContractNativeMinterConfig(newConfig);
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                            + Add admin
                                        </button>
                                    </div>
                                    
                                    {/* Manager Addresses */}
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Manager Addresses</label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can enable/disable minters</p>
                                        {contractNativeMinterConfig.addresses.Manager.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-1 mb-1">
                                                <input
                                                    type="text"
                                                    value={entry.address}
                                                    onChange={(e) => {
                                                        const newConfig = { ...contractNativeMinterConfig };
                                                        newConfig.addresses.Manager[idx].address = e.target.value as Address;
                                                        setContractNativeMinterConfig(newConfig);
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                    placeholder="0x..."
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...contractNativeMinterConfig };
                                                        newConfig.addresses.Manager = newConfig.addresses.Manager.filter(a => a.id !== entry.id);
                                                        setContractNativeMinterConfig(newConfig);
                                                    }}
                                                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newConfig = { ...contractNativeMinterConfig };
                                                const newId = Date.now().toString();
                                                newConfig.addresses.Manager.push({ id: newId, address: '' as Address });
                                                setContractNativeMinterConfig(newConfig);
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                            + Add manager
                                        </button>
                                    </div>
                                    
                                    {/* Enabled Addresses (Minters) */}
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Enabled Addresses</label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can mint native tokens</p>
                                        {contractNativeMinterConfig.addresses.Enabled.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-1 mb-1">
                                                <input
                                                    type="text"
                                                    value={entry.address}
                                                    onChange={(e) => {
                                                        const newConfig = { ...contractNativeMinterConfig };
                                                        newConfig.addresses.Enabled[idx].address = e.target.value as Address;
                                                        setContractNativeMinterConfig(newConfig);
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                    placeholder="0x..."
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...contractNativeMinterConfig };
                                                        newConfig.addresses.Enabled = newConfig.addresses.Enabled.filter(a => a.id !== entry.id);
                                                        setContractNativeMinterConfig(newConfig);
                                                    }}
                                                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newConfig = { ...contractNativeMinterConfig };
                                                const newId = Date.now().toString();
                                                newConfig.addresses.Enabled.push({ id: newId, address: '' as Address });
                                                setContractNativeMinterConfig(newConfig);
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                            + Add minter
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Transaction Allow List */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={txAllowListConfig.activated}
                                    onChange={(e) => {
                                        const activated = e.target.checked;
                                        if (!activated) {
                                            setTxAllowListConfig(generateEmptyAllowlistPrecompileConfig());
                                        } else {
                                            setTxAllowListConfig({
                                                activated: true,
                                                addresses: {
                                                    Admin: walletEVMAddress ? [{ id: '1', address: walletEVMAddress as Address }] : [],
                                                    Manager: [],
                                                    Enabled: []
                                                }
                                            });
                                        }
                                    }}
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Transaction Allow List</span>
                            </label>
                            
                            {txAllowListConfig.activated && (
                                <div className="mt-3 pl-6 space-y-3">
                                    {/* Admin Addresses */}
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Admin Addresses</label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can grant/revoke roles</p>
                                        {txAllowListConfig.addresses.Admin.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-1 mb-1">
                                                <input
                                                    type="text"
                                                    value={entry.address}
                                                    onChange={(e) => {
                                                        const newConfig = { ...txAllowListConfig };
                                                        newConfig.addresses.Admin[idx].address = e.target.value as Address;
                                                        setTxAllowListConfig(newConfig);
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                    placeholder="0x..."
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...txAllowListConfig };
                                                        newConfig.addresses.Admin = newConfig.addresses.Admin.filter(a => a.id !== entry.id);
                                                        setTxAllowListConfig(newConfig);
                                                    }}
                                                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newConfig = { ...txAllowListConfig };
                                                const newId = Date.now().toString();
                                                newConfig.addresses.Admin.push({ id: newId, address: '' as Address });
                                                setTxAllowListConfig(newConfig);
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                            + Add admin
                                        </button>
                                    </div>
                                    
                                    {/* Manager Addresses */}
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Manager Addresses</label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can enable/disable addresses</p>
                                        {txAllowListConfig.addresses.Manager.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-1 mb-1">
                                                <input
                                                    type="text"
                                                    value={entry.address}
                                                    onChange={(e) => {
                                                        const newConfig = { ...txAllowListConfig };
                                                        newConfig.addresses.Manager[idx].address = e.target.value as Address;
                                                        setTxAllowListConfig(newConfig);
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                    placeholder="0x..."
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...txAllowListConfig };
                                                        newConfig.addresses.Manager = newConfig.addresses.Manager.filter(a => a.id !== entry.id);
                                                        setTxAllowListConfig(newConfig);
                                                    }}
                                                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newConfig = { ...txAllowListConfig };
                                                const newId = Date.now().toString();
                                                newConfig.addresses.Manager.push({ id: newId, address: '' as Address });
                                                setTxAllowListConfig(newConfig);
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                            + Add manager
                                        </button>
                                    </div>
                                    
                                    {/* Enabled Addresses (Allowed) */}
                                    <div>
                                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Enabled Addresses</label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can submit transactions</p>
                                        {txAllowListConfig.addresses.Enabled.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-1 mb-1">
                                                <input
                                                    type="text"
                                                    value={entry.address}
                                                    onChange={(e) => {
                                                        const newConfig = { ...txAllowListConfig };
                                                        newConfig.addresses.Enabled[idx].address = e.target.value as Address;
                                                        setTxAllowListConfig(newConfig);
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                    placeholder="0x..."
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newConfig = { ...txAllowListConfig };
                                                        newConfig.addresses.Enabled = newConfig.addresses.Enabled.filter(a => a.id !== entry.id);
                                                        setTxAllowListConfig(newConfig);
                                                    }}
                                                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newConfig = { ...txAllowListConfig };
                                                const newId = Date.now().toString();
                                                newConfig.addresses.Enabled.push({ id: newId, address: '' as Address });
                                                setTxAllowListConfig(newConfig);
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                        >
                                            + Add allowed address
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fee Manager */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={feeManagerEnabled}
                                    onChange={(e) => {
                                        setFeeManagerEnabled(e.target.checked);
                                        if (e.target.checked && walletEVMAddress) {
                                            setFeeManagerAdmins([walletEVMAddress as Address]);
                                        } else {
                                            setFeeManagerAdmins([]);
                                        }
                                    }}
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Fee Manager</span>
                            </label>
                            
                            {feeManagerEnabled && (
                                <div className="mt-3 pl-6">
                                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Admin Addresses</label>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can configure fee settings</p>
                                    {feeManagerAdmins.map((address, idx) => (
                                        <div key={idx} className="flex gap-1 mb-1">
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={(e) => {
                                                    const newAdmins = [...feeManagerAdmins];
                                                    newAdmins[idx] = e.target.value as Address;
                                                    setFeeManagerAdmins(newAdmins);
                                                }}
                                                className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                placeholder="0x..."
                                            />
                                            <button
                                                onClick={() => {
                                                    setFeeManagerAdmins(feeManagerAdmins.filter((_, i) => i !== idx));
                                                }}
                                                className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            setFeeManagerAdmins([...feeManagerAdmins, '' as Address]);
                                        }}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                    >
                                        + Add admin
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Reward Manager */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rewardManagerEnabled}
                                    onChange={(e) => {
                                        setRewardManagerEnabled(e.target.checked);
                                        if (e.target.checked && walletEVMAddress) {
                                            setRewardManagerAdmins([walletEVMAddress as Address]);
                                        } else {
                                            setRewardManagerAdmins([]);
                                        }
                                    }}
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Reward Manager</span>
                            </label>
                            
                            {rewardManagerEnabled && (
                                <div className="mt-3 pl-6">
                                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Admin Addresses</label>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1">Can configure reward settings</p>
                                    {rewardManagerAdmins.map((address, idx) => (
                                        <div key={idx} className="flex gap-1 mb-1">
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={(e) => {
                                                    const newAdmins = [...rewardManagerAdmins];
                                                    newAdmins[idx] = e.target.value as Address;
                                                    setRewardManagerAdmins(newAdmins);
                                                }}
                                                className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white"
                                                placeholder="0x..."
                                            />
                                            <button
                                                onClick={() => {
                                                    setRewardManagerAdmins(rewardManagerAdmins.filter((_, i) => i !== idx));
                                                }}
                                                className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            setRewardManagerAdmins([...rewardManagerAdmins, '' as Address]);
                                        }}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
                                    >
                                        + Add admin
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Warp Messenger (always enabled) */}
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 opacity-60">
                            <label className="flex items-center space-x-2 cursor-not-allowed">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    disabled
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-500"
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Warp Messenger</span>
                            </label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2 pl-6">Required for cross-chain communication</p>
                        </div>
                    </div>
                </div>

                {/* Pre-deployed Contracts */}
                <div className="border-t pt-4">
                    <PredeployedContractConfig 
                        enabledContracts={enabledContracts}
                        onToggleContract={handleToggleContract}
                    />
                </div>

                {/* Fee and Block Settings */}
                <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Fee and Block Settings</h3>
                    <div className="space-y-4">
                        {/* Gas Configuration */}
                        <div>
                            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Gas Configuration</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Gas Limit
                                    </label>
                                    <input
                                        type="number"
                                        value={gasLimit}
                                        onChange={(e) => handleSetGasLimit(parseInt(e.target.value) || 15000000)}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="15000000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Target Gas (per second)
                                    </label>
                                    <input
                                        type="number"
                                        value={feeConfig.targetGas}
                                        onChange={(e) => {
                                            const newFeeConfig = { ...feeConfig, targetGas: parseInt(e.target.value) || 15000000 };
                                            handleFeeConfigChange(newFeeConfig);
                                        }}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="15000000"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Block Configuration */}
                        <div>
                            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Block Configuration</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Target Block Rate (seconds)
                                    </label>
                                    <input
                                        type="number"
                                        value={targetBlockRate}
                                        onChange={(e) => handleSetTargetBlockRate(parseInt(e.target.value) || 2)}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Min Block Gas Cost
                                    </label>
                                    <input
                                        type="number"
                                        value={feeConfig.minBlockGasCost}
                                        onChange={(e) => {
                                            const newFeeConfig = { ...feeConfig, minBlockGasCost: parseInt(e.target.value) || 0 };
                                            handleFeeConfigChange(newFeeConfig);
                                        }}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Max Block Gas Cost
                                    </label>
                                    <input
                                        type="number"
                                        value={feeConfig.maxBlockGasCost}
                                        onChange={(e) => {
                                            const newFeeConfig = { ...feeConfig, maxBlockGasCost: parseInt(e.target.value) || 1000000 };
                                            handleFeeConfigChange(newFeeConfig);
                                        }}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="1000000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Block Gas Cost Step
                                    </label>
                                    <input
                                        type="number"
                                        value={feeConfig.blockGasCostStep}
                                        onChange={(e) => {
                                            const newFeeConfig = { ...feeConfig, blockGasCostStep: parseInt(e.target.value) || 200000 };
                                            handleFeeConfigChange(newFeeConfig);
                                        }}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="200000"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Fee Configuration */}
                        <div>
                            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Fee Parameters</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Min Base Fee (Gwei)
                                    </label>
                                    <input
                                        type="number"
                                        value={feeConfig.minBaseFee / 1000000000}
                                        onChange={(e) => {
                                            const newFeeConfig = { ...feeConfig, minBaseFee: (parseFloat(e.target.value) || 25) * 1000000000 };
                                            handleFeeConfigChange(newFeeConfig);
                                        }}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="25"
                                    />
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                        Minimum gas price in Gwei
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                        Base Fee Change Denominator
                                    </label>
                                    <input
                                        type="number"
                                        value={feeConfig.baseFeeChangeDenominator}
                                        onChange={(e) => {
                                            const newFeeConfig = { ...feeConfig, baseFeeChangeDenominator: parseInt(e.target.value) || 48 };
                                            handleFeeConfigChange(newFeeConfig);
                                        }}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-white text-sm"
                                        placeholder="48"
                                    />
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                        Controls fee adjustment speed (higher = slower)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Validation Summary - Only show in non-wizard mode */}
                {!wizardMode && (
                <div>
                    {Object.keys(validationMessages.errors).length > 0 ? (
                        <div className="bg-red-50/70 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 p-4 rounded-md flex items-start">
                            <AlertCircle className="text-red-500 mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-red-800 dark:text-red-300">Please fix the following errors:</h4>
                                <ul className="mt-2 list-disc list-inside text-sm text-red-700 dark:text-red-400">
                                    {Object.entries(validationMessages.errors).map(([key, message]) => (
                                        <li key={key}>{message}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : null}

                    {Object.keys(validationMessages.warnings).length > 0 && (
                        <div className="bg-yellow-50/70 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/60 p-4 rounded-md flex items-start mt-4">
                            <AlertCircle className="text-yellow-500 mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Configuration Warnings:</h4>
                                <ul className="mt-2 list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400">
                                    {Object.entries(validationMessages.warnings).map(([key, message]) => (
                                        <li key={key}>{message}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>
    );
}