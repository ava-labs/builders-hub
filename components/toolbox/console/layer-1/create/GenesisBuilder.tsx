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
    const [evmChainId, setEvmChainId] = useState<number>(MIN_CHAIN_ID + Math.floor(Math.random() * (MAX_CHAIN_ID - MIN_CHAIN_ID)));
    
    // Stable timestamp - generated once when component mounts
    const [blockTimestamp] = useState<number>(() => Math.floor(Date.now() / 1000));
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

            {/* Configuration - single column */}
            <div className="space-y-4">
                    {/* EVM Chain ID - Outside of sections */}
                    <div>
                        <div className="flex items-baseline gap-1.5 mb-1.5">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">EVM Chain ID</label>
                            <Tooltip>
                                <TooltipTrigger className="inline-flex">
                                    <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <div className="space-y-2">
                                        <p className="text-xs">A unique identifier for your blockchain network. Choose an ID that doesn't conflict with existing chains.</p>
                                        <a 
                                            href="https://chainlist.org" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Check registered IDs on chainlist.org
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <Input
                            label=""
                            value={evmChainId.toString()}
                            onChange={(value) => handleSetEvmChainId(Number(value))}
                            placeholder="Enter chain ID"
                            type="number"
                            error={validationMessages.errors.chainId}
                            className="max-w-xs"
                            onFocus={() => setHighlightPath('chainId')}
                            onBlur={() => clearHighlight()}
                        />
                    </div>

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