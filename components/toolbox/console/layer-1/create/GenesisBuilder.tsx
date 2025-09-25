"use client";

import { useEffect, useState, useCallback, SetStateAction } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { Address } from "viem";
import { Input } from '@/components/toolbox/components/Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ExternalLink } from 'lucide-react';
import { GenesisHighlightProvider, useGenesisHighlight } from '@/components/toolbox/components/genesis/GenesisHighlightContext';

// Genesis Components
import { TokenomicsSection } from "@/components/toolbox/components/genesis/sections/TokenomicsSection";
import { PermissioningSection } from "@/components/toolbox/components/genesis/sections/PermissioningSection";
import { FeeConfigurationSection } from "@/components/toolbox/components/genesis/sections/FeeConfigurationSection";
import { PredeploysSection } from "@/components/toolbox/components/genesis/sections/PredeploysSection";

// Genesis Utilities & Types
import { generateGenesis } from "@/components/toolbox/components/genesis/genGenesis";
import {
    AllocationEntry,
    AllowlistPrecompileConfig,
    FeeConfigType,
    PreinstallConfig,
    SectionId,
    ValidationMessages,
    generateEmptyAllowlistPrecompileConfig,
    isValidAllowlistPrecompileConfig
} from "@/components/toolbox/components/genesis/types";

// --- Constants --- 
const DEFAULT_FEE_CONFIG: FeeConfigType = {
    baseFeeChangeDenominator: 48,
    blockGasCostStep: 200000,
    maxBlockGasCost: 1000000,
    minBaseFee: 25000000000,
    minBlockGasCost: 0,
    targetGas: 15000000
};

// Chain Configuration Constants
const MIN_CHAIN_ID = 10000;
const MAX_CHAIN_ID = 100000;
const DEFAULT_TOKEN_AMOUNT = 1000000;
const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000001';

// Gas Limit Constants
const MIN_GAS_LIMIT = 1000000;
const MAX_GAS_LIMIT = 100000000;
const RECOMMENDED_MIN_GAS_LIMIT = 8000000;

// Target Gas Constants
const MIN_TARGET_GAS = 1000000;
const MAX_TARGET_GAS = 500000000; // Increased to support static gas pricing

// Helper function to convert gwei to wei
const gweiToWei = (gwei: number): number => gwei * 1000000000;

// --- Main Component --- 

type GenesisBuilderProps = {
    genesisData?: string;
    setGenesisData?: (data: string) => void;
    initiallyExpandedSections?: SectionId[];
};

function GenesisBuilderInner({
    genesisData: externalGenesisData,
    setGenesisData: externalSetGenesisData,
    initiallyExpandedSections = ["chainParams"]
}: GenesisBuilderProps) {
    // Internal state for when used standalone (e.g., in MDX files)
    const [internalGenesisData, setInternalGenesisData] = useState<string>("");
    
    // Use external state if provided, otherwise use internal state
    const genesisData = externalGenesisData !== undefined ? externalGenesisData : internalGenesisData;
    const setGenesisData = externalSetGenesisData || setInternalGenesisData;
    const { walletEVMAddress } = useWalletStore();
    const { setHighlightPath, clearHighlight } = useGenesisHighlight();

    // --- State --- 
    const [evmChainId, setEvmChainId] = useState<number>(10000 + Math.floor(Math.random() * 90000));
    const [tokenName, setTokenName] = useState<string>("COIN");
    const [tokenSymbol, setTokenSymbol] = useState<string>("COIN");
    const [gasLimit, setGasLimit] = useState<number>(15000000);
    const [targetBlockRate, setTargetBlockRate] = useState<number>(2);

    // Token allocations - managed entirely within this component
    const [tokenAllocations, setTokenAllocations] = useState<AllocationEntry[]>(() => {
        const defaultAddress = walletEVMAddress || PLACEHOLDER_ADDRESS;
        return [{ address: defaultAddress as Address, amount: DEFAULT_TOKEN_AMOUNT }];
    });
    
    // Update token allocations when wallet connects
    useEffect(() => {
        if (walletEVMAddress && tokenAllocations.length === 1 && 
            tokenAllocations[0].address === PLACEHOLDER_ADDRESS) {
            setTokenAllocations([{ address: walletEVMAddress as Address, amount: tokenAllocations[0].amount }]);
        }
    }, [walletEVMAddress, tokenAllocations]);
    const [feeConfig, setFeeConfig] = useState<FeeConfigType>(DEFAULT_FEE_CONFIG);

    // Using the AllowlistPrecompileConfig as the single source of truth for allowlists
    const [contractDeployerAllowListConfig, setContractDeployerAllowListConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [contractNativeMinterConfig, setContractNativeMinterConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [txAllowListConfig, setTxAllowListConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [feeManagerConfig, setFeeManagerConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [rewardManagerConfig, setRewardManagerConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());

    // Fixed Warp config for now (can be made configurable later)
    const warpConfig = {
        enabled: true,
        quorumNumerator: 67,
        requirePrimaryNetworkSigners: true
    }

    const [validationMessages, setValidationMessages] = useState<ValidationMessages>({ errors: {}, warnings: {} });
    const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(initiallyExpandedSections || []));

    // Add a flag to control when genesis should be generated
    // Start with true to always show genesis, even with validation errors
    const [shouldGenerateGenesis, setShouldGenerateGenesis] = useState(true);

    // Preinstall configuration state
    const [preinstallConfig, setPreinstallConfig] = useState<PreinstallConfig>({
        proxy: true,
        proxyAdmin: true,
        safeSingletonFactory: true,  // Enabled by default as requested
        multicall3: false,
        icmMessenger: true,
        wrappedNativeToken: true,
        create2Deployer: false
    });

    // --- Validation Logic --- 
    useEffect(() => {
        const errors: Record<string, string> = {};
        const warnings: Record<string, string> = {};

        // Chain ID
        if (!evmChainId || evmChainId < 1) errors.chainId = "Chain ID must be a positive integer";
        else if (evmChainId > 4294967295) errors.chainId = "Chain ID must be less than 2^32";
        else if ([1, 43113, 43114, 53935, 73772, 78430, 78431, 78432, 78433, 78434, 78435, 78436, 78437, 78438, 78439].includes(evmChainId)) {
            warnings.chainId = "This Chain ID is commonly used. Consider using a different value.";
        }

        // Token Name and Symbol validation
        if (!tokenName || tokenName.length === 0) errors.tokenName = "Token name is required";
        else if (tokenName.length > 50) errors.tokenName = "Token name must be 50 characters or less";
        else if (!/^[a-zA-Z0-9\s]+$/.test(tokenName)) errors.tokenName = "Token name can only contain letters, numbers, and spaces";

        if (!tokenSymbol || tokenSymbol.length === 0) errors.tokenSymbol = "Token symbol is required";
        else if (tokenSymbol.length > 10) errors.tokenSymbol = "Token symbol must be 10 characters or less";
        else if (!/^[A-Z0-9]+$/.test(tokenSymbol)) errors.tokenSymbol = "Token symbol must be uppercase letters and numbers only";

        // Token Name and Symbol validation
        if (tokenName.length > 50) errors.tokenName = "Token name must be 50 characters or less";
        
        if (tokenSymbol.length < 2 || tokenSymbol.length > 6) errors.tokenSymbol = "Token symbol must be 2-6 characters";
        else if (!/^[A-Z0-9]+$/.test(tokenSymbol)) warnings.tokenSymbol = "Token symbol should be uppercase letters and numbers only";

        // Gas Limit
        if (gasLimit < MIN_GAS_LIMIT) errors.gasLimit = `Gas limit must be at least ${MIN_GAS_LIMIT.toLocaleString()}`;
        else if (gasLimit > MAX_GAS_LIMIT) warnings.gasLimit = "High gas limits may impact performance";
        else if (gasLimit < RECOMMENDED_MIN_GAS_LIMIT) warnings.gasLimit = `Gas limit below ${RECOMMENDED_MIN_GAS_LIMIT.toLocaleString()} may be too restrictive`;

        // Target Block Rate
        if (targetBlockRate < 0.1) errors.targetBlockRate = "Target block rate must be at least 0.1 seconds";
        else if (targetBlockRate > 10) warnings.targetBlockRate = "Block rates above 10 seconds may impact user experience";

        // Token Allocations
        if (tokenAllocations.length === 0) errors.tokenAllocations = "At least one token allocation is required";
        tokenAllocations.forEach((allocation, index) => {
            if (!allocation.address || !/^0x[a-fA-F0-9]{40}$/.test(allocation.address as string)) {
                errors[`allocation_${index}`] = `Invalid address in allocation ${index + 1}`;
            }
            if (!allocation.amount || allocation.amount <= 0) {
                errors[`allocation_amount_${index}`] = `Allocation ${index + 1} amount must be positive`;
            }
        });

        // Allowlist Precompiles
        if (!isValidAllowlistPrecompileConfig(contractDeployerAllowListConfig)) errors.contractDeployerAllowList = "Contract Deployer Allow List: Configuration is invalid or requires at least one valid address.";
        if (!isValidAllowlistPrecompileConfig(contractNativeMinterConfig)) errors.contractNativeMinter = "Native Minter: Configuration is invalid or requires at least one valid address.";
        if (!isValidAllowlistPrecompileConfig(txAllowListConfig)) errors.txAllowList = "Transaction Allow List: Configuration is invalid or requires at least one valid address.";

        // Fee/Reward Manager
        if (!isValidAllowlistPrecompileConfig(feeManagerConfig)) errors.feeManager = "Fee Manager: Configuration is invalid or requires at least one valid address.";
        if (!isValidAllowlistPrecompileConfig(rewardManagerConfig)) errors.rewardManager = "Reward Manager: Configuration is invalid or requires at least one valid address.";

        // Fee Config Parameters
        if (feeConfig.minBaseFee < 0) errors.minBaseFee = "Min base fee must be non-negative";
        if (feeConfig.minBaseFee < gweiToWei(1)) warnings.minBaseFee = "Min base fee below 1 gwei may cause issues";
        if (feeConfig.minBaseFee > gweiToWei(500)) warnings.minBaseFee = "Min base fee above 500 gwei may be expensive";

        if (feeConfig.targetGas < 0) errors.targetGas = "Target gas must be non-negative";
        if (feeConfig.targetGas < MIN_TARGET_GAS) warnings.targetGas = "Target gas below 1M may lead to congestion";
        // Only warn if target gas is very high and not in static pricing range
        const staticGasThreshold = Math.ceil((gasLimit * 10) / targetBlockRate);
        if (feeConfig.targetGas > MAX_TARGET_GAS) {
            warnings.targetGas = "Target gas above 500M may require significant resources";
        } else if (feeConfig.targetGas > staticGasThreshold && feeConfig.targetGas < staticGasThreshold * 1.5) {
            // Info message when in static pricing range
            warnings.targetGas = "Target gas configured for static pricing (no congestion-based adjustments)";
        }

        if (feeConfig.baseFeeChangeDenominator < 0) errors.baseFeeChangeDenominator = "Base fee change denominator must be non-negative";
        if (feeConfig.baseFeeChangeDenominator < 8) warnings.baseFeeChangeDenominator = "Low denominator may cause fees to change too rapidly";
        if (feeConfig.baseFeeChangeDenominator > 1000) warnings.baseFeeChangeDenominator = "High denominator may cause fees to react too slowly";

        if (feeConfig.minBlockGasCost < 0) errors.minBlockGasCost = "Min block gas cost must be non-negative";
        if (feeConfig.minBlockGasCost > 1e9) warnings.minBlockGasCost = "Min block gas cost above 1B may impact performance";

        if (feeConfig.maxBlockGasCost < feeConfig.minBlockGasCost) errors.maxBlockGasCost = "Max block gas cost must be >= min block gas cost";
        if (feeConfig.maxBlockGasCost > 1e10) warnings.maxBlockGasCost = "Max block gas cost above 10B may impact performance";

        if (feeConfig.blockGasCostStep < 0) errors.blockGasCostStep = "Block gas cost step must be non-negative";
        if (feeConfig.blockGasCostStep > 5000000) warnings.blockGasCostStep = "Block gas cost step above 5M may cause fees to change too rapidly";

        // Update validation messages
        setValidationMessages({ errors, warnings });

        // Always generate genesis, but show validation errors to user
        // This ensures genesis is always visible even with errors
        setShouldGenerateGenesis(true);
    }, [
        evmChainId, tokenName, tokenSymbol, gasLimit, targetBlockRate, tokenAllocations,
        contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig,
        feeManagerConfig, rewardManagerConfig,
        feeConfig, preinstallConfig
    ]);

    // Helper function to generate genesis data
    const generateGenesisData = useCallback(() => {
        // Don't proceed if we shouldn't generate genesis
        if (!shouldGenerateGenesis) {
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
                            ...baseGenesis.config.warpConfig,
                            ...warpConfig,
                        },
                        // Add fee and reward manager configurations
                        ...(feeManagerConfig.activated && {
                            feeManagerConfig: {
                                blockTimestamp: blockTimestamp || 0,
                                adminAddresses: [
                                    ...(feeManagerConfig.addresses?.Admin || []).map(a => a.address),
                                    ...(feeManagerConfig.addresses?.Manager || []).map(a => a.address),
                                    ...(feeManagerConfig.addresses?.Enabled || []).map(a => a.address)
                                ].filter(Boolean)
                            }
                        }),
                        ...(rewardManagerConfig.activated && {
                            rewardManagerConfig: {
                                blockTimestamp: blockTimestamp || 0,
                                adminAddresses: [
                                    ...(rewardManagerConfig.addresses?.Admin || []).map(a => a.address),
                                    ...(rewardManagerConfig.addresses?.Manager || []).map(a => a.address),
                                    ...(rewardManagerConfig.addresses?.Enabled || []).map(a => a.address)
                                ].filter(Boolean)
                            }
                        })
                    },
                    timestamp: `0x${blockTimestamp.toString(16)}`
                };
                const genesisString = JSON.stringify(finalGenesisConfig, null, 2);
                setGenesisData(genesisString);
        } catch (error) {
            console.error("Error generating genesis data:", error);
            setGenesisData(`Error generating genesis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [shouldGenerateGenesis, evmChainId, gasLimit, targetBlockRate, tokenAllocations, contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig, feeManagerConfig, rewardManagerConfig, feeConfig, warpConfig, preinstallConfig, setGenesisData, blockTimestamp, tokenName, tokenSymbol]);

    // Effect to immediately generate genesis if it's empty (e.g., after reset or initial load)
    useEffect(() => {
        if (!genesisData && shouldGenerateGenesis) {
            generateGenesisData();
        }
    }, [genesisData, shouldGenerateGenesis, generateGenesisData]);

    // Effect to regenerate genesis with debounce when parameters change
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            generateGenesisData();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [evmChainId, gasLimit, targetBlockRate, tokenAllocations, contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig, feeManagerConfig, rewardManagerConfig, feeConfig, warpConfig, preinstallConfig, tokenName, tokenSymbol, generateGenesisData]);

    // --- Handlers ---

    const toggleSection = useCallback((sectionId: SectionId) => {
        setExpandedSections(prev => {
            const newState = new Set(prev);
            if (newState.has(sectionId)) {
                newState.delete(sectionId);
            } else {
                newState.add(sectionId);
            }
            return newState;
        });
    }, []);

    const isSectionExpanded = useCallback((sectionId: SectionId) => expandedSections.has(sectionId), [expandedSections]);

    // Calculate genesis size in bytes and KiB
    const genesisSizeBytes = genesisData ? new Blob([genesisData]).size : 0;
    const genesisSizeKiB = genesisSizeBytes / 1024;
    const maxSizeKiB = 64; // P-Chain transaction limit

    // Handler for token allocations
    const handleTokenAllocationsChange = useCallback((newAllocations: AllocationEntry[]) => {
        setTokenAllocations(newAllocations);
    }, [setTokenAllocations]);

    // Memoize common props
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

    const handleSetFeeManagerConfig = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setFeeManagerConfig(config);
    }, []);

    const handleSetRewardManagerConfig = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setRewardManagerConfig(config);
    }, []);

    const handleSetEvmChainId = useCallback((id: SetStateAction<number>) => {
        setEvmChainId(id);
    }, []);

    // --- Render --- 
    return (
        <div className="space-y-6 mb-4">
            {/* Compact single-column: remove top tab bar per design */}

            {/* Configuration Tab */}
            {activeTab === "config" && (
                <div className="space-y-6">
                    <ChainParamsSection
                        evmChainId={evmChainId}
                        setEvmChainId={handleSetEvmChainId}
                        tokenName={tokenName}
                        setTokenName={setTokenName}
                        tokenSymbol={tokenSymbol}
                        setTokenSymbol={setTokenSymbol}
                        isExpanded={isSectionExpanded('chainParams')}
                        toggleExpand={() => toggleSection('chainParams')}
                        validationError={validationMessages.errors.chainId}
                        tokenNameError={validationMessages.errors.tokenName}
                        tokenSymbolError={validationMessages.errors.tokenSymbol}
                    />

                    {/* Main Configuration Sections */}
                    <div className="space-y-8">
                        {/* TOKENOMICS: Coin name, initial token allocation, native minter */}
                        <TokenomicsSection
                            tokenAllocations={tokenAllocations}
                            setTokenAllocations={handleTokenAllocationsChange}
                            nativeMinterConfig={contractNativeMinterConfig}
                            setNativeMinterConfig={handleNativeMinterConfigChange}
                            tokenName={tokenName}
                            setTokenName={setTokenName}
                            tokenSymbol={tokenSymbol}
                            setTokenSymbol={setTokenSymbol}
                            validationErrors={validationMessages.errors}
                            compact
                            walletAddress={walletEVMAddress ? walletEVMAddress as Address : undefined}
                        />

                        {/* PERMISSIONING: Contract deployer allowlist, transaction allowlist */}
                        <PermissioningSection
                            deployerConfig={contractDeployerAllowListConfig}
                            setDeployerConfig={handleDeployerConfigChange}
                            txConfig={txAllowListConfig}
                            setTxConfig={handleTxConfigChange}
                            compact
                            validationErrors={validationMessages.errors}
                            walletAddress={walletEVMAddress ? walletEVMAddress as Address : undefined}
                        />

                        {/* FEE CONFIGURATION: Fee config setup, fee manager, reward manager */}
                        <FeeConfigurationSection
                            gasLimit={gasLimit}
                            setGasLimit={handleSetGasLimit}
                            targetBlockRate={targetBlockRate}
                            setTargetBlockRate={handleSetTargetBlockRate}
                            feeConfig={feeConfig}
                            setFeeConfig={handleFeeConfigChange}
                            feeManagerConfig={feeManagerConfig}
                            setFeeManagerConfig={handleSetFeeManagerConfig}
                            rewardManagerConfig={rewardManagerConfig}
                            setRewardManagerConfig={handleSetRewardManagerConfig}
                            validationMessages={validationMessages}
                            compact
                            walletAddress={walletEVMAddress ? walletEVMAddress as Address : undefined}
                        />

                        {/* PRE-DEPLOYS: Pre-deployed contracts (Safe Singleton enabled by default) */}
                        <PredeploysSection
                            config={preinstallConfig}
                            onConfigChange={setPreinstallConfig}
                            ownerAddress={tokenAllocations[0]?.address}
                            tokenName={tokenName}
                            tokenSymbol={tokenSymbol}
                            compact
                        />
                    </div>

                    {/* Validation Summary & Actions */}
                   
                </div>
            )}

            {/* Precompiles Tab */}
            {activeTab === "precompiles" && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        {/* Header */}
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                                Precompile Configuration
                            </h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                                Review the status and configuration of precompiles based on your settings.
                            </p>

                            {/* Status Summary */}
                            <div className="inline-flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                <div className={`w-1.5 h-1.5 rounded-full ${(() => {
                                    const enabledCount = [
                                        contractDeployerAllowListConfig.activated,
                                        contractNativeMinterConfig.activated,
                                        txAllowListConfig.activated,
                                        feeManagerEnabled,
                                        rewardManagerEnabled,
                                        warpConfig.enabled
                                    ].filter(Boolean).length;
                                    return enabledCount === 6 ? 'bg-green-500' : enabledCount > 0 ? 'bg-yellow-500' : 'bg-zinc-400';
                                })()}`} />
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                    {[
                                        contractDeployerAllowListConfig.activated,
                                        contractNativeMinterConfig.activated,
                                        txAllowListConfig.activated,
                                        feeManagerEnabled,
                                        rewardManagerEnabled,
                                        warpConfig.enabled
                                    ].filter(Boolean).length} of 6 precompiles enabled
                                </span>
                            </div>
                        </div>

                        {/* Contract Deployer Allow List */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-baseline space-x-2 mb-1">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">Contract Deployer Allow List</h3>
                                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${contractDeployerAllowListConfig.activated
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                            {contractDeployerAllowListConfig.activated ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                        Controls which addresses can deploy smart contracts on the blockchain
                                    </p>
                                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                        {PRECOMPILE_ADDRESSES.contractDeployer}
                                    </div>
                                </div>
                            </div>

                            {contractDeployerAllowListConfig.activated && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                                    <div className="space-y-3">
                                        {contractDeployerAllowListConfig.addresses.Admin.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Admin Addresses</div>
                                                <div className="space-y-1">
                                                    {contractDeployerAllowListConfig.addresses.Admin.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {contractDeployerAllowListConfig.addresses.Manager.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Manager Addresses</div>
                                                <div className="space-y-1">
                                                    {contractDeployerAllowListConfig.addresses.Manager.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {contractDeployerAllowListConfig.addresses.Enabled.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Enabled Addresses</div>
                                                <div className="space-y-1">
                                                    {contractDeployerAllowListConfig.addresses.Enabled.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {contractDeployerAllowListConfig.addresses.Admin.length === 0 &&
                                            contractDeployerAllowListConfig.addresses.Manager.length === 0 &&
                                            contractDeployerAllowListConfig.addresses.Enabled.length === 0 && (
                                                <div className="text-zinc-500 dark:text-zinc-400 text-sm">
                                                    No addresses configured
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Native Minter */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-baseline space-x-2 mb-1">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">Native Minter</h3>
                                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${contractNativeMinterConfig.activated
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                            {contractNativeMinterConfig.activated ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                        Allows authorized addresses to mint native tokens on the blockchain
                                    </p>
                                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                        {PRECOMPILE_ADDRESSES.nativeMinter}
                                    </div>
                                </div>
                            </div>

                            {contractNativeMinterConfig.activated && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                                    <div className="space-y-3">
                                        {contractNativeMinterConfig.addresses.Admin.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Admin Addresses</div>
                                                <div className="space-y-1">
                                                    {contractNativeMinterConfig.addresses.Admin.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {contractNativeMinterConfig.addresses.Manager.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Manager Addresses</div>
                                                <div className="space-y-1">
                                                    {contractNativeMinterConfig.addresses.Manager.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {contractNativeMinterConfig.addresses.Enabled.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Enabled Addresses</div>
                                                <div className="space-y-1">
                                                    {contractNativeMinterConfig.addresses.Enabled.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {contractNativeMinterConfig.addresses.Admin.length === 0 &&
                                            contractNativeMinterConfig.addresses.Manager.length === 0 &&
                                            contractNativeMinterConfig.addresses.Enabled.length === 0 && (
                                                <div className="text-zinc-500 dark:text-zinc-400 text-sm">
                                                    No addresses configured
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Transaction Allow List */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-baseline space-x-2 mb-1">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">Transaction Allow List</h3>
                                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${txAllowListConfig.activated
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                            {txAllowListConfig.activated ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                        Controls which addresses can submit transactions to the blockchain
                                    </p>
                                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                        {PRECOMPILE_ADDRESSES.txAllowList}
                                    </div>
                                </div>
                            </div>

                            {txAllowListConfig.activated && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                                    <div className="space-y-3">
                                        {txAllowListConfig.addresses.Admin.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Admin Addresses</div>
                                                <div className="space-y-1">
                                                    {txAllowListConfig.addresses.Admin.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {txAllowListConfig.addresses.Manager.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Manager Addresses</div>
                                                <div className="space-y-1">
                                                    {txAllowListConfig.addresses.Manager.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {txAllowListConfig.addresses.Enabled.length > 0 && (
                                            <div>
                                                <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Enabled Addresses</div>
                                                <div className="space-y-1">
                                                    {txAllowListConfig.addresses.Enabled.map((entry, index) => (
                                                        <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                            {entry.address}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {txAllowListConfig.addresses.Admin.length === 0 &&
                                            txAllowListConfig.addresses.Manager.length === 0 &&
                                            txAllowListConfig.addresses.Enabled.length === 0 && (
                                                <div className="text-zinc-500 dark:text-zinc-400 text-sm">
                                                    No addresses configured
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fee Manager */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-baseline space-x-2 mb-1">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">Fee Manager</h3>
                                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${feeManagerEnabled
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                            {feeManagerEnabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                        Manages dynamic fee configuration and collection on the blockchain
                                    </p>
                                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                        {PRECOMPILE_ADDRESSES.feeManager}
                                    </div>
                                </div>
                            </div>

                            {feeManagerEnabled && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                                    <div>
                                        <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Admin Addresses</div>
                                        {feeManagerAdmins.length > 0 ? (
                                            <div className="space-y-1">
                                                {feeManagerAdmins.map((address, index) => (
                                                    <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                        {address}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-red-500 dark:text-red-400">
                                                No admin addresses configured (Required)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Reward Manager */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-baseline space-x-2 mb-1">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">Reward Manager</h3>
                                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${rewardManagerEnabled
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                            {rewardManagerEnabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                        Manages validator rewards and distribution mechanisms
                                    </p>
                                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                        {PRECOMPILE_ADDRESSES.rewardManager}
                                    </div>
                                </div>
                            </div>

                            {rewardManagerEnabled && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                                    <div>
                                        <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 mb-1">Admin Addresses</div>
                                        {rewardManagerAdmins.length > 0 ? (
                                            <div className="space-y-1">
                                                {rewardManagerAdmins.map((address, index) => (
                                                    <div key={index} className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                                        {address}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-red-500 dark:text-red-400">
                                                No admin addresses configured (Required)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Warp Messenger */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:shadow-sm dark:hover:shadow-zinc-900/20">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-baseline space-x-2 mb-1">
                                        <h3 className="font-semibold text-zinc-900 dark:text-white leading-none">Warp Messenger</h3>
                                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${warpConfig.enabled
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                            }`}>
                                            {warpConfig.enabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                        Enables cross-chain communication and message passing between subnets
                                    </p>
                                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border break-all">
                                        {PRECOMPILE_ADDRESSES.warpMessenger}
                                    </div>
                                </div>
                            </div>

                            {warpConfig.enabled && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Quorum Threshold</span>
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{warpConfig.quorumNumerator}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Require Primary Network Signers</span>
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{warpConfig.requirePrimaryNetworkSigners ? "Yes" : "No"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-center space-x-4">
                        <Button onClick={() => setActiveTab("config")} variant="secondary">Back to Configuration</Button>
                        <Button onClick={() => setActiveTab("preinstalls")} variant="secondary">View Pre-Deployed Contracts</Button>
                        {isGenesisReady && <Button onClick={() => setActiveTab("genesis")} variant="secondary">View Genesis JSON</Button>}
                    </div>
                </div>
            )}

            {/* Preinstalls Tab */}
            {activeTab === "preinstalls" && (
                <PreinstallsTab
                    preinstallConfig={preinstallConfig}
                    setPreinstallConfig={setPreinstallConfig}
                    ownerAddress={tokenAllocations[0]?.address}
                    tokenName={tokenName}
                    tokenSymbol={tokenSymbol}
                    isGenesisReady={!!isGenesisReady}
                    setActiveTab={setActiveTab}
                />
            )}

            {/* Genesis JSON Tab */}
            {activeTab === "genesis" && isGenesisReady && (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-zinc-800 dark:text-white">Genesis JSON</h3>
                        <div className="flex space-x-2">
                            <Button onClick={handleCopyToClipboard} variant="secondary" size="sm" className="flex items-center">
                                <Copy className="h-4 w-4 mr-1" /> {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button onClick={handleDownloadGenesis} variant="secondary" size="sm" className="flex items-center">
                                <Download className="h-4 w-4 mr-1" /> Download
                            </Button>
                        </div>
                    </div>

                    <DynamicCodeBlock lang="json" code={genesisData} />

                    {/* Genesis Size Progress Bar */}
                    <div className="mt-4 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Genesis Size
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {genesisSizeKiB.toFixed(2)} KiB / {maxSizeKiB} KiB
                            </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full transition-all duration-300 ${sizePercentage >= 90
                                    ? "bg-red-500"
                                    : sizePercentage >= 75
                                        ? "bg-yellow-500"
                                        : "bg-green-500"
                                    }`}
                                style={{ width: `${sizePercentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {sizePercentage >= 90 && "⚠️ Approaching P-Chain limit"}
                                {sizePercentage >= 75 && sizePercentage < 90 && "⚡ Consider optimizing"}
                                {sizePercentage < 75 && "✅ Within safe limits"}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {sizePercentage.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-center space-x-4">
                        <Button onClick={() => setActiveTab("config")} variant="secondary">Back to Configuration</Button>
                        <Button onClick={() => setActiveTab("precompiles")} variant="secondary">View Precompiles</Button>
                        <Button onClick={() => setActiveTab("preinstalls")} variant="secondary">View Pre-Deployed Contracts</Button>
                    </div>
                </div>
            )}

        </div>
    );
}

// Export the inner component for use within contexts that already provide GenesisHighlightProvider
export { GenesisBuilderInner };

// Default export wraps with provider for standalone use
export default function GenesisBuilder(props: GenesisBuilderProps) {
    return (
        <GenesisHighlightProvider>
            <GenesisBuilderInner {...props} />
        </GenesisHighlightProvider>
    );
}