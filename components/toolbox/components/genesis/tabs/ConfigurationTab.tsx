import { SetStateAction } from "react";
import { Address } from "viem";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "../../Button";

// Genesis Components
import { ChainParamsSection } from "../sections/ChainParamsSection";
import { TokenomicsSection } from "../sections/TokenomicsSection";
import { PermissionsSection } from "../sections/PermissionsSection";
import { TransactionFeesSection } from "../sections/TransactionFeesSection";

// Types
import {
    AllocationEntry,
    AllowlistPrecompileConfig,
    FeeConfigType,
    ValidationMessages
} from "../types";

interface ConfigurationTabProps {
    // Chain parameters
    evmChainId: number;
    setEvmChainId: (id: SetStateAction<number>) => void;
    tokenName: string;
    setTokenName: (name: SetStateAction<string>) => void;
    tokenSymbol: string;
    setTokenSymbol: (symbol: SetStateAction<string>) => void;
    
    // Token allocations
    tokenAllocations: AllocationEntry[];
    setTokenAllocations: (allocations: SetStateAction<AllocationEntry[]>) => void;
    
    // Allowlist configs
    contractDeployerAllowListConfig: AllowlistPrecompileConfig;
    setContractDeployerAllowListConfig: (config: SetStateAction<AllowlistPrecompileConfig>) => void;
    contractNativeMinterConfig: AllowlistPrecompileConfig;
    setContractNativeMinterConfig: (config: SetStateAction<AllowlistPrecompileConfig>) => void;
    txAllowListConfig: AllowlistPrecompileConfig;
    setTxAllowListConfig: (config: SetStateAction<AllowlistPrecompileConfig>) => void;
    
    // Transaction fees
    gasLimit: number;
    setGasLimit: (limit: SetStateAction<number>) => void;
    targetBlockRate: number;
    setTargetBlockRate: (rate: SetStateAction<number>) => void;
    feeConfig: FeeConfigType;
    setFeeConfig: (config: SetStateAction<FeeConfigType>) => void;
    feeManagerEnabled: boolean;
    setFeeManagerEnabled: (enabled: SetStateAction<boolean>) => void;
    feeManagerAdmins: Address[];
    setFeeManagerAdmins: (admins: SetStateAction<Address[]>) => void;
    rewardManagerEnabled: boolean;
    setRewardManagerEnabled: (enabled: SetStateAction<boolean>) => void;
    rewardManagerAdmins: Address[];
    setRewardManagerAdmins: (admins: SetStateAction<Address[]>) => void;
    
    // UI state
    isSectionExpanded: (sectionId: any) => boolean;
    toggleSection: (sectionId: any) => void;
    validationMessages: ValidationMessages;
    isGenesisReady: boolean;
    
    // Tab navigation
    setActiveTab: (tab: string) => void;
}

export function ConfigurationTab({
    evmChainId,
    setEvmChainId,
    tokenName,
    setTokenName,
    tokenSymbol,
    setTokenSymbol,
    tokenAllocations,
    setTokenAllocations,
    contractDeployerAllowListConfig,
    setContractDeployerAllowListConfig,
    contractNativeMinterConfig,
    setContractNativeMinterConfig,
    txAllowListConfig,
    setTxAllowListConfig,
    gasLimit,
    setGasLimit,
    targetBlockRate,
    setTargetBlockRate,
    feeConfig,
    setFeeConfig,
    feeManagerEnabled,
    setFeeManagerEnabled,
    feeManagerAdmins,
    setFeeManagerAdmins,
    rewardManagerEnabled,
    setRewardManagerEnabled,
    rewardManagerAdmins,
    setRewardManagerAdmins,
    isSectionExpanded,
    toggleSection,
    validationMessages,
    isGenesisReady,
    setActiveTab
}: ConfigurationTabProps) {
    return (
        <div className="space-y-6">
            <ChainParamsSection
                evmChainId={evmChainId}
                setEvmChainId={setEvmChainId}
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
                setDeployerConfig={setContractDeployerAllowListConfig}
                txConfig={txAllowListConfig}
                setTxConfig={setTxAllowListConfig}
                isExpanded={isSectionExpanded('permissions')}
                toggleExpand={() => toggleSection('permissions')}
                validationErrors={validationMessages.errors}
            />

            <TokenomicsSection
                tokenAllocations={tokenAllocations}
                setTokenAllocations={setTokenAllocations}
                nativeMinterConfig={contractNativeMinterConfig}
                setNativeMinterConfig={setContractNativeMinterConfig}
                isExpanded={isSectionExpanded('tokenomics')}
                toggleExpand={() => toggleSection('tokenomics')}
                validationErrors={validationMessages.errors}
            />

            <TransactionFeesSection
                gasLimit={gasLimit}
                setGasLimit={setGasLimit}
                targetBlockRate={targetBlockRate}
                setTargetBlockRate={setTargetBlockRate}
                feeConfig={feeConfig}
                setFeeConfig={setFeeConfig}
                feeManagerEnabled={feeManagerEnabled}
                setFeeManagerEnabled={setFeeManagerEnabled}
                feeManagerAdmins={feeManagerAdmins}
                setFeeManagerAdmins={setFeeManagerAdmins}
                rewardManagerEnabled={rewardManagerEnabled}
                setRewardManagerEnabled={setRewardManagerEnabled}
                rewardManagerAdmins={rewardManagerAdmins}
                setRewardManagerAdmins={setRewardManagerAdmins}
                isExpanded={isSectionExpanded('transactionFees')}
                toggleExpand={() => toggleSection('transactionFees')}
                validationMessages={validationMessages}
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
                                    <li key={key}>{message}</li>
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
                            View PreInstalls
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
    );
} 