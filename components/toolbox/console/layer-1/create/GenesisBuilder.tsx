"use client";

import { useEffect, useState, useCallback, SetStateAction } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { Button } from "@/components/toolbox/components/Button";
import { Copy, Download, AlertCircle, Check } from "lucide-react";
import { Address } from "viem";

import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

// Genesis Components
import { ChainParamsSection } from "@/components/toolbox/components/genesis/sections/ChainParamsSection";
import { TokenomicsSection } from "@/components/toolbox/components/genesis/sections/TokenomicsSection";
import { PermissionsSection } from "@/components/toolbox/components/genesis/sections/PermissionsSection";
import { TransactionFeesSection } from "@/components/toolbox/components/genesis/sections/TransactionFeesSection";
import { PreinstallsTab } from "@/components/toolbox/components/genesis/tabs/PreinstallsTab";

// Genesis Utilities & Types
import { generateGenesis } from "@/components/toolbox/components/genesis/genGenesis";
import {
    AllocationEntry,
    AllowlistPrecompileConfig,
    FeeConfigType,
    SectionId,
    ValidationMessages,
    generateEmptyAllowlistPrecompileConfig,
    isValidAllowlistPrecompileConfig
} from "@/components/toolbox/components/genesis/types";
import { PreinstallConfig } from "@/components/toolbox/components/genesis/PreinstalledContractsSection";

// --- Constants --- 
const DEFAULT_FEE_CONFIG: FeeConfigType = {
    baseFeeChangeDenominator: 48,
    blockGasCostStep: 200000,
    maxBlockGasCost: 1000000,
    minBaseFee: 25000000000, // 25 gwei
    minBlockGasCost: 0,
    targetGas: 15000000
};

const PRECOMPILE_ADDRESSES = {
    contractDeployer: "0x0200000000000000000000000000000000000000" as Address,
    nativeMinter: "0x0200000000000000000000000000000000000001" as Address,
    txAllowList: "0x0200000000000000000000000000000000000002" as Address,
    feeManager: "0x0200000000000000000000000000000000000003" as Address,
    rewardManager: "0x0200000000000000000000000000000000000004" as Address,
    warpMessenger: "0x0200000000000000000000000000000000000005" as Address,
};

// Helper function to convert gwei to wei
const gweiToWei = (gwei: number): number => gwei * 1000000000;

// --- Main Component --- 

type GenesisBuilderProps = {
    genesisData: string;
    setGenesisData: (data: string) => void;
    initiallyExpandedSections?: SectionId[];
};

export default function GenesisBuilder({ genesisData, setGenesisData, initiallyExpandedSections = ["chainParams"] }: GenesisBuilderProps) {
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

    const [activeTab, setActiveTab] = useState<string>("config");
    const [copied, setCopied] = useState(false);
    const [validationMessages, setValidationMessages] = useState<ValidationMessages>({ errors: {}, warnings: {} });
    const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(initiallyExpandedSections || []));

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

    const handleCopyToClipboard = useCallback(async () => {
        if (!genesisData) return;
        try {
            await navigator.clipboard.writeText(genesisData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy genesis data:", err);
        }
    }, [genesisData]);

    const handleDownloadGenesis = useCallback(() => {
        if (!genesisData) return;
        const blob = new Blob([genesisData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `genesis-${evmChainId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [genesisData, evmChainId]);

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

    const isGenesisReady = genesisData && Object.keys(validationMessages.errors).length === 0;

    // Calculate genesis size in bytes and KiB
    const genesisSizeBytes = genesisData ? new Blob([genesisData]).size : 0;
    const genesisSizeKiB = genesisSizeBytes / 1024;
    const maxSizeKiB = 64; // P-Chain transaction limit
    const sizePercentage = Math.min((genesisSizeKiB / maxSizeKiB) * 100, 100);

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
    return (
        <div className="space-y-6 mb-4">
            {/* Tabs */}
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex -mb-px">
                    {["config", "precompiles", "preinstalls", "genesis"].map(tabId => (
                        <button
                            key={tabId}
                            onClick={() => setActiveTab(tabId)}
                            disabled={tabId === "genesis" && !isGenesisReady}
                            className={`py-2 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === tabId
                                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                                }`}
                        >
                            {tabId === "config" && "Configuration"}
                            {tabId === "precompiles" && "Precompile Info"}
                            {tabId === "preinstalls" && "Pre-Deployed Contracts"}
                            {tabId === "genesis" && "Genesis JSON"}
                        </button>
                    ))}
                </div>
            </div>

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

                    <PermissionsSection
                        deployerConfig={contractDeployerAllowListConfig}
                        setDeployerConfig={handleDeployerConfigChange}
                        txConfig={txAllowListConfig}
                        setTxConfig={handleTxConfigChange}
                        isExpanded={isSectionExpanded('permissions')}
                        toggleExpand={() => toggleSection('permissions')}
                        validationErrors={validationMessages.errors}
                    />

                    <TokenomicsSection
                        tokenAllocations={tokenAllocations}
                        setTokenAllocations={handleTokenAllocationsChange}
                        nativeMinterConfig={contractNativeMinterConfig}
                        setNativeMinterConfig={handleNativeMinterConfigChange}
                        isExpanded={isSectionExpanded('tokenomics')}
                        toggleExpand={() => toggleSection('tokenomics')}
                        validationErrors={validationMessages.errors}
                    />

                    <TransactionFeesSection
                        gasLimit={gasLimit}
                        setGasLimit={handleSetGasLimit}
                        targetBlockRate={targetBlockRate}
                        setTargetBlockRate={handleSetTargetBlockRate}
                        feeConfig={feeConfig}
                        setFeeConfig={handleFeeConfigChange}
                        feeManagerEnabled={feeManagerEnabled}
                        setFeeManagerEnabled={handleSetFeeManagerEnabled}
                        feeManagerAdmins={feeManagerAdmins}
                        setFeeManagerAdmins={handleSetFeeManagerAdmins}
                        rewardManagerEnabled={rewardManagerEnabled}
                        setRewardManagerEnabled={handleSetRewardManagerEnabled}
                        rewardManagerAdmins={rewardManagerAdmins}
                        setRewardManagerAdmins={handleSetRewardManagerAdmins}
                        isExpanded={isSectionExpanded('transactionFees')}
                        toggleExpand={() => toggleSection('transactionFees')}
                        validationMessages={validationMessages} // Pass both errors and warnings
                    />

                    {/* Validation Summary & Actions */}
                    <div>
                        {Object.keys(validationMessages.errors).length > 0 ? (
                            <div className="bg-red-50/70 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 p-4 rounded-md flex items-start mb-4">
                                <AlertCircle className="text-red-500 mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-red-800 dark:text-red-300">Please fix the following errors:</h4>
                                    <ul className="mt-2 list-disc list-inside text-sm text-red-700 dark:text-red-400">
                                        {Object.entries(validationMessages.errors).map(([key, message]) => (
                                            <li key={key}>{message}</li> // Consider making keys more user-friendly later
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : isGenesisReady ? (
                            <div className="bg-green-50/70 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 p-4 rounded-md flex items-center mb-4">
                                <Check className="text-green-500 mr-3 h-5 w-5" />
                                <span className="text-green-800 dark:text-green-300">Genesis configuration is valid and ready!</span>
                            </div>
                        ) : (
                            <div className="bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 p-4 rounded-md flex items-center mb-4">
                                <Check className="text-blue-500 mr-3 h-5 w-5" />
                                <span className="text-blue-800 dark:text-blue-300">Fill in the configuration to generate the genesis file.</span>
                            </div>
                        )}

                        {Object.keys(validationMessages.warnings).length > 0 && (
                            <div className="bg-yellow-50/70 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/60 p-4 rounded-md flex items-start mb-4">
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

                        {isGenesisReady && (
                            <div className="flex justify-center space-x-4 mt-4">
                                <Button
                                    onClick={() => setActiveTab("precompiles")}
                                    variant="secondary"
                                >
                                    View Precompile Info
                                </Button>
                                <Button
                                    onClick={() => setActiveTab("preinstalls")}
                                    variant="secondary"
                                >
                                    View Pre-Deployed Contracts
                                </Button>
                                <Button
                                    onClick={() => setActiveTab("genesis")}
                                    variant="secondary"
                                >
                                    View Genesis JSON
                                </Button>
                            </div>
                        )}
                    </div>
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
