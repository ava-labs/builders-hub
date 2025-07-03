import { useState, useEffect, useCallback, SetStateAction } from "react";
import { Address } from "viem";
import { useWalletStore } from "../../../stores/walletStore";
import {
    AllocationEntry,
    AllowlistPrecompileConfig,
    FeeConfigType,
    SectionId,
    ValidationMessages,
    PreinstallConfig,
    generateEmptyAllowlistPrecompileConfig,
    isValidAllowlistPrecompileConfig
} from "../types";
import { generateGenesis } from "../genGenesis";

const DEFAULT_FEE_CONFIG: FeeConfigType = {
    baseFeeChangeDenominator: 48,
    blockGasCostStep: 200000,
    maxBlockGasCost: 1000000,
    minBaseFee: 25000000000, // 25 gwei
    minBlockGasCost: 0,
    targetGas: 15000000
};

const gweiToWei = (gwei: number): number => gwei * 1000000000;

export function useGenesisState() {
    const { walletEVMAddress } = useWalletStore();

    // Core chain parameters
    const [evmChainId, setEvmChainId] = useState<number>(10000 + Math.floor(Math.random() * 90000));
    const [gasLimit, setGasLimit] = useState<number>(15000000);
    const [targetBlockRate, setTargetBlockRate] = useState<number>(2);
    
    // Token allocations
    const [tokenAllocations, setTokenAllocations] = useState<AllocationEntry[]>([]);
    
    // Fee configuration
    const [feeConfig, setFeeConfig] = useState<FeeConfigType>(DEFAULT_FEE_CONFIG);

    // Allowlist precompile configurations
    const [contractDeployerAllowListConfig, setContractDeployerAllowListConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [contractNativeMinterConfig, setContractNativeMinterConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());
    const [txAllowListConfig, setTxAllowListConfig] = useState<AllowlistPrecompileConfig>(generateEmptyAllowlistPrecompileConfig());

    // Simple precompiles
    const [feeManagerEnabled, setFeeManagerEnabled] = useState(false);
    const [feeManagerAdmins, setFeeManagerAdmins] = useState<Address[]>([]);
    const [rewardManagerEnabled, setRewardManagerEnabled] = useState(false);
    const [rewardManagerAdmins, setRewardManagerAdmins] = useState<Address[]>([]);

    // Pre-installed smart contracts
    const [preinstallConfig, setPreinstallConfig] = useState<PreinstallConfig>({
        proxy: true,
        proxyAdmin: true,
        safeSingletonFactory: true,
        multicall3: true,
        icmMessenger: true,
        wrappedNativeToken: true,
        create2Deployer: true
    });

    // Fixed Warp config
    const warpConfig = {
        enabled: true,
        quorumNumerator: 67,
        requirePrimaryNetworkSigners: true
    };

    // UI state
    const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(["chainParams"]));
    const [validationMessages, setValidationMessages] = useState<ValidationMessages>({ errors: {}, warnings: {} });
    const [shouldGenerateGenesis, setShouldGenerateGenesis] = useState(false);

    // Initialize owner allocation when wallet address is available
    useEffect(() => {
        if (walletEVMAddress && tokenAllocations.length === 0) {
            setTokenAllocations([{ address: walletEVMAddress as Address, amount: 1000000 }]);
        }
    }, [walletEVMAddress, tokenAllocations.length]);

    // Validation logic
    useEffect(() => {
        const errors: { [key: string]: string } = {};
        const warnings: { [key: string]: string } = {};

        // Chain ID validation
        if (evmChainId <= 0) errors.chainId = "Chain ID must be positive";

        // Gas Limit validation
        if (gasLimit < 0) errors.gasLimit = "Gas limit must be non-negative";
        if (gasLimit < 15000000) warnings.gasLimit = "Gas limit below 15M may impact network performance";
        if (gasLimit > 30000000) warnings.gasLimit = "Gas limit above 30M may require significant resources";

        // Block Rate validation
        if (targetBlockRate <= 0) errors.blockRate = "Block rate must be positive";
        if (targetBlockRate > 10) warnings.blockRate = "Block rates above 10 seconds may impact user experience";

        // Token Allocations validation
        if (tokenAllocations.length === 0) errors.tokenAllocations = "At least one token allocation is required.";
        tokenAllocations.forEach((alloc, index) => {
            if (!alloc.address || !/^0x[a-fA-F0-9]{40}$/.test(alloc.address)) {
                errors[`alloc_${index}_addr`] = `Allocation ${index + 1}: Invalid address format`;
            }
            if (isNaN(alloc.amount) || alloc.amount < 0) {
                errors[`alloc_${index}_amt`] = `Allocation ${index + 1}: Invalid amount`;
            }
        });

        // Allowlist Precompiles validation
        if (!isValidAllowlistPrecompileConfig(contractDeployerAllowListConfig)) {
            errors.contractDeployerAllowList = "Contract Deployer Allow List: Configuration is invalid or requires at least one valid address.";
        }
        if (!isValidAllowlistPrecompileConfig(contractNativeMinterConfig)) {
            errors.contractNativeMinter = "Native Minter: Configuration is invalid or requires at least one valid address.";
        }
        if (!isValidAllowlistPrecompileConfig(txAllowListConfig)) {
            errors.txAllowList = "Transaction Allow List: Configuration is invalid or requires at least one valid address.";
        }

        // Fee/Reward Manager validation
        if (feeManagerEnabled && feeManagerAdmins.length === 0) {
            errors.feeManager = "Fee Manager: At least one admin address is required when enabled.";
        }
        if (rewardManagerEnabled && rewardManagerAdmins.length === 0) {
            errors.rewardManager = "Reward Manager: At least one admin address is required when enabled.";
        }

        // Fee Config Parameters validation
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

        setValidationMessages({ errors, warnings });
        setShouldGenerateGenesis(Object.keys(errors).length === 0);
    }, [
        evmChainId, gasLimit, targetBlockRate, tokenAllocations,
        contractDeployerAllowListConfig, contractNativeMinterConfig, txAllowListConfig,
        feeManagerEnabled, feeManagerAdmins, rewardManagerEnabled, rewardManagerAdmins,
        feeConfig, preinstallConfig
    ]);

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

    // Memoized handlers
    const handleTokenAllocationsChange = useCallback((newAllocations: SetStateAction<AllocationEntry[]>) => {
        setTokenAllocations(newAllocations);
    }, []);

    const handleDeployerConfigChange = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setContractDeployerAllowListConfig(config);
    }, []);

    const handleTxConfigChange = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setTxAllowListConfig(config);
    }, []);

    const handleNativeMinterConfigChange = useCallback((config: SetStateAction<AllowlistPrecompileConfig>) => {
        setContractNativeMinterConfig(config);
    }, []);

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

    return {
        // Core state
        evmChainId,
        gasLimit,
        targetBlockRate,
        tokenAllocations,
        feeConfig,
        contractDeployerAllowListConfig,
        contractNativeMinterConfig,
        txAllowListConfig,
        feeManagerEnabled,
        feeManagerAdmins,
        rewardManagerEnabled,
        rewardManagerAdmins,
        preinstallConfig,
        warpConfig,
        
        // UI state
        expandedSections,
        validationMessages,
        shouldGenerateGenesis,
        
        // Setters
        setEvmChainId: handleSetEvmChainId,
        setGasLimit: handleSetGasLimit,
        setTargetBlockRate: handleSetTargetBlockRate,
        setTokenAllocations: handleTokenAllocationsChange,
        setFeeConfig: handleFeeConfigChange,
        setContractDeployerAllowListConfig: handleDeployerConfigChange,
        setContractNativeMinterConfig: handleNativeMinterConfigChange,
        setTxAllowListConfig: handleTxConfigChange,
        setFeeManagerEnabled: handleSetFeeManagerEnabled,
        setFeeManagerAdmins: handleSetFeeManagerAdmins,
        setRewardManagerEnabled: handleSetRewardManagerEnabled,
        setRewardManagerAdmins: handleSetRewardManagerAdmins,
        setPreinstallConfig,
        
        // Utilities
        toggleSection,
        isSectionExpanded,
        
        // Computed values
        isGenesisReady: shouldGenerateGenesis,
        ownerAddress: tokenAllocations.length > 0 ? tokenAllocations[0].address : undefined
    };
} 